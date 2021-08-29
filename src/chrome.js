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
const MINARGS = [
  '--autoplay-policy=user-gesture-required',
  '--disable-background-networking',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-breakpad',
  '--disable-client-side-phishing-detection',
  '--disable-component-update',
  '--disable-default-apps',
  '--disable-dev-shm-usage',
  '--disable-domain-reliability',
  '--disable-extensions',
  '--disable-features=AudioServiceOutOfProcess',
  '--disable-hang-monitor',
  '--disable-ipc-flooding-protection',
  '--disable-notifications',
  '--disable-offer-store-unmasked-wallet-cards',
  '--disable-popup-blocking',
  '--disable-print-preview',
  '--disable-prompt-on-repost',
  '--disable-renderer-backgrounding',
  '--disable-setuid-sandbox',
  '--disable-speech-api',
  '--disable-sync',
  '--hide-scrollbars',
  '--ignore-gpu-blacklist',
  '--metrics-recording-only',
  '--mute-audio',
  '--no-default-browser-check',
  '--no-first-run',
  '--no-pings',
  '--no-sandbox',
  '--no-zygote',
  '--password-store=basic',
  '--use-gl=swiftshader',
  '--use-mock-keychain',
]

// 创建实例以供之后使用
const createInstance = async () => {
  let browser
  try {
    browser = await puppeteer.launch({
      headless: false,
      ignoreHTTPSErrors: true,
      devtools: true,
      userDataDir: '../cache',
      args: [
        ...MINARGS,
        `--disable-extensions-except=${antiCanvasFPExtPath}`,
        `--load-extension=${antiCanvasFPExtPath}`
      ],
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