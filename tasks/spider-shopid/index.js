const _ = require('lodash')
const UserAgent = require("user-agents")

const ocr = require('../../plugins/ocr')
const connectDB = require('../../src/connect-db')
const Crawler = require('../../src/crawler')
const { getBrowser, utils } = require('../../src/chrome')
const { waitUntilPropsLoaded } = require('../../utils/dom')
const pageMap = require('./page.json')

const isProd = process.env.NODE_ENV === 'production'
const noCloseForDebug = isProd ? false : true
const config = isProd
  ? {
    dbname: 'spider',
    baseurl: 'https://spider.test.baixing.cn/'
  } : {
    isDev: true,
    dbname: 'spider-test',
    // baseurl: 'http://192.168.1.7:8080/spider-main/'
    baseurl: 'http://192.168.1.7:8080/spider-slider'
  }

// 初始化浏览器
const browser = (async () => await getBrowser())()
const getPage = async () => {
  const instance = await browser
  const page = await instance.newPage()
  await page.setExtraHTTPHeaders({ spider: 'yiguang' })
  await page.evaluateOnNewDocument(waitUntilPropsLoaded)
  await page.setViewport(utils.setViewport())
  await page.setRequestInterception(true)
  const userAgent = new UserAgent({
    deviceCategory: "desktop",
    platform: "Win32",
  })
  await page.setUserAgent(userAgent.toString())
  // 屏蔽一些不必要的请求
  page.on('request', req => {
    const url = req.url()
    if (
      url.match(/title.png/) ||
      url.match(/index.css/) ||
      url.match(/bfjs/) ||
      url.match(/jquery.min.js/) ||
      url.match(/script.js/)
    ) {
      req.abort()
      return
    }
    req.continue()
  })
  return page
}

// 创建店铺列表页任务
let shopCollection = null
const shopListPageTasks = _.shuffle(
  Object.entries(pageMap).map(([k, v]) => {
    return getShopListTask(k, v)
  })
)
function getShopListTask(k, v) {
  return {
    id: k,
      async run({ collection }) {
      let page = await getPage()
      try {
        const url = `${config.baseurl}?p=${v}`
        await page.goto(url, { waitUntil: 'domcontentloaded' })

        // 滑块验证
        const $slider = await page.evaluate(() => document.querySelector('.verify-img-panel'))
        if ($slider) {
          const sliderImgBase64 = await page.evaluate(async () => (
            await waitUntilPropsLoaded('src', () => {
              const $elm = document.querySelector('.verify-img-panel img')
              return $elm && $elm.getAttribute('src')
            }))
          )
          let num
          if (config.isDev) {
            num = 1
            console.log('[INFO] use dev slider num', num)
          } else {
            const ocrRes = await ocr.numbers(sliderImgBase64, 'base64')
            if (ocrRes && ocrRes.words_result_num >= 0) {
              num = ocrRes.words_result[0].words.split('')[0]
            } else {
              throw new Error('[ERR] no slider number found')
            }
            console.log('[INFO] slider num', num)
          }
        }

        // 获取店铺 URL 和名称信息
        const shops = await page.evaluate(() => {
          const $shops = [...document.querySelectorAll('.exhibition')]
          return $shops.map($shop => {
            const idMatch = $shop.getAttribute('href').match(/\/(.*)/)
            if (idMatch) {
              const [all, id] = idMatch
              const name = $shop.querySelector('.company-name').innerText.replace(/\s/g, '')
              return { id, name }
            } else {
              throw new Error('[ERR] no id matched')
            }
          })
        })
        if (shops.length === 0) {
          throw new Error('[ERR] list not found')
        }

        // 储存店铺数据
        await Promise.all(
          shops.map(shop => new Promise((resolve, reject) => {
            shopCollection.deleteMany({ _id: shop.id }, function (err) {
              if (err) {
                reject(err)
              }
              const data = {
                _id: shop.id,
                name: shop.name,
                referrer: url
              }
              shopCollection.insertOne(data, function (err) {
                if (err) {
                  reject(err)
                } else {
                  resolve()
                }
              })
            })
          }))
        )

        // 储存列表页面数据
        const data = { _id: k, url }
        await new Promise((resolve, reject) => {
          collection.deleteMany({ _id: k }, function (err) {
            if (err) {
              reject(err)
            }
            collection.insertOne(data, function (err) {
              if (err) {
                reject(err)
              } else {
                resolve()
              }
            })
          })
        })

      } catch (err) {
        console.error(err)
        this.addTask(getShopListTask(k, v))
      } finally {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 500))
        if (!noCloseForDebug) {
          await page.close()
        }
      }
    }
  }
}

// 开始任务
connectDB().then(async mongo => {
  const db = mongo.db(config.dbname)
  shopCollection = db.collection('shops')

  /* 排列列表页面任务 */

  const listCollection = db.collection('shop-list-page')
  const finds = await new Promise((resolve, reject) => {
    listCollection.find({}).toArray(function (err, res) {
      if (err) {
        reject(err)
      } else {
        resolve(res)
      }
    })
  })
  const todos = shopListPageTasks.filter(x => !finds.find(y => y._id === x.id)).slice(1)
  console.log(`[INFO] 剩余${todos.length}个列表页任务`)

  await new Crawler({
    collection: listCollection,
    maxConcurrenceCount: 1,
    interval: Math.random() * 500 + 500000,
  })
    .exec(todos)
    .then(() => {
      console.log('[INFO] task done')
    })
    .catch(error => {
      console.error('[ERR] task error : ', error)
    })

  /* 排列列表页面任务 */
  // TODO
})
