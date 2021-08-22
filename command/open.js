const { getBrowser, utils } = require('../src/chrome')

const [_, __, url] = process.argv

!(async () => {
  try {
    let browser = await getBrowser()
    const page = await browser.newPage()
    await page.setViewport(utils.setViewport())
    console.log('url:', url)
    await page.goto(url, { waitUntil: 'domcontentloaded' })
  } catch (error) {
    console.log(error)
  }
})()