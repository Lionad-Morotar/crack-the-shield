const path = require('path')
const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const { log } = require('../utils')

puppeteer.use(StealthPlugin())

module.exports = {
  /**
   * @see https://pptr.dev/ puppeteer 文档
   **/
  chrome: puppeteer,
  utils: {
    setViewport({ width, height } = { width: 1920, height: 1080}) {
      return {
        width: width || 1920,
        height: height || 1080
      }
    }
  }
}