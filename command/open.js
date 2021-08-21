const { chrome, utils } = require('../src/chrome')

const [_, __, url] = process.argv

!(async () => {
  let browser
  try {

    /******************************** BEGIN ********************************/

    browser = await chrome.launch({
      headless: false,
      ignoreHTTPSErrors: true,
      args: ['--no-sandbox']
    })
    const page = await browser.newPage()
    await page.setViewport(utils.setViewport())

    console.log('url:', url)

    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000 * 3000)

    /******************************** END ********************************/

  } catch (error) {
    console.error(error)
  } finally {
    browser && browser.close && browser.close()
  }
})()