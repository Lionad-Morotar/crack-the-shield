const fs = require('fs')
const path = require('path')
const request = require('request')
const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
// const UAPlugin = require('puppeteer-extra-plugin-anonymize-ua')

const { log, dir } = require('../utils')
const { getProxy } = require('./private/dailiyun')
const { proxyURL, getAuthorization } = require('./private/xdaili')

const USE_PROXY = 'XDAILI'
// const USE_PROXY = 'DAILIYUN'

puppeteer.use(StealthPlugin())
// puppeteer.use(UAPlugin())

// 混淆指纹
antiCanvasFPExtPath = path.join(__dirname, '../extension/anti-canvas-fp')

const verifySlideMainCSS = fs.readFileSync(dir('statics/verifySlide.main.css'))
const verifySlideMainJS = fs.readFileSync(dir('statics/verifySlide.main.js'))

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

/**
 * 使用代理
 * 使用时需要注意 page.on('request') 的顺序
 **/
const useProxy = async (page, proxyReq) => {
  await page.setRequestInterception(true)
  const proxy = USE_PROXY === 'DAILIYUN'
    ? await getProxy()
    : proxyURL
  // console.log('[INFO] proxy', proxy)
  await page.on('request', async req => {
    try {
      let url = req.url()
      const resType = req.resourceType()
      // 本地代理放行
      if (url.includes('192.168')) {
        return req.continue()
      }
      // 内联图片放行 
      if (url.includes('base64')) {
        return req.continue()
      }
      // 代理部分静态资源到本地
      if (url.startsWith('https://file.baixing.net')) {
        let body
        if (url === 'https://file.baixing.net/verifySlide/1.0.4/main.css')
          body = verifySlideMainCSS
        if (url === 'https://file.baixing.net/verifySlide/1.0.4/main.js')
          body = verifySlideMainJS
        return req.respond({
          status: 200,
          headers: req.headers,
          body: body.toString(),
        })
      }
      // 中间件
      if (proxyReq) {
        const continueReq = proxyReq(req)
        if (!continueReq) {
          return
        }
      }
      // 代理请求
      if (['document', 'xhr'].includes(resType)) {
        const response = await new Promise(async (resolve, reject) => {
          request({
            url,
            method: req.method(),
            strictSSL: false,
            followRedirect: false,
            headers: USE_PROXY === 'DAILIYUN'
              ? req.headers()
              : {
                ...req.headers(),
                'proxy-authorization': getAuthorization(),
                'Proxy-Authorization': getAuthorization()
              },
            proxyHeaderWhiteList: [
              'proxy-authorization',
              'Proxy-Authorization'
            ],
            body: req.postData(),
            proxy,
            tunnel: true
          }, (err, proxedResponse) => {
            if (err) {
              reject(err)
            } else {
              console.log(`[INFO] proxy res`, proxedResponse.statusCode)
              resolve(proxedResponse)
            }
          })
        })
        return req.respond({
          status: response.statusCode,
          contentType: response.headers['content-type'],
          headers: response.headers,
          body: response.body,
        })
      } else {
        req.continue()
      }
    } catch (e) {
      console.error('[ERR]', e)
      if ((e.message || '').match(/tunneling socket/)) {
        throw new Error('代理异常')
      }
      // 不要暴露真实IP
      // req.continue()
    }
  })
}

module.exports = {
  /**
   * @see https://pptr.dev/ puppeteer 文档
   **/
  chrome: puppeteer,
  getBrowser: getInstance,
  useProxy,
  /**
   * 帮助函数
   **/
  utils: {
    setViewport({ width, height } = { width: 1366, height: 768}) {
      return {
        width: width || 1366,
        height: height || 768
      }
    }
  }
}