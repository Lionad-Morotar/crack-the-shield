const fs = require('fs')
const path = require('path')

const ocr = require('../plugins/ocr')
const { dir, mkdir, sleep, filterSpace } = require('../utils')
const { waitUntilLoaded, waitUntilPropsLoaded, styles } = require('../utils/dom')
const { getInstance, utils } = require('../src/chrome')
const preloadFile = fs.readFileSync(path.join(__dirname, '../src/preload.js'), 'utf8')
const socketIOFile = fs.readFileSync(path.join(__dirname, '../statics/socket.io.min.js'), 'utf8')

const [_, __, url] = process.argv
console.log('url:', url)

!(async () => {
  try {
    const browser = await getInstance()
    const page = await browser.newPage()
    await page.setViewport(utils.setViewport())
    await page.evaluateOnNewDocument(preloadFile)
    await page.evaluateOnNewDocument(waitUntilLoaded)
    await page.evaluateOnNewDocument(waitUntilPropsLoaded)
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
        url.match(/script.js/) ||
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
          .official-nav-phone-block {
            padding: 20px;
            background: #ff4466;
          }
          #addressText {
            padding: 20px;
            font-weight: normal;
            letter-spacing: 1px;
          }
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
    await page.evaluate(async () => await waitUntilPropsLoaded('io'))
    const $document = await page.evaluateHandle(() => document)

    // 获取 UID
    data.uid = await page.evaluate(() => uid)

    // 获取标题内容
    data.name = await page.evaluate(
      document => document.querySelector('.company-name').innerText,
      $document
    )

    // 获取手机号和号主
    await page.hover('#view-owner')
    const [owner, mobile] = await page.evaluate(() => Promise.race([
      Promise.all([
        new Promise(resolve => {
          const ws = io(wsUrl, { transports: ['websocket'] })
          ws.on('connect', () => {
            ws.emit('i-want-a-name', uid, owner => resolve(owner))
          })
        }),
        new Promise(resolve => {
          $.ajax({
            url: '/detail/' + uid + '/mobile',
            success (res) {
              const decodeMobile = (base64) => {
                let mobile = ''
                const numStr = window.atob(base64)
                for (let i = 0; i < numStr.length; i++) {
                  mobile += String.fromCharCode(
                    numStrcharCodeAt(i) - 10
                  )
                }
                return mobile
              }
              const mobile = decodeMobile(res.data)
              resolve(mobile)
            }
          })
        })
      ]),
      new Promise(resolve => {
        setTimeout(() => {
          console.log('[INFO] get owner and mobile failed')
          resolve(['-', '-'])
        }, (Math.random() * 1000 + 2000))
      })
    ]))
    data.owner = owner
    data.mobile = mobile

    const pageDir = dir('spider-test/', data.name)
    await mkdir(pageDir, true)

    // 热线
    const $hotline = await page.evaluateHandle(() => document.querySelector('.official-nav-phone-block'))

    // 地址
    await page.evaluate(async () => await waitUntilLoaded('#addressText'))
    const $address = await page.evaluateHandle(() => document.querySelector('#addressText'))
    await page.evaluate(($address, $hotline) => {
      $address.after($hotline)
    }, $address, $hotline)

    // 地址和热线的 OCR
    const $ocr = await page.evaluateHandle(() => document.querySelector('.center-second'))
    const ocrContent = await $ocr.screenshot({
      type: 'png',
      encoding: 'base64'
    })
    const ocrRes = await ocr(ocrContent)
    try {
      data.address = filterSpace(ocrRes.words_result[0].words)
      data.hotline = filterSpace(ocrRes.words_result[1].words)
    } catch (ocrError) {
      console.error('ocrError:', ocrError)
      data.address = data.address || '-'
      data.hotline = data.hotline || '-'
    }

    // 写入数据
    await fs.writeFileSync(dir.join(pageDir, 'data.json'), JSON.stringify(data))

    // await page.screenshot({ path: 'test.png' })

  } catch (error) {
    console.log(error)
  }
})()