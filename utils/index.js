const fs = require('fs')
const path = require('path')
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

const log = msg => {
  // TODO log to file
  if (!isProd) {
    console.log(msg)
  }
}

const notEmpty = obj => obj && Object.keys(obj).length > 0

module.exports = {
  mkdirsSync,
  notEmpty,
  log,
  conc
}