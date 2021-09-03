const fs = require('fs')

const connectDB = require('../../src/connect-db')
const Tasker = require('../../src/tasker')
const { getInstance, useProxy, useRandomHeaders, useCustomCSS, useRandomUA, utils } = require('../../src/chrome')

const { isProd, autoRun, sleep, uuid, dir, log, runCount } = require('../../utils')
const { findInCollection, dropCollection } = require('../../utils/db')
const { waitUntil, waitUntilLoaded, waitUntilPropsLoaded } = require('../../utils/dom')
const preloadFile = fs.readFileSync(dir('src/preload.js'), 'utf8')
const base = require('./config')
const antiSlider = require('./anti-slider.js')

const config = isProd
  ? {
    dbname: 'spider',
    baseurl: `${base.url}`
  } : {
    dbname: 'spider',
    sliderNum: 2,
    // baseurl: 'http://192.168.1.7:9998/spider-list/'
    baseurl: `${base.url}`
    // baseurl: 'http://192.168.1.7:9998/spider-detail/'
    // baseurl: 'http://192.168.1.7:9998/spider-slider/'
  }

let errorAccumulated = 0
const errorAcc = score => {
  errorAccumulated += score
  if (errorAccumulated > 10) {
    process.exit()
  }
}
const errorDec = score => (errorAccumulated -= score)

// 初始化浏览器
const getPage = async () => {
  const chrome = await getInstance()
  const page = await chrome.newPage()
  await useRandomHeaders(page, {
    'spider': 'yiguang',
    'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;'
  })
  await page.setDefaultNavigationTimeout(7 * 1000)
  await page.evaluateOnNewDocument(preloadFile)
  await page.evaluateOnNewDocument(waitUntil)
  await page.evaluateOnNewDocument(waitUntilLoaded)
  await page.evaluateOnNewDocument(waitUntilPropsLoaded)
  await page.setViewport(utils.setViewport())
  await page.setRequestInterception(true)
  await useRandomUA(page)
  // 屏蔽一些不必要的请求
  await useProxy(page, req => {
    const url = req.url()
    // 屏蔽一些不必要的请求
    if (
      url.match(/logo_baixing.png/) ||
      url.match(/title.png/) ||
      url.match(/index.css/) ||
      url.match(/bfjs/) ||
      url.match(/jquery.min.js/) ||
      url.match(/script.js/) ||
      url.match(/s.png/)
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
  `)
  return page
}

// 创建店铺列表页任务
let shopCollection = null
let shopListCollection = null
function createShopListTask(shoplist) {
  const { _id, url } = shoplist
  return {
    id: _id,
    async run({ artifact }) {
      const startTime = +new Date()
      const page = artifact || (await getPage())
      const isPageUsed = page === artifact
      try {
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

        // 等待列表加载完毕
        await page.evaluate(async () => {
          await waitUntil(() => {
            const $elm = document.querySelectorAll('.exhibition')
            return $elm.length === 10
          }, 10 * 1000)
        })

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
              log.error('没有匹配到列表中某个店铺的数据')
              return { id: '-', name: '-' }
            }
          })
        })

        // 找到下一页
        // const nextParams = await page.evaluate(() => {
        //   const $next = document.querySelector('.go-page.next')
        //   return $next && $next.getAttribute('href')
        // })
        // const nextPage = nextParams
        //   ? config.baseurl + nextParams
        //   : null

        // 储存店铺数据
        await Promise.all(
          shops.map((shop, idx) => new Promise((resolve, reject) => {
            const shopID = isProd
              ? shop.id
              : uuid()
            shopCollection.find({ _id: shopID }).toArray((err, res) => {
              if (err) {
                log.error('保存前校验店铺数据错误')
                reject(err)
              } else {
                if (res.length > 0) {
                  if (isProd) {
                    log('重复的！不用保存了！可恶哇！')
                  }
                  resolve()
                } else {
                  const data = {
                    _id: shopID,
                    idx: ((+_id - 1) * 10) + idx + 1,
                    name: shop.name,
                    referer: url,
                    ua: page._ua,
                    version: runCount,
                    done: false
                  }
                  shopCollection.insertOne(data, function (err) {
                    if (err) {
                      log.error('储存店铺数据错误')
                      reject(err)
                    } else {
                      resolve()
                    }
                  })
                }
              }
            })
          }))
        ).catch(error => {
          throw new Error(error)
        })

        // 储存列表页面数据
        await new Promise((resolve, reject) => {
          shopListCollection.deleteMany({ _id }, err => {
            if (err) {
              log('保存前删除列表页面数据错误')
              reject(err)
            }
            const data = {
              _id,
              url,
              // next: nextPage,
              shops,
              version: runCount,
              done: true
            }
            shopListCollection.insertOne(data, err => {
              if (err) {
                log('储存列表页数据错误')
                reject(err)
              } else {
                resolve()
                // if (nextPage) {
                  // shopListCollection.deleteMany({ _id: _id + 1 }, err => {
                  //   if (err) {
                  //     log('保存前删除列表页面数据错误')
                  //     reject(err)
                  //   }
                  //   const nextTask = {
                  //     _id: _id + 1,
                  //     // url: nextPage,
                  //     done: false
                  //   }
                  //   shopListCollection.insertOne(nextTask, err => {
                  //     if (err) {
                  //       log('储存列表页数据错误')
                  //       reject(err)
                  //     }
                  //     this.addTask(createShopListTask(nextTask))
                  //     resolve()
                  //   })
                  // })
                // }
              }
            })
          })
        }).catch(error => {
          throw new Error(error)
        })

        const endTime = +new Date()
        log(`DONE in ${endTime - startTime}ms：NO.${_id} ${url}`)

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

        // !isProd && (
        //   console.error(err),
        //   await sleep(1000 * 1000)
        // )
        log.error(err.message)
        this.addTask(createShopListTask(shoplist))
        page && (await page.close())
        errorAcc(1)

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
  shopListCollection = db.collection('shop-list')

  // if (!isProd) {
  //   await dropCollection(shopListCollection)
  //   await dropCollection(shopCollection)
  // }

  const runShopListTasks = async () => {
    // let nextTask = 
    //   (await findInCollection(shopListCollection, { done: false }))[0] ||
    //   ({ _id: 1, url: config.baseurl, done: false })
    // const todos = [nextTask].map(x => createShopListTask(x))
    // log(`START FROM SHOP NO.${todos[0].id}`)

    const finds = await findInCollection(shopListCollection)
    const todos = finds.filter(x => !x.done).map(x => createShopListTask(x))
    log(`剩余${todos.length}个列表页任务`)
  
    const taskConf = {
      maxConcurrenceCount: 1,
      interval: () => Math.random() * 500 + 100,
    }
    await new Tasker(taskConf)
      .start(todos)
      .then(() => log(`【TASK DONE】`))
      .catch(error => log.error(`【TASK ERROR】 ${error.message}`))
  }

  autoRun(runShopListTasks, {
    name: '店铺列表页任务'
  })
})
