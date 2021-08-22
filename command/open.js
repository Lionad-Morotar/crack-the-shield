const { getBrowser, utils } = require('../src/chrome')

const [_, __, url] = process.argv

!(async () => {
  try {
    const browser = await getBrowser()
    const page = await browser.newPage()
    await page.setViewport(utils.setViewport())
    console.log('url:', url)
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.screenshot({ path: 'test.png' })
  } catch (error) {
    console.log(error)
  }
})()