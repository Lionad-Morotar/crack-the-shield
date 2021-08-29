const fs = require('fs')
const AipOcrClient = require("baidu-aip-sdk").ocr

const { APP_ID, API_KEY, SECRET_KEY } = require('./private/baidu-ai.ocr')

const OCR = new AipOcrClient(APP_ID, API_KEY, SECRET_KEY)

const pool = []
const quque = []
const maxLen = 10

const ocr = (base64OrPath, type = 'base64') => {
  return new Promise((resolve, reject) => {
    let imgContent
    if (type === 'path') {
      imgContent = fs.readFileSync(base64OrPath).toString('base64')
    }
    if (type === 'base64') {
      imgContent =  base64OrPath
    }
    if (!imgContent) {
      console.log('[INFO] no content in ocr')
      return
    }
    OCR.generalBasic(imgContent)
      .then(resolve)
      .catch(reject)
  })
}

// TODO QPS
const task = (filePath) => {
  return new Promise((resolve, reject) => {
    if (quque.length > maxLen) {
      pool.push(filePath)
    } else {
      quque.push(filePath)
    }
  })
}

module.exports = ocr
