const path = require('path')
const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
// const UAPlugin = require('puppeteer-extra-plugin-anonymize-ua')
const { log } = require('../utils')

puppeteer.use(StealthPlugin())
// puppeteer.use(UAPlugin())

// 混淆指纹
antiCanvasFPExtPath = path.join(__dirname, '../extension/anti-canvas-fp')

const MAX = 1
const DEBUG_POINT_POOL = []

// 创建实例以供之后使用
const createInstance = async () => {
  let browser
  try {
    browser = await puppeteer.launch({
      headless: false,
      ignoreHTTPSErrors: true,
      devtools: true,
      args: [
        '--single-process',
        '--disable-gpu',
        '--no-vr-runtime',
        '--no-sandbox',
        '--no-zygote',
        `--disable-extensions-except=${antiCanvasFPExtPath}`,
        `--load-extension=${antiCanvasFPExtPath}`
      ]
    })
    debugPort = await browser.wsEndpoint()
    DEBUG_POINT_POOL.push(debugPort)
    return browser
  } catch (error) {
    log('[ERR]', error)
    browser && browser.close && browser.close()
  }
}

// 如果缓存池有空闲，则从缓存池中取浏览器实例
const getInstance = async () => {
  let chrome = null
  // TODO check busy
  try {
    const port = DEBUG_POINT_POOL.find(x => x)
    if (port) {
      // https://github.com/puppeteer/puppeteer/issues/5401
      chrome = await puppeteer.connect({ browserWSEndpoint: port })
    } else {
      chrome = await createInstance()
    }
  } catch (error) {
    log('[ERR] get instance error', error)
  }
  return chrome
}

module.exports = {
  /**
   * @see https://pptr.dev/ puppeteer 文档
   **/
  chrome: puppeteer,
  getBrowser: getInstance,
  /**
   * 帮助函数
   **/
  utils: {
    setViewport({ width, height } = { width: 1920, height: 1080}) {
      return {
        width: width || 1920,
        height: height || 1080
      }
    }
  }
}