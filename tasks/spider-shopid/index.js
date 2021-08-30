const fs = require('fs')
const path = require('path')
const _ = require('lodash')
const UserAgent = require("user-agents")

const ocr = require('../../plugins/ocr')
const rembrandt = require('../../plugins/rembrandt')
const connectDB = require('../../src/connect-db')
const Crawler = require('../../src/crawler')
const { getBrowser, useProxy, utils } = require('../../src/chrome')
const { findTroughs, sleep } = require('../../utils')
const { waitUntilLoaded, waitUntilPropsLoaded } = require('../../utils/dom')
const pageMap = require('./page.json')

const slider_1_raw = fs.readFileSync(path.join(__dirname, './sliders/slider-1-raw.png'))
const slider_2_raw = fs.readFileSync(path.join(__dirname, './sliders/slider-2-raw.png'))
const slider_3_raw = fs.readFileSync(path.join(__dirname, './sliders/slider-3-raw.png'))
const slider_1_s1 = fs.readFileSync(path.join(__dirname, './sliders/slider-1-s1.png'))
const slider_2_s1 = fs.readFileSync(path.join(__dirname, './sliders/slider-2-s1.png'))
const slider_3_s1 = fs.readFileSync(path.join(__dirname, './sliders/slider-3-s1.png'))
const slider_1_s05 = fs.readFileSync(path.join(__dirname, './sliders/slider-1-s05.png'))
const slider_2_s05 = fs.readFileSync(path.join(__dirname, './sliders/slider-2-s05.png'))
const slider_3_s05 = fs.readFileSync(path.join(__dirname, './sliders/slider-3-s05.png'))
const slider_s05 = {
  1: slider_1_s05,
  2: slider_2_s05,
  3: slider_3_s05
}
const slider_s1 = {
  1: slider_1_s1,
  2: slider_2_s1,
  3: slider_3_s1
}

