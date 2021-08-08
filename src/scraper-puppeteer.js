/**
 * @origin https://github.com/website-scraper/website-scraper-puppeteer
 * @modified by Lionad tangnad@qq.com
 */

const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')

const { notEmpty } = require('../utils')

puppeteer.use(StealthPlugin())

// 页面打开时预加载的JS文件
const preloadFile = fs.readFileSync(path.join(__dirname, './preload.js'), 'utf8')

class PuppeteerPlugin {
  constructor({
    launchOptions = {},
    pageOptions = {},
    scrollToBottom = null,
    blockNavigation = false
  } = {}) {
    this.launchOptions = launchOptions
    this.scrollToBottom = scrollToBottom
    this.blockNavigation = blockNavigation
    this.browser = null
    this.headers = {}
  }

  apply(registerAction) {
    registerAction('beforeStart', async () => {
      this.browser = await puppeteer.launch(this.launchOptions)
    })

    registerAction('afterResponse', async ({ response }) => {
      const isHtml = () => {
        const contentType = (response.headers['content-type'] || '').toLowerCase()
        return contentType.includes('text/html')
      }
      if (isHtml()) {
        const url = response.request.href
        const page = await this.browser.newPage()
        await page.setDefaultNavigationTimeout(60000)
        await page.setViewport({ width: 1920, height: 1080 })

        if (notEmpty(this.headers)) {
          await page.setExtraHTTPHeaders(this.headers)  
        }

        if (this.blockNavigation) {
          await blockNavigation(page, url)
        }

        // 禁用默认 querySelector 反反爬
        await page.evaluateOnNewDocument(preloadFile)

        await page.goto(url, { waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(30000)

        if (this.scrollToBottom) {
          await scrollToBottom(page, this.scrollToBottom.timeout, this.scrollToBottom.viewportN)
        }

        const content = await page.content()
        await page.close()

        // convert utf-8 -> binary string because website-scraper needs binary
        return Buffer.from(content).toString('binary')
      } else {
        return response.body
      }
    })

    registerAction('beforeRequest', async ({ resource, requestOptions }) => {
      if (notEmpty(requestOptions.headers)) {
        this.headers = Object.assign({}, requestOptions.headers)
      }
      return { requestOptions }
    })

    registerAction('afterFinish', () => this.browser && this.browser.close())
  }
}

async function scrollToBottom(page, timeout, viewportN) {
  await page.evaluate(async (timeout, viewportN) => {
    await new Promise((resolve, reject) => {
      let totalHeight = 0, distance = 200, duration = 0, maxHeight = window.innerHeight * viewportN
      const timer = setInterval(() => {
        duration += 200
        window.scrollBy(0, distance)
        totalHeight += distance
        if (totalHeight >= document.body.scrollHeight || duration >= timeout || totalHeight >= maxHeight) {
          clearInterval(timer)
          resolve()
        }
      }, 200)
    })
  }, timeout, viewportN)
}

async function blockNavigation(page, url) {
  page.on('request', req => {
    if (req.isNavigationRequest() && req.frame() === page.mainFrame() && req.url() !== url) {
      req.abort('aborted')
    } else {
      req.continue()
    }
  })
  await page.setRequestInterception(true)
}

module.exports = PuppeteerPlugin
