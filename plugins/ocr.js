const fs = require('fs')
const AipOcrClient = require("baidu-aip-sdk").ocr

const { APP_ID, API_KEY, SECRET_KEY } = require('./private/baidu-ai.ocr')

const OCR = new AipOcrClient(APP_ID, API_KEY, SECRET_KEY)

const pool = []
const quque = []
const maxLen = 10

const ocr = (filePath) => {
  return new Promise((resolve, reject) => {
    const imgContent = fs.readFileSync(filePath).toString('base64')
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
