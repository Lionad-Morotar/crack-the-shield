const fs = require('fs')
const path = require('path')

const { dir, mkdir, sleep } = require('../utils')
const { waitUntilLoaded, waitUntilJSLoaded, styles } = require('../utils/dom')
const { getBrowser, utils } = require('../src/chrome')
const preloadFile = fs.readFileSync(path.join(__dirname, '../src/preload.js'), 'utf8')
const socketIOFile = fs.readFileSync(path.join(__dirname, '../statics/socket.io.min.js'), 'utf8')

const [_, __, url] = process.argv
console.log('url:', url)

!(async () => {
  try {
    const browser = await getBrowser()
    const page = await browser.newPage()
    await page.setViewport(utils.setViewport())
    await page.evaluateOnNewDocument(preloadFile)
    await page.evaluateOnNewDocument(waitUntilLoaded)
    await page.evaluateOnNewDocument(waitUntilJSLoaded)
    await page.evaluateOnNewDocument(styles)

    // TODO canvas toString
    // TODO check load
    // TODO load local socket.io

    /* 请求拦截器 */
    await page.setRequestInterception(true)
    page.on('request', req => {
      const url = req.url()
      // 不加载广告图片，提高速度
      if (url.match(/pexels-photo/)) {
        req.abort()
        return
      }
      // 不加载某些外部脚本，提高响应速度
      if (
        url.match(/loaded.js/) ||
        url.match(/socket.io.min.js/)
      ) {
        req.abort()
        return
      }
      req.continue()
    })
    await page.evaluateOnNewDocument((socketIOFile) => {
      document.addEventListener('DOMContentLoaded', () => {

        // 自定义样式
        const $style = document.createElement('style')
        $style.innerHTML = `
          .ad-list { display: none }
          .official-nav-phone-block { padding: 20px }
          #addressText { padding: 20px }
          #addressText::before { content: '！' }
        `
        document.querySelector('head').appendChild($style)

        // 加载本地 socket.io
        const $script = document.createElement('script')
        $script.innerHTML = socketIOFile
        document.body.appendChild($script)
      })
    }, socketIOFile)

    const data = { uid: '', name: '', hotline: '', mobile: '', owner: '', address: '' }
    
    // TODO 超时
    // TODO referer
    // await page.goto('http://www.baidu.com', { waitUntil: 'domcontentloaded' })
    await page.goto(url)
    await page.evaluate(async () => await window.waitUntilJSLoaded('io'))
    console.log('io')
    const $document = await page.evaluateHandle(() => document)

    // 获取 UID
    data.uid = await page.evaluate(() => uid)

    // 获取标题内容
    data.name = await page.evaluate(
      document => document.querySelector('.company-name').innerText,
      $document
    )

    // 获取手机号和号主
    // await page.hover('#view-owner')
    // console.log('down')
    // await page.evaluate(() => {
    //   const io = io(wsUrl, { transports: 'websocket' })
    // })

    const pageDir = dir('spider-test/', data.name)
    await mkdir(pageDir, true)

    // 热线
    await page.evaluate(async () => await window.waitUntilLoaded('.official-nav-phone-block'))
    const $hotline = await page.evaluateHandle(() => document.querySelector('.official-nav-phone-block'))
    await $hotline.screenshot({
      path: dir.join(pageDir, 'hotline.png')
    })

    // 地址
    await page.evaluate(async () => await window.waitUntilLoaded('#addressText'))
    const $address = await page.evaluateHandle(() => document.querySelector('#addressText'))
    await $address.screenshot({
      path: dir.join(pageDir, 'address.png')
    })

    await fs.writeFileSync(dir.join(pageDir, 'data.json'), JSON.stringify(data))

    // await page.screenshot({ path: 'test.png' })

  } catch (error) {
    console.log(error)
  }
})()