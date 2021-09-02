const fs = require('fs')
const path = require('path')

const request = require('request')
const io = require('socket.io-client')
const UserAgent = require("user-agents")

const ocr = require('../../plugins/ocr')
const connectDB = require('../../src/connect-db')
const Crawler = require('../../src/crawler')
const { getBrowser, useProxy, utils } = require('../../src/chrome')

const { autoRun, dir, sleep, filterSpace, log } = require('../../utils')
const { findInCollection } = require('../../utils/db')
const { waitUntil, waitUntilLoaded, waitUntilPropsLoaded, styles } = require('../../utils/dom')
const base = require('./config')

const preloadFile = fs.readFileSync(dir('src/preload.js'), 'utf8')

const antiSlider = require('./anti-slider.js')

console.log('NODE_ENV:', process.env.NODE_ENV)

const isProd = process.env.NODE_ENV === 'production'
const config = isProd
  ? {
    dbname: 'spider',
    baseurl: `${base.url}/detail/`
  } : {
    dbname: 'spider',
    baseurl: `${base.url}/detail/`
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
const getPage = async () => {
  const chrome = await getBrowser({ maxTabs: 2 })
  const page = await chrome.newPage()
  page._timeRatio = 1
  await page.setDefaultNavigationTimeout(7 * 1000)
  await page.evaluateOnNewDocument(preloadFile)
  await page.evaluateOnNewDocument(waitUntil)
  await page.evaluateOnNewDocument(waitUntilLoaded)
  await page.evaluateOnNewDocument(waitUntilPropsLoaded)
  await page.evaluateOnNewDocument(styles)
  await page.setViewport(utils.setViewport())
  const userAgent = new UserAgent({
    deviceCategory: "desktop",
    platform: "Win32",
  })
  const userAgentStr = userAgent.toString()
  page._ua = userAgentStr
  await page.setUserAgent(userAgentStr)
  let fingerprint
  await page.setRequestInterception(true)
  await useProxy(page, req => {
    const url = req.url()
    // 伪造指纹
    if (url.match(/s.png\?cf=0/)) {
      const fingerMatch = url.match(/&f=([a-zA-Z0-9]*)/)
      if (fingerMatch) {
        fingerprint = fingerMatch[1]
      }
    } else if (url.match(/s.png\?cf=1/) && !url.match(/T=T/)) {
      // mark &T=T do not redirect again
      const fakeURL = url.replace(/&f=[a-zA-Z0-9]*/, '&T=T&f=' + fingerprint)
      req.respond({
        status: 301,
        headers: {
          location: fakeURL
        }
      })
      return false
    }
    // 不加载广告图片，提高速度
    if (url.match(/pexels-photo/)) {
      req.abort()
      return false
    }
    // 不加载某些外部脚本
    else if (
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
  await page.evaluateOnNewDocument(async () => {
    document.addEventListener('DOMContentLoaded', () => {
      // 自定义样式
      const $style = document.createElement('style')
      $style.innerHTML = `
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
        `
      document.querySelector('head').appendChild($style)
    })
  })
  return page
}

// 创建店铺列表页任务
let shopCollection = null
function createShopDetailTask(shop) {
  const { _id: k } = shop
  return {
    id: k,
    async run({ collection, artifact }) {
      let page
      try {
        page = artifact || (await getPage())
        const isPageUsed = page === artifact
        const data = { uid: '', name: '', hotline: '', mobile: '', owner: '', address: '' }

        const url = `${config.baseurl}${k}`
        !isPageUsed && (await sleep(1000))
        await page.setExtraHTTPHeaders({
          spider: 'yiguang',
          referer: `${base.url}/`,
          'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;'
        })
        await page.goto(url, { waitUntil: 'domcontentloaded' })
        await page.setExtraHTTPHeaders({
          spider: 'yiguang',
          referer: `${base.url}/detail/${k}`,
          'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;'
        })
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
        const owner = await new Promise((resolve, reject) => {
          const errTick = setTimeout(() => reject('WS超时'), 5 * 1000)
          const options = {
            reconnection: false,
            timeout: 10000,
            transports: ['websocket'],
            extraHeaders: {
              spider: 'yiguang',
              Cookie: "",
              'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;'
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
        const mobile = await new Promise((resolve, reject) => {
          request({
            url: `${base.url}/detail/${data.uid}/mobile`,
            method: 'GET',
            strictSSL: false,
            followRedirect: false,
            headers: {
              spider: 'yiguang',
              cookie: 'bxf=11111111122222222133333333144444444'
            }
          }, (err, response) => {
            if (err) {
              console.log('获取手机号出错')
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
          console.error('ocrError:', ocrError)
          data.address = data.address || '-'
          data.hotline = data.hotline || '-'
        }

        // 储存店铺数据
        await new Promise((resolve, reject) => {
          shopCollection.deleteMany({ _id: k }, function (err) {
            if (err) {
              console.log('保存前删除店铺数据错误')
              reject(err)
            }
            const newData = {
              _id: k,
              ...shop,
              ...data,
              done: true
            }
            shopCollection.insertOne(newData, function (err) {
              if (err) {
                console.log('保存店铺数据错误')
                reject(err)
              } else {
                resolve()
              }
            })
          })
        }).catch(error => {
          throw new Error(error)
        })

        log(`DONE：${page._USE_PROXY} ${JSON.stringify(data)} ${k}`)

        // await sleep(1000 * 1000)
        errorDec(Math.floor(errorAccumulated / 2))
        await page.close()
        // page._useTime = (page._useTime || 0) + 1
        // const useMore = !page._noUseMore && (page._useTime < 20)
        // if (useMore) {
        //   return page
        // }

      } catch (err) {

        console.log(err.message)
        log.error(err.message)
        this.addTask(createShopDetailTask(shop))
        // await sleep(1000 * 1000)
        if (page && page.close) {
          await page.close()
        }

        /* 短时间内出错次数太多则重启 */
        let score
        if (err.message.match(/WS超时/)) {
          score = 20
        } else {
          score = 5
        }
        errorAcc(score)

      } finally {
        // await browser.close()
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

    return await new Crawler({
      collection: shopCollection,
      maxConcurrenceCount: 20,
      interval: Math.random() * 500 + 100,
    })
      .exec(todos)
      .then(() => {
        log(`【TASK DONE】`)
      })
      .catch(error => {
        log.error(`【TASK ERROR】 ${error.message}`)
      })
  }

  autoRun(runShopDetailTasks, {
    name: '店铺详情页任务'
  })
})
