const fs = require('fs')
const path = require('path')

const { waitUntilLoaded } = require('../utils/dom')
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

    await page.goto(url, { waitUntil: 'domcontentloaded' })

    // 等待我们的地址栏加载完毕
    await page.evaluate(async () => await window.waitUntilLoaded('#addressText'))


    // await page.screenshot({ path: 'test.png' })

  } catch (error) {
    console.log(error)
  }
})()