const isProd = process.env.NODE_ENV === 'production'
const noCloseForDebug = isProd ? false : true
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
  await page.setDefaultTimeout(60 * 1000)
  await page.setExtraHTTPHeaders({ spider: 'yiguang' })
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
// TODO 出错自动重试机制
function getShopListTask(k, v) {
  return {
    id: k,
      async run({ collection }) {
      const page = await getPage()
      await page.bringToFront()
      try {
        await sleep(3 * 1000)
        const url = `${config.baseurl}?p=${v}`
        await page.goto(url, { waitUntil: 'domcontentloaded' })

        await sleep(1000 * 1000)

        /* 滑块验证 */
        const $slider = await page.evaluate(() => document.querySelector('.verify-img-panel'))
        if ($slider) {

          // 等子滑块加载完毕...
          await page.evaluateHandle(() => document.querySelector('.verify-sub-block img'))

          const sliderImgBase64 = await page.evaluate(async () => (
            await waitUntilPropsLoaded('src', () => {
              const $elm = document.querySelector('.verify-img-panel img')
              return $elm && $elm.getAttribute('src')
            }, 10 * 1000))
          )

          // 找到要滑到第几个滑块
          let num
          if (config.useLocalSliderNum) {
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

          // 找到是哪种类型的 slider
          const $sliderImg = await page.evaluateHandle(() => document.querySelector('.verify-img-panel img'))
          const sliderImg = await $sliderImg.screenshot()
          const typeRes = await Promise.all([
            rembrandt({
              imageA: sliderImg,
              imageB: slider_1_raw
            }),
            rembrandt({
              imageA: sliderImg,
              imageB: slider_2_raw
            }),
            rembrandt({
              imageA: sliderImg,
              imageB: slider_3_raw
            }),
          ])
          const minDifferences = Math.min(...typeRes.map(x => x.differences))
          const sliderTemplateID = typeRes.findIndex(x => x.differences === minDifferences) + 1
          if (sliderTemplateID) {
            console.log('[INFO] slider template', sliderTemplateID)
          } else {
            throw new Error('[ERR] no slider type found')
          }

          // 设置滑块样式以方便图片比较
          const $sliderFloat = await page.evaluateHandle(() => document.querySelector('.verify-sub-block img'))
          await page.evaluate(async $sliderFloat => {
            console.log('$sliderFloat', $sliderFloat)
            $sliderFloat.setAttribute('style', 'filter:grayscale(1) brightness(.95) drop-shadow(0 0 2px #888);left: 0px')
          }, $sliderFloat)

          // 设置滑块图片样式以方便图片比较
          const $sliderBG =await page.evaluateHandle(() => document.querySelector('.verify-img-panel .block-bg'))
          await page.evaluate(async $sliderBG => {
            $sliderBG.setAttribute('style', 'filter:grayscale(1)')
          }, $sliderBG)

          // 用 10px 的速度取得局部最优解
          const $slider =await page.evaluateHandle(() => document.querySelector('.verify-slide'))
          await page.evaluate(async $slider => {
            $slider.setAttribute('style', 'transform:scale(0.5)')
          }, $slider)
          const res10px = []
          // 计算匹配程度
          let left = 85
          while (left <= 395) {
            await page.evaluate(async ($sliderFloat, left) => {
              const rawStyle = $sliderFloat.getAttribute('style')
              $sliderFloat.setAttribute('style', rawStyle.replace(/left:\s*\d+px/, `left: ${left}px`))
            }, $sliderFloat, left)
            const $panel = await page.evaluateHandle(() => document.querySelector('.verify-img-panel'))
            const panelImgBase64 = await $panel.screenshot({
              type: 'jpeg'
            })
            const compareRes = await rembrandt({
              imageA: panelImgBase64,
              imageB: slider_s05[sliderTemplateID]
            })
            res10px.push({
              left,
              diff: compareRes.differences
            })
            left += 15
          }

          // 过滤出3个波谷
          let res10px3left
          const res10pxThroughIdxs = findTroughs(res10px.map(x => x.diff))
          if (res10pxThroughIdxs.length === 3) {
            res10px3left = res10pxThroughIdxs.map(x => res10px[x])
          } else if (res10pxThroughIdxs.length > 3) {
            // 类聚阈值从 1 开始扩增直到只留下 3 个波谷
            // @see 调试可使用网站 https://echarts.apache.org/examples/zh/editor.html?c=line-simple
            let group = [], count = 10, threshold = 0
            while (count && (group.length !== 3)) {
              count--
              threshold++
              group = res10pxThroughIdxs.reduce((h, c) => {
                const find = h.find(x => Math.abs(x - c) <= threshold)
                if (find) {
                  const leftItem = res10px[find].diff < res10px[c].diff ? find : c
                  if (leftItem === c) {
                    h.splice(h.findIndex(x => x === find), 1, c)
                  }
                } else {
                  h.push(c)
                }
                return h
              }, [])
            }
            if (!count) {
              throw new Error('[ERR] throughs not found')
            }
            if (group.length === 3) {
              res10px3left = group.map(x => res10px[x])
            }
          } else {
            throw new Error('[ERR] throughs not enough')
          }

          // 遍历取得最优解
          await page.evaluate(async $slider => {
            $slider.setAttribute('style', '')
          }, $slider)
          const mudLeft = res10px3left[num - 1].left
          left = mudLeft - 7
          const res1px = []
          while (left <= mudLeft + 7) {
            await page.evaluate(async ($sliderFloat, left) => {
              const rawStyle = $sliderFloat.getAttribute('style')
              $sliderFloat.setAttribute('style', rawStyle.replace(/left:\s*\d+px/, `left: ${left}px`))
            }, $sliderFloat, left)
            const $panel = await page.evaluateHandle(() => document.querySelector('.verify-img-panel'))
            const panelImgBase64 = await $panel.screenshot({
              type: 'jpeg'
            })
            const compareRes = await rembrandt({
              imageA: panelImgBase64,
              imageB: slider_s1[sliderTemplateID]
            })
            res1px.push({
              left,
              diff: compareRes.differences
            })
            left += 1
          }
          const min1pxDiff = Math.min(...res1px.map(x => x.diff))
          const exactLeft = res1px.find(x => x.diff === min1pxDiff).left

          // 重置样式
          await page.evaluate(async $sliderFloat => {
            console.log('$sliderFloat', $sliderFloat)
            $sliderFloat.setAttribute('style', '')
          }, $sliderFloat)
          await page.evaluate(async $sliderBG => {
            $sliderBG.setAttribute('style', '')
          }, $sliderBG)

          // 开始移动滑块
          const $move = await page.evaluateHandle(() => document.querySelector('.verify-move-block'))
          const moveBox = await $move.boundingBox()
          await page.mouse.move(
            moveBox.x + moveBox.width / 2,
            moveBox.y + moveBox.height / 2
          )
          await page.mouse.down()
          await sleep(Math.random() * 500 + 500)
          await page.mouse.move(
            moveBox.x + exactLeft,
            moveBox.y + moveBox.height / 2,
            { steps: 8 }
          )
          await page.mouse.up()

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

        console.log('[INFO] done one shop-list-task')

      } catch (err) {
        console.error(err)
        this.addTask(getShopListTask(k, v))
      } finally {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 500))
        if (!noCloseForDebug) {
          // await page.close()
          // await browser.close()
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
  const todos = shopListPageTasks.filter(x => !finds.find(y => y._id === x.id))
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
