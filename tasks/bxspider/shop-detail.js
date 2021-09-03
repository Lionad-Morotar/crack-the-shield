const fs = require('fs')

const request = require('request')
const io = require('socket.io-client')

const ocr = require('../../plugins/ocr')
const connectDB = require('../../src/connect-db')
const Tasker = require('../../src/tasker')
const { getInstance, useProxy, useRandomHeaders, useCustomCSS, useUA, utils } = require('../../src/chrome')

const { isProd, autoRun, dir, sleep, filterSpace, log, runCount } = require('../../utils')
const { findInCollection } = require('../../utils/db')
const { waitUntil, waitUntilLoaded, waitUntilPropsLoaded, styles } = require('../../utils/dom')
const base = require('./config')
const preloadFile = fs.readFileSync(dir('src/preload.js'), 'utf8')

const antiSlider = require('./anti-slider.js')

const config = isProd
  ? {
    dbname: 'spider',
    baseurl: `${base.url}/detail/`
  } : {
    dbname: 'spider-test',
    baseurl: 'http://192.168.1.7:9998/spider-detail?q='
    // baseurl: `${base.url}/detail/`
  }

let errorAccumulated = 0
const errorAcc = score => {
  errorAccumulated += score
  if (errorAccumulated > 50) {
    process.exit()
  }
}
const errorDec = score => (errorAccumulated -= score)

// 初始化浏览器
const getPage = async chrome => {
  const page = await chrome.newPage()
  await page.setDefaultNavigationTimeout(7 * 1000)
  await page.evaluateOnNewDocument(preloadFile)
  await page.evaluateOnNewDocument(waitUntil)
  await page.evaluateOnNewDocument(waitUntilLoaded)
  await page.evaluateOnNewDocument(waitUntilPropsLoaded)
  await page.evaluateOnNewDocument(styles)
  await page.setViewport(utils.setViewport())
  await page.setRequestInterception(true)
  await useProxy(page, req => {
    const url = req.url()
    // 屏蔽一些不必要的请求
    if (
      url.match(/pexels-photo/) ||
      url.match(/bfjs/) ||
      url.match(/socket.io.min.js/) ||
      url.match(/script.js/) ||
      url.match(/loaded.js/)
    ) {
      req.abort()
      return false
    } else {
      return true
    }
  })
  await useCustomCSS(page, `
    .refresh-icon { display: none }
    .verify-img-panel { border-radius: 0 }
    .ad-list { display: none }
    .official-nav-phone-block {
      padding: 20px;
      background: #ff4466;
    }
    #addressText {
      padding: 20px;
      font-weight: normal;
      letter-spacing: 1px;
    }
  `)
  return page
}

