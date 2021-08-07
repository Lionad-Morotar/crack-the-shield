const path = require('path')
const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const { log } = require('../utils')

puppeteer.use(StealthPlugin())

/**
 * 使用 Puppeteer 打开网页并截一张完整的快照图片
 * @see https://pptr.dev/ puppeteer 文档
 */
module.exports = async function snapshot(options = {}) {
  const {
    name,
    url,
    saveTo,
    width = 1920, 
    height = 1080
  } = options

  const browser = await puppeteer.launch({
    headless: true,
    ignoreHTTPSErrors: true,
    args: ['--no-sandbox']
  })
  const page = await browser.newPage()
  await page.setViewport({ width, height })

  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)

  try {
    await page.screenshot({
      path: saveTo + path.sep + name + '.png',
      fullPage: true,
      type: 'png'
    }).catch(err => {
      log('[ERR] 截图失败：' + err)
    })
  } catch (e) {
    log('[ERR] 截图失败：' + e)
  } finally {
    await browser.close()
  }
}