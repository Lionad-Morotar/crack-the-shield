const fs = require('fs')
const path = require('path')
const rimraf = require('rimraf').sync
const conc = require('../plugins/conc')

const isProd = process.env.NODE_ENV === 'production'

function mkdirsSync(dirname) {
  if (fs.existsSync(dirname)) {
    return true
  } else {
    if (mkdirsSync(path.dirname(dirname))) {
      fs.mkdirSync(dirname)
      return true
    }
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
  rimraf,
  mkdirsSync,
  notEmpty,
  log,
  conc
}