// 创建店铺列表页任务
let shopCollection = null
function createShopDetailTask(shop) {
  const { _id: k, idx } = shop
  return {
    id: k,
    async run({ artifact }) {
      const startTime = +new Date()
      let chrome
      let page
      try {
        chrome = await getInstance()
        page = artifact || (await getPage(chrome))
        await useUA(page, shop.ua)
        const isPageUsed = page === artifact
        const data = { uid: '', name: '', hotline: '', mobile: '', owner: '', address: '' }

        const url = `${config.baseurl}${k}`
        await useRandomHeaders(page, {
          'spider': 'yiguang',
          referer: `${base.url}/`,
          'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;'
        })
        await page.goto(url, { waitUntil: 'domcontentloaded' })
        await useRandomHeaders(page, { referer: `${base.url}/detail/${k}` }, page._randomHeaderSeed)
        await page.bringToFront()
        const $document = await page.evaluateHandle(() => document)

        /* 滑块验证 */
        const sliderRes = await antiSlider(page, config)
        if (isPageUsed) {
          if (sliderRes !== 'skip') {
            isPageUsed
          }
          page._noUseMore = false
        }

        // 等待 bfjs
        // const cookie = await page.waitForFunction(() => document.cookie)

        // 获取 UID
        data.uid = await page.evaluate(() => uid)

        // 获取标题内容
        data.name = await page.evaluate(
          document => document.querySelector('.company-name').innerText,
          $document
        )

        // 获取号主
        await page.hover('#view-owner')
        const owner = !isProd
          ? 'test'
          : await new Promise((resolve, reject) => {
              const wsTimeout = 5 * 1000
              const errTick = setTimeout(() => reject('WS超时'), wsTimeout)
              const options = {
                reconnection: false,
                timeout: 10000,
                transports: ['websocket'],
                extraHeaders: {
                  'spider': 'yiguang'
                }
              }
              const ws = io(base.wss, options)
              ws.on('connect', () => {
                ws.emit('i-want-a-name', data.uid, owner => {
                  if (errTick) {
                    clearTimeout(errTick)
                  }
                  resolve(owner)
                })
              })
            }).then(data => {
              return data
            }).catch(error => {
              throw new Error(error)
            })
        data.owner = owner

        // 获取手机号
        const mobileLeft = await page.evaluate(() => document.querySelector('#phone-number').innerText.split('*')[0])
        const mobileRight = await page.evaluate(() => document.querySelector('#phone-number').innerText.split('****')[1])
        const mobile = !isProd
          ? `${mobileLeft}****${mobileRight}`
          : await new Promise((resolve, reject) => {
              request({
                url: `${base.url}/detail/${data.uid}/mobile`,
                method: 'GET',
                strictSSL: false,
                followRedirect: false,
                headers: {
                  'spider': 'yiguang',
                  cookie: 'bxf=11111111122222222133333333144444444'
                }
              }, (err, response) => {
                if (err) {
                  log.error('获取手机号出错')
                  reject(err)
                } else {
                  const decodeMobile = (base64) => {
                    let mobile = ''
                    const numStr = new Buffer(base64, 'base64').toString()
                    for (let i = 0; i < numStr.length; i++) {
                      mobile += String.fromCharCode(
                        numStr.charCodeAt(i) - 10
                      )
                    }
                    return mobile
                  }
                  const data = JSON.parse(response.body)
                  const mobile = decodeMobile(data.data)
                  resolve(mobile)
                }
              })
            }).then(mobile => {
              return mobile
            }).catch(error => {
              throw new Error(error)
            })
        if (!mobile.startsWith(mobileLeft) || !mobile.endsWith(mobileRight)) {
          log(`手机号获取错误：${mobile} VS ${mobileLeft}****${mobileRight}`)
          data.mobile = mobile
        } else {
          data.mobile = mobile
        }

        // 热线
        const $hotline = await page.evaluateHandle(() => document.querySelector('.official-nav-phone-block'))

        // 地址
        await page.evaluate(async () => await waitUntilLoaded('#addressText'))
        const $address = await page.evaluateHandle(() => document.querySelector('#addressText'))
        await page.evaluate(($address, $hotline) => {
          $address.innerText = $address.innerText || nasnu1
          $address.after($hotline)
        }, $address, $hotline)

        // 地址和热线的 OCR
        const $ocr = await page.evaluateHandle(() => document.querySelector('.center-second'))
        await page.bringToFront()
        const ocrContent = await $ocr.screenshot({
          type: 'png',
          encoding: 'base64'
        })
        await page.bringToFront()
        const ocrRes = await ocr(ocrContent)
        try {
          data.address = filterSpace(ocrRes.words_result[0].words)
          data.hotline = filterSpace(ocrRes.words_result[1].words)
        } catch (ocrError) {
          log.error(ocrError)
          data.address = data.address || '-'
          data.hotline = data.hotline || '-'
        }

        // 储存店铺数据
        await new Promise((resolve, reject) => {
          shopCollection.deleteMany({ _id: k }, err => {
            if (err) {
              log.error('保存前删除店铺数据错误')
              reject(err)
            }
            const newData = {
              _id: k,
              ...shop,
              ...data,
              version: runCount,
              done: true
            }
            shopCollection.insertOne(newData, err => {
              if (err) {
                log.error('保存店铺数据错误')
                reject(err)
              } else {
                resolve()
              }
            })
          })
        }).catch(error => {
          throw new Error(error)
        })

        const endTime = +new Date()
        log(`DONE in ${endTime - startTime}ms：NO.${idx} ${page._proxyType} ${JSON.stringify(data)} ${k}`)

        // await sleep(1000 * 1000)
        await page.deleteCookie({ name: 'bxf' })
        await page.evaluate(() => localStorage.clear())
        await page.close()
        errorDec(Math.floor(errorAccumulated / 2))
        // page._useTime = (page._useTime || 0) + 1
        // const useMore = !page._noUseMore && (page._useTime < 20)
        // if (useMore) {
        //   return page
        // }

      } catch (err) {

        !isProd && (
          console.error(err),
          await sleep(1000 * 1000)
        )
        log.error(err.message)
        this.addTask(createShopDetailTask(shop))
        page && (await page.close())
        let errScore
        if (err.message.match(/WS超时/)) {
          errScore = 20
        } else {
          errScore = 5
        }
        errorAcc(errScore)

      } finally {

        // await chrome.disconnect()

      }
    }
  }
}

// 开始任务
connectDB().then(async mongo => {
  const db = mongo.db(config.dbname)
  shopCollection = db.collection('shops')

  const runShopDetailTasks = async () => {
    const findAlls = await findInCollection(shopCollection)
    const todos = findAlls.filter(x => !x.done).map(x => createShopDetailTask(x))
    // FOR TEST
    // const todos = [createShopDetailTask({
    //   _id: 'f81db0d49fa24d578b3de4e7dc220805'
    // })]
    log(`剩余${todos.length}个详情页任务`)

    const taskConf = {
      maxConcurrenceCount: 1,
      interval: () => Math.random() * 500 + 100,
    }
    return await new Tasker(taskConf)
      .start(todos)
      .then(() => log(`【TASK DONE】`))
      .catch(error => log.error(`【TASK ERROR】 ${error.message}`))
  }

  autoRun(runShopDetailTasks, {
    name: '店铺详情页任务'
  })
})
