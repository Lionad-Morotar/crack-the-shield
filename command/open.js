const fs = require('fs')
const path = require('path')

const { dir, mkdir } = require('../utils')
const { waitUntilLoaded, styles } = require('../utils/dom')
const { getBrowser, utils } = require('../src/chrome')
const preloadFile = fs.readFileSync(path.join(__dirname, '../src/preload.js'), 'utf8')

const [_, __, url] = process.argv
console.log('url:', url)

!(async () => {
  try {
    const browser = await getBrowser()
    const page = await browser.newPage()
    await page.setViewport(utils.setViewport())
    await page.evaluateOnNewDocument(preloadFile)
    await page.evaluateOnNewDocument(waitUntilLoaded)
    await page.evaluateOnNewDocument(styles)

    // TODO canvas toString
    // TODO check load

    /* 移除广告，提高加载速度 */
    await page.setRequestInterception(true)
    page.on('request', req => {
      if (req.url().match(/pexels-photo/)) {
        req.abort()
      } else {
        req.continue()
      }
    })
    await page.evaluateOnNewDocument(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const $style = document.createElement('style')
        $style.innerHTML = `.ad-list { display: none }`
        console.log(document.querySelector('head'))
        document.querySelector('head').appendChild($style)
      })
    })

    const data = { name: '', hotline: '', mobile: '', owner: '', address: '' }
    
    // TODO 超时
    // TODO referer
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    const $document = await page.evaluateHandle(() => document)

    // 获取标题内容
    data.name = await page.evaluate(
      document => document.querySelector('.company-name').innerText,
      $document
    )

    const pageDir = dir('spider-test/', data.name)
    await mkdir(pageDir, true)

    // 热线
    await page.evaluate(async () => await waitUntilLoaded('.official-nav-phone-block'))
    const $hotline = await page.evaluateHandle(() => document.querySelector('.official-nav-phone-block'))
    await page.evaluate(
      $ele => $ele.setAttribute('style', styles({
        padding: '20px'
      })),
      $hotline
    )
    await $hotline.screenshot({
      path: dir.join(pageDir, 'hotline.png')
    })

    // 地址
    await page.evaluate(async () => await waitUntilLoaded('#addressText'))
    const $address = await page.evaluateHandle(() => document.querySelector('#addressText'))
    await page.evaluate(
      $ele => (
        $ele.innerText = '！' + $ele.innerText,
        $ele.setAttribute('style', styles({
          padding: '20px'
        }))
      ),
      $address
    )
    await $address.screenshot({
      path: dir.join(pageDir, 'address.png')
    })

    await fs.writeFileSync(dir.join(pageDir, 'data.json'), JSON.stringify(data))

    // await page.screenshot({ path: 'test.png' })

  } catch (error) {
    console.log(error)
  }
})()