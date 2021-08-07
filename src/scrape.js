const scrape = require('website-scraper')
const PuppeteerPlugin = require('./scraper-puppeteer')

module.exports = async function (options) {
  return scrape({
    ...options,
    plugins: [
      new PuppeteerPlugin({
        launchOptions: {
          headless: false,
          ignoreHTTPSErrors: true,
          args: [
            '--start-maximized'
          ]
        },
        // scrollToBottom: { timeout: 35000, viewportN: 100 }
      })
    ]
  })
}