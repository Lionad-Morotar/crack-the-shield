const fs = require('fs')
const path = require('path')

const _ = require('lodash')
const request = require('request')
const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
// const UAPlugin = require('puppeteer-extra-plugin-anonymize-ua')

const { log, dir } = require('../utils')
const { getProxy } = require('./private/dailiyun')
const { proxyURL, getAuthorization } = require('./private/xdaili')
const { getRandomHeaders } = require('./random-headers')

const isProd = process.env.NODE_ENV === 'production'

// const USE_PROXY = ''
const PROXE_TYPES_RATIO = {
  'XDAILI': 5,
  'DAILIYUN': 5
}
const PROXE_TYPES = Object.entries(PROXE_TYPES_RATIO).reduce((h, [k, v]) => {
  h = h.concat(...Array(v).fill(k))
  return h
}, [])

puppeteer.use(StealthPlugin())
// puppeteer.use(UAPlugin())

const verifySlideMainCSS = fs.readFileSync(dir('statics/verifySlide.main.css'))
const verifySlideMainJS = fs.readFileSync(dir('statics/verifySlide.main.js'))

// TODO max instance num
let BROWSER_POOL = []
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
  /**
   * remove cors
   * @see https://github.com/puppeteer/puppeteer/issues/4889
   **/
  '--disable-features=OutOfBlinkCors',
  '--disable-web-security',
  /* remove cors end */
]

// 创建实例以供之后使用
const createInstance = async ({ maxTabs }) => {
  let browser
  // 混淆指纹插件
  const antiCanvasFPExtPath = path.join(__dirname, '../extension/anti-canvas-fp')
  try {
    browser = await puppeteer.launch({
      headless: true,
      // headless: false,
      ignoreHTTPSErrors: true,
      devtools: !isProd,
      // executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      args: [
        ...MINARGS,
        ...(PROXE_TYPES.filter(x => x).length === 0 ? [] : [
          `--disable-extensions-except=${antiCanvasFPExtPath}`,
          `--load-extension=${antiCanvasFPExtPath}`
        ])
      ],
    })
    /* 存入池中 */
    debugPort = await browser.wsEndpoint()
    const instance = {
      id: String(+new Date()) + '-' + String(Math.random()).slice(-6),
      tabs: 0,
      port: debugPort,
      isBusy () {
        // console.log(`${this.id} tabs num: ${this.tabs}`)
        return maxTabs
          ? this.tabs >= maxTabs
          : false
      }
    }
    BROWSER_POOL.push(instance)
    return instance
  } catch (error) {
    log('[ERR]', error)
    browser && browser.close && browser.close()
  }
}

// 优先从实例池中获取浏览器
const getInstance = async ({ maxTabs = 3 }) => {
  let instance = null
  let chrome = null
  try {
    BROWSER_POOL = _.shuffle(BROWSER_POOL)
    const noBusyInstance = BROWSER_POOL.find(x => {
      return x.isBusy && !x.isBusy()
    })
    if (noBusyInstance) {
      instance = noBusyInstance
      // https://github.com/puppeteer/puppeteer/issues/5401
      chrome = await puppeteer.connect({
        browserWSEndpoint: noBusyInstance.port
      })
    } else {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 300))
      instance = await createInstance({ maxTabs })
      chrome = await puppeteer.connect({
        browserWSEndpoint: instance.port
      })
    }

    /* 根据标签页数量判断浏览器是否空闲 */
    const _newPage = chrome.newPage
    chrome.newPage = async (...args) => {
      const page = await _newPage.bind(chrome)(...args)
      instance.tabs += 1
      const _close = page.close
      page.close = async (...args) => {
        _close.bind(page)(...args)
        instance.tabs -= 1
      }
      page._timeRatio = 1
      return page
    }
    
  } catch (error) {
    log('[ERR] get instance error', error)
  }

  return chrome
}

// 退出命令行时关闭浏览器（防止内存泄漏）
process.on('SIGINT', async function () {
  await Promise.all([
    ...BROWSER_POOL.map(async port => {
      return new Promise(async resolve => {
        try {
          chrome = await puppeteer.connect({
            browserWSEndpoint: port
          })
          chrome.close && chrome.close()
          resolve()
        } catch (e) {
          throw new Error('[ERR] error when SIGINT', e)
        }
      })
    })
  ]).catch(e => {
    console.log('[ERR] error when SIGINT', e)
  }).finally(() => {
    process.exit()
  })
})

const seeds = {}
const useRandomHeaders = async (page, baseHeaders, seed) => {
  let headers
  if (seed) {
    headers = Object.assign(seeds[seed], baseHeaders)
  } else {
    const randomHeaders = getRandomHeaders()
    headers = Object.assign(randomHeaders, baseHeaders)
    page._randomHeaderSeed = String(+new Date()) + '-' + String(Math.random()).slice(-6)
  }
  await page.setExtraHTTPHeaders(headers)
  return page
}

/**
 * 使用代理
 * 使用时需要注意 page.on('request') 的顺序
 **/
const useProxy = async (page, proxyReq) => {
  await page.setRequestInterception(true)
  const USE_PROXY = _.shuffle(PROXE_TYPES)[0]
  page._USE_PROXY = USE_PROXY
  const proxy = USE_PROXY === ''
    ? ''
    : USE_PROXY === 'DAILIYUN'
      ? await getProxy()
      : proxyURL
  if (proxy) {
    log('[INFO] 代理：' + proxy)
  }
  await page.on('request', async req => {
    if (!proxy) {
      throw new Error(`[ERR] 代理获取错误`)
    }
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
      if (
        url.startsWith('https://file.baixing.net')
      ) {
        let body
        if (url === 'https://file.baixing.net/verifySlide/1.0.4/main.css') {
          body = verifySlideMainCSS
        } else if (url === 'https://file.baixing.net/verifySlide/1.0.4/main.js') {
          body = verifySlideMainJS
        }
        if (body) {
          return req.respond({
            status: 200,
            headers: req.headers,
            body,
          })
        } else {
          return req.continue()
        }
      }
      // 中间件
      if (proxyReq) {
        const continueReq = proxyReq(req)
        if (!continueReq) {
          return
        }
      }
      // 代理请求
      if (proxy && ['document', 'xhr'].includes(resType)) {
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
          }, (err, response) => {
            if (err) {
              reject(err)
            } else {
              if (proxy) {
                console.log(`[INFO] ProxyResCode`, response.statusCode)
              }
              resolve(response)
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
      if ((e.message || '').match(/tunneling socket/)) {
        throw new Error('代理异常')
      } else {
        console.error('[ERR]', e)
        throw new Error('未知请求错误')
      }
      // * 不要暴露真实IP
      // req.continue()
    }
  })
}

module.exports = {
  /**
   * @see https://pptr.dev/ puppeteer 文档
   **/
  chrome: puppeteer,
  getInstance,
  useProxy,
  useRandomHeaders,
  /**
   * 帮助函数
   **/
  utils: {
    setViewport({ width, height } = { width: 1920, height: 1080 }) {
      return {
        width: width || 1920,
        height: height || 1080
      }
    }
  }
}