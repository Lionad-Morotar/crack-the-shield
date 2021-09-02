const fs = require('fs')
const path = require('path')
const rimraf = require('rimraf').sync
const conc = require('../plugins/conc')

const isProd = () => process.env.NODE_ENV === 'production'

const dir = (...absPaths) => path.join(__dirname, '../', ...absPaths)
dir.join = path.join

const sleep = (time = 500) => new Promise(resolve => setTimeout(resolve, time))

const filterSpace = str => str.replace(/\s/g, '')

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
  const logInfo = msgs.map(msg => typeof msg === 'string' ? msg : JSON.stringify(msg)).join('\n    ')
  console.log(logInfo)
}
log.error = (...msgs) => log(...msgs)

const notEmpty = obj => obj && Object.keys(obj).length > 0

/**
 * 寻找数据的波谷
 * @see http://cn.voidcc.com/question/p-ptjbjrzv-tr.html
 **/
function findTroughs(array) {
  const start = 1
  const end = array.length - 2
  const troughs = []
  for (var i = start; i <= end; i++) {
    const current = array[i]
    const last = array[i - 1]
    const next = array[i + 1]
    if (current < next && current < last) {
      troughs.push(i)
    }
  }
  return troughs
}

const autoRun = async (taskFn, opts) => {
  const {
    name = '',
    until = () => false,
    timewait = 1000
  } = opts
  do {
    log(`【TASK BEGIN】${name}`)
    await taskFn()
    await sleep(timewait)
  } while (!until() && isProd())
}

module.exports = {
  dir,
  log,
  autoRun,
  sleep,
  filterSpace,
  rimraf,
  mkdir,
  notEmpty,
  findTroughs,
  conc,
  isProd
}