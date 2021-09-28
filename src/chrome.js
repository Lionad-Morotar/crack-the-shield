const fs = require('fs')
const path = require('path')
const UserAgent = require("user-agents")

const _ = require('lodash')
const request = require('request')
const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
// const UAPlugin = require('puppeteer-extra-plugin-anonymize-ua')

const { isProd, log, dir } = require('../utils')
const { getProxy } = require('./private/dailiyun')
const { proxyURL, getAuthorization } = require('./private/xdaili')
const { getRandomHeaders } = require('./random-headers')

// const USE_PROXY = ''
const PROXE_TYPES_RATIO = {
  'XDAILI': 0,
  'DAILIYUN': 1
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
const BROWSER_POOL = []
const MINARGS = require('./chrome-args.js')

// 创建实例以供之后使用
const createInstance = async (conf) => {
  const { maxTabs = 3 } = Object.assign(conf || {})
  let browser
  // 混淆指纹插件
  const antiCanvasFPExtPath = path.join(__dirname, '../extension/anti-canvas-fp')
  try {
    browser = await puppeteer.launch({
      headless: false,
      // headless: true,
      // headless: isProd,
      ignoreHTTPSErrors: true,
      // devtools: true,
      devtools: false,
      // devtools: !isProd,
      // executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      args: [
        ...MINARGS,
        ...(PROXE_TYPES.filter((x) => x).length === 0
          ? []
          : [
              // `--disable-extensions-except=${antiCanvasFPExtPath}`,
              // `--load-extension=${antiCanvasFPExtPath}`
            ]),
      ],
    });
    /* 存入池中 */
    debugPort = await browser.wsEndpoint()
    const instance = {
      id: String(+new Date()) + '-' + String(Math.random()).slice(-6),
      status: '',
      tabs: 0,
      useTimes: 0,
      port: debugPort,
      isBusy () {
        return this.status === 'reopen'
          ? true
          : maxTabs
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

// 默认打开一些实例
const defaultInstanceCount = 1
let openDefaultInstanceTask
openDefaultInstanceTask = Promise.all(
  Array(defaultInstanceCount)
    .fill('')
    .map(async _ => await getInstance())
)

// 优先从实例池中获取浏览器
async function getInstance (conf) {
  const { maxTabs = 3, useNew = false } = Object.assign(conf || {})
  let instance = null
  let chrome = null
  if (openDefaultInstanceTask) {
    await Promise.all([openDefaultInstanceTask])
  }
  try {
    const leisureInstance = _.shuffle(BROWSER_POOL).find(x => {
      return x.isBusy && !x.isBusy()
    })
    if (leisureInstance) {
      instance = leisureInstance
      // https://github.com/puppeteer/puppeteer/issues/5401
      chrome = await puppeteer.connect({
        browserWSEndpoint: leisureInstance.port
      })
    } else {
      instance = await createInstance({ maxTabs })
      chrome = await puppeteer.connect({
        browserWSEndpoint: instance.port
      })
    }

    /* 根据标签页数量判断浏览器是否空闲 */
    const _newPage = chrome.newPage
    chrome.newPage = async (...args) => {
      const page = await _newPage.bind(chrome)(...args)
      page._instance = instance
      instance.tabs += 1
      const _close = page.close
      page.close = async (...args) => {
        _close.bind(page)(...args)
        instance.tabs -= 1
        instance.useTimes += 1
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
  if (seed && seeds[seed]) {
    headers = Object.assign(seeds[seed], baseHeaders)
  } else {
    const randomHeaders = getRandomHeaders()
    headers = Object.assign(randomHeaders, baseHeaders)
    const seedKey = String(+new Date()) + '-' + String(Math.random()).slice(-6)
    seeds[seedKey] = headers
    page._randomHeaderSeed = seedKey
  }
  await page.setExtraHTTPHeaders(headers)
  return page
}

// 使用自定义 CSS
const useCustomCSS = async (page, cssContent) => {
  await page.evaluateOnNewDocument(async cssContent => {
    document.addEventListener('DOMContentLoaded', () => {
      const $style = document.createElement('style')
      $style.innerHTML = cssContent
      document.querySelector('head').appendChild($style)
    })
  }, cssContent)
  return page
}

const useUA = async (page, ua) => {
  await page.setUserAgent(ua)
  page._ua = ua
  return page
}
const useRandomUA = async (page, conf) => {
  const config = Object.assign({
    deviceCategory: "desktop",
    platform: "Win32",
  }, conf || {})
  const userAgent = new UserAgent(config)
  const userAgentStr = userAgent.toString()
  await page.setUserAgent(userAgentStr)
  page._ua = userAgentStr
  return page
}

/**
 * 使用代理
 * 使用时需要注意 page.on('request') 的顺序
 **/
const useProxy = async (page, proxyReq) => {
  await page.setRequestInterception(true)
  const USE_PROXY = _.shuffle(PROXE_TYPES)[0]
  page._proxyType = USE_PROXY
  const proxy = !USE_PROXY
    ? ''
    : USE_PROXY === 'DAILIYUN'
      ? await getProxy()
      : proxyURL
  if (proxy) {
    log('[INFO] 代理：' + proxy)
  }
  await page.on('request', async req => {
    if (!proxy && isProd) {
      throw new Error(`[ERR] 代理获取错误`)
    }
    try {
      let url = req.url()
      const resType = req.resourceType()
      // 本地代理放行
      if (url.includes('192.168') && !url.includes('9998')) {
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
            headers: (!USE_PROXY || USE_PROXY === 'DAILIYUN')
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
        throw new Error('未知请求错误')
      }
    }
  })
  return page
}

module.exports = {
  /**
   * @see https://pptr.dev/ puppeteer 文档
   **/
  chrome: puppeteer,
  getInstance,
  useProxy,
  useRandomHeaders,
  useCustomCSS,
  useUA,
  useRandomUA,
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