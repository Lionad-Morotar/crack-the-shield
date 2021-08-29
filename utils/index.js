const fs = require('fs')
const path = require('path')
const rimraf = require('rimraf').sync
const conc = require('../plugins/conc')

const isProd = process.env.NODE_ENV === 'production'

const dir = (...absPaths) => path.join(__dirname, '../', ...absPaths)
dir.join = path.join

const sleep = (time = 500) => new Promise(resolve => setTimeout(resolve, time))

// 创建文件夹
async function mkdir(dirname, force = false) {
  if (fs.existsSync(dirname)) {
    if (force) {
      await rimraf(dirname)
      console.log('[INFO] delete when mkdir')
    } else {
      return true
    }
  }
  if (mkdir(path.dirname(dirname))) {
    fs.mkdirSync(dirname)
    return true
  }
}

const log = (...msgs) => {
  // TODO log to file
  if (!isProd) {
    console.log(msgs)
  }
}

const notEmpty = obj => obj && Object.keys(obj).length > 0

module.exports = {
  dir,
  sleep,
  rimraf,
  mkdir,
  notEmpty,
  log,
  conc
}