const _ = require('lodash')
const UserAgent = require("user-agents")

const connectDB = require('../../src/connect-db')
const Crawler = require('../../src/crawler')
const { getInstance, useProxy, useRandomHeaders, utils } = require('../../src/chrome')

const { autoRun, sleep, log } = require('../../utils')
const { findInCollection } = require('../../utils/db')
const { waitUntil, waitUntilLoaded, waitUntilPropsLoaded } = require('../../utils/dom')

const base = require('./config')
const pageMap = require('./page.json')
const antiSlider = require('./anti-slider.js')

const isProd = process.env.NODE_ENV === 'production'
const config = isProd
  ? {
    dbname: 'spider',
    baseurl: `${base.url}/`
  } : {
    dbname: 'spider-test',
    // baseurl: 'http://192.168.1.7:8080/spider-main/'
    // baseurl: 'http://192.168.1.7:8080/spider-slider'
  }

// 初始化浏览器
const getPage = async () => {
  const chrome = await getInstance()
  const page = await chrome.newPage()
  await useRandomHeaders(page, {
    spider: 'yiguang',
    'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;'
  })
  await page.setDefaultNavigationTimeout(8 * 1000)
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
    async run({ collection, artifact }) {
      const page = artifact || (await getPage())
      const isPageUsed = page === artifact
      try {
        const url = `${config.baseurl}?p=${v}`
        !isPageUsed && (await sleep(1000))
        await page.goto(url, { waitUntil: 'domcontentloaded' })
        await page.bringToFront()

        /* 滑块验证 */
        const sliderRes = await antiSlider(page, config)
        if (isPageUsed) {
          if (sliderRes !== 'skip') {
            isPageUsed
          }
          page._noUseMore = false
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
                console.log('保存前删除店铺数据错误')
                reject(err)
              }
              const data = {
                _id: shop.id,
                name: shop.name,
                referrer: url
              }
              shopCollection.insertOne(data, function (err) {
                if (err) {
                  console.log('储存店铺数据错误')
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
              console.log('保存前删除列表页面数据错误')
              reject(err)
            }
            collection.insertOne(data, function (err) {
              if (err) {
                console.log('储存列表页数据错误')
                reject(err)
              } else {
                resolve()
              }
            })
          })
        })

        log(`DONE：${url} ${shops.length}`)

        await page.close()
        // page._useTime = (page._useTime || 0) + 1
        // const useMore = !page._noUseMore && (page._useTime < 20)
        // if (useMore) {
        //   return page
        // }

      } catch (err) {

        console.log(err)
        log.error(err.message)
        this.addTask(getShopListTask(k, v))
        // await sleep(1000 * 1000)
        await page.close()

      } finally {
        // await chrome.close()
      }
    }
  }
}

// 开始任务
connectDB().then(async mongo => {
  const db = mongo.db(config.dbname)
  shopCollection = db.collection('shops')
  const listCollection = db.collection('shop-list')

  const runShopListTasks = async () => {
    const allLists = await findInCollection(listCollection)
    const todos = shopListPageTasks.filter(x => !allLists.find(y => y._id === x.id))
    log(`剩余${todos.length}个列表页任务`)
  
    await new Crawler({
      collection: listCollection,
      maxConcurrenceCount: 1,
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

  autoRun(runShopListTasks, {
    name: '店铺列表页任务'
  })
})
