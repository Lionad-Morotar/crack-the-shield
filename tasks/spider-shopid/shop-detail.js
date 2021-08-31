const fs = require('fs')
const path = require('path')
const _ = require('lodash')
const UserAgent = require("user-agents")

const ocr = require('../../plugins/ocr')
const connectDB = require('../../src/connect-db')
const Crawler = require('../../src/crawler')
const { getBrowser, useProxy, utils } = require('../../src/chrome')
const { dir, mkdir, sleep, filterSpace, log } = require('../../utils')
const { waitUntil, waitUntilLoaded, waitUntilPropsLoaded, styles } = require('../../utils/dom')

const preloadFile = fs.readFileSync(dir('src/preload.js'), 'utf8')
const socketIOFile = fs.readFileSync(dir('statics/socket.io.min.js'), 'utf8')

const antiSlider = require('./anti-slider.js')

const isProd = process.env.NODE_ENV === 'production'
const config = isProd
  ? {
    dbname: 'spider',
    baseurl: 'https://spider.test.baixing.cn/detail/'
  } : {
    dbname: 'spider',
    baseurl: 'https://spider.test.baixing.cn/detail/'
  }

// 初始化浏览器
const browser = (async () => await getBrowser())()
const getPage = async () => {
  const instance = await browser
  const page = await instance.newPage()
  page._timeRatio = 1
  await page.setDefaultNavigationTimeout(8 * 1000)
  await page.evaluateOnNewDocument(preloadFile)
  await page.evaluateOnNewDocument(waitUntil)
  await page.evaluateOnNewDocument(waitUntilLoaded)
  await page.evaluateOnNewDocument(waitUntilPropsLoaded)
  await page.evaluateOnNewDocument(styles)
  await page.setViewport(utils.setViewport())
  await page.setRequestInterception(true)
  // const userAgent = new UserAgent({
  //   deviceCategory: "desktop",
  //   platform: "Win32",
  // })
  // await page.setUserAgent(userAgent.toString())
  // 屏蔽一些不必要的请求
  await useProxy(page, req => {
    const url = req.url()
    // 不加载广告图片，提高速度
    if (url.match(/pexels-photo/)) {
      req.abort()
      return false
    }
    // 不加载某些外部脚本，提高响应速度
    else if (
      url.match(/s.png\?cf=0/) ||
      url.match(/s.png\?cf=1/) ||
      url.match(/script.js/) ||
      url.match(/loaded.js/) ||
      url.match(/socket.io.min.js/)
    ) {
      req.abort()
      return false
    } else {
      return true
    }
  })
  await page.evaluateOnNewDocument(async (socketIOFile) => {
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

      // 加载本地 socket.io
      const $script = document.createElement('script')
      $script.innerHTML = socketIOFile
      document.body.appendChild($script)
    })
  }, socketIOFile)
  return page
}

// 创建店铺列表页任务
let shopCollection = null
function createShopDetailTask(shop) {
  const { _id: k } = shop
  return {
    id: k,
    async run({ collection, artifact }) {
      const page = artifact || (await getPage())
      const isPageUsed = page === artifact
      try {
        const data = { uid: '', name: '', hotline: '', mobile: '', owner: '', address: '' }

        const url = `${config.baseurl}${k}`
        !isPageUsed && (await sleep(1000))
        await page.setExtraHTTPHeaders({
          spider: 'yiguang',
          referer: shop.referrer
        })
        await page.goto(url, { waitUntil: 'domcontentloaded' })

        /* 滑块验证 */
        // const sliderRes = await antiSlider(page, config)
        // if (isPageUsed) {
        //   if (sliderRes !== 'skip') {
        //     isPageUsed
        //   }
        //   page._noUseMore = false
        // }
        await page.waitForNavigation({ timeout: 15 * 1000 })
        await sleep(3000)

        await page.evaluate(async () => await waitUntilPropsLoaded('io'))
        await page.bringToFront()
        const $document = await page.evaluateHandle(() => document)

        // 获取 UID
        data.uid = await page.evaluate(() => uid)

        // 获取标题内容
        data.name = await page.evaluate(
          document => document.querySelector('.company-name').innerText,
          $document
        )

        // 获取手机号和号主
        await page.hover('#view-owner')
        const [owner, mobile] = await page.evaluate(() => Promise.race([
          Promise.all([
            new Promise(resolve => {
              const ws = io(wsUrl, { transports: ['websocket'] })
              ws.on('connect', () => {
                ws.emit('i-want-a-name', uid, owner => resolve(owner))
              })
            }),
            new Promise(resolve => {
              $.ajax({
                url: '/detail/' + uid + '/mobile',
                success(res) {
                  const decodeMobile = (base64) => {
                    let mobile = ''
                    const numStr = window.atob(base64)
                    for (let i = 0; i < numStr.length; i++) {
                      mobile += String.fromCharCode(
                        numStrcharCodeAt(i) - 10
                      )
                    }
                    return mobile
                  }
                  const mobile = decodeMobile(res.data)
                  resolve(mobile)
                }
              })
            })
          ]),
          new Promise(resolve => {
            setTimeout(() => {
              console.log('[INFO] get owner and mobile failed')
              resolve(['-', '-'])
            }, (Math.random() * 1000 + 2000))
          })
        ]))
        data.owner = owner
        data.mobile = mobile

        const pageDir = dir('spider-test/', data.name)
        await mkdir(pageDir, true)

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
        const ocrContent = await $ocr.screenshot({
          type: 'png',
          encoding: 'base64'
        })
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
                reject(err)
              } else {
                resolve()
              }
            })
          })
        })

        log(`DONE：${k} ${data}`)

        await page.close()
        // page._useTime = (page._useTime || 0) + 1
        // const useMore = !page._noUseMore && (page._useTime < 20)
        // if (useMore) {
        //   return page
        // }

      } catch (err) {

        console.log(err)
        log.error(err.message)
        this.addTask(createShopDetailTask(shop))
        // await sleep(1000 * 1000)
        // await page.close()

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

  const finds = await new Promise((resolve, reject) => {
    shopCollection.find({}).toArray(function (err, res) {
      if (err) {
        reject(err)
      } else {
        resolve(res)
      }
    })
  })
  const todos = finds.filter(x => !x.done).map(x => createShopDetailTask(x))
  log(`剩余${todos.length}个详情页任务`)

  await new Crawler({
    collection: shopCollection,
    maxConcurrenceCount: 1,
    interval: Math.random() * 500 + 500000,
  })
    .exec(todos)
    .then(() => {
      log(`task done`)
    })
    .catch(error => {
      log.error(`task error ${error.message}`)
    })

})
