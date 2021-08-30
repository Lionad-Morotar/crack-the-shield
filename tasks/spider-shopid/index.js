const fs = require('fs')
const path = require('path')
const _ = require('lodash')
const UserAgent = require("user-agents")

const connectDB = require('../../src/connect-db')
const Crawler = require('../../src/crawler')
const { getBrowser, useProxy, utils } = require('../../src/chrome')
const { sleep, log } = require('../../utils')
const { waitUntil, waitUntilLoaded, waitUntilPropsLoaded } = require('../../utils/dom')
const pageMap = require('./page.json')
const antiSlider = require('./anti-slider.js')

const isProd = process.env.NODE_ENV === 'production'
const config = isProd
  ? {
    dbname: 'spider',
    baseurl: 'https://spider.test.baixing.cn/'
  } : {
    isDev: true,
    useLocalSliderNum: true,
    dbname: 'spider-test',
    // baseurl: 'http://192.168.1.7:8080/spider-main/'
    baseurl: 'http://192.168.1.7:8080/spider-slider'
    // baseurl: 'https://www.ipaddress.com'
    // baseurl: 'https://www.baidu.com'
  }

// 初始化浏览器
const browser = (async () => await getBrowser())()
const getPage = async () => {
  const instance = await browser
  const page = await instance.newPage()
  await page.setExtraHTTPHeaders({ spider: 'yiguang' })
  await page.evaluateOnNewDocument(waitUntil)
  await page.evaluateOnNewDocument(waitUntilLoaded)
  await page.evaluateOnNewDocument(waitUntilPropsLoaded)
  await page.setViewport(utils.setViewport())
  await page.setRequestInterception(true)
  const userAgent = new UserAgent({
    deviceCategory: "desktop",
    platform: "Win32",
  })
  await page.setUserAgent(userAgent.toString())
  // 屏蔽一些不必要的请求
  await useProxy(page, req => {
    const url = req.url()
    if (
      url.match(/logo_baixing.png/) ||
      url.match(/title.png/) ||
      url.match(/index.css/) ||
      url.match(/bfjs/) ||
      url.match(/jquery.min.js/) ||
      url.match(/script.js/)
    ) {
      req.abort()
      return false
    } else {
      return true
    }
  })
  await page.evaluateOnNewDocument(async () => {
    document.addEventListener('DOMContentLoaded', () => {
      const $style = document.createElement('style')
      $style.innerHTML = `
          .refresh-icon { display: none }
          .verify-img-panel { border-radius: 0 }
        `
      document.querySelector('head').appendChild($style)
    })
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
      const page = await getPage()
      try {
        const url = `${config.baseurl}?p=${v}`
        await sleep(1000)
        await page.goto(url, { waitUntil: 'domcontentloaded' })
        await page.bringToFront()

        /* 滑块验证 */
        await antiSlider(page, config)

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
              throw new Error('no id matched')
            }
          })
        })
        if (shops.length === 0) {
          throw new Error('list not found')
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
        const data = { _id: k, url, store: shops }
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

        log('done one shop-list-task')

      } catch (err) {
        // console.log(err)
        log.error(err.message)
        this.addTask(getShopListTask(k, v))
      } finally {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 500))
        await page.close()
        // await browser.close()
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
  const todos = shopListPageTasks.filter(x => !finds.find(y => y._id === x.id))
  log(`剩余${todos.length}个列表页任务`)

  await new Crawler({
    collection: listCollection,
    maxConcurrenceCount: 1,
    interval: Math.random() * 500 + 50000000,
  })
    .exec(todos)
    .then(() => {
      log(`task done`)
    })
    .catch(error => {
      log.error(`task error ${error.message}`)
    })

  /* 排列列表页面任务 */
  // TODO
})
