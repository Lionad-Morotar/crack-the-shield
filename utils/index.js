const fs = require('fs')
const path = require('path')
const rimraf = require('rimraf').sync
const conc = require('../plugins/conc')

const isProd = process.env.NODE_ENV === 'production'

const dir = (...absPaths) => path.join(__dirname, '../', ...absPaths)
dir.join = path.join

const sleep = (time = 500) => new Promise(resolve => setTimeout(resolve, time))

const uuid = () => String(+new Date()) + '-' + String(Math.random()).slice(-6)

const filterSpace = str => str.replace(/\s/g, '')

// 根据脚本的执行次数记录数据库数据版本
const runCount = (async () => {
  const env = process.env.NODE_ENV
  const fp = path.join(__dirname, `./count/${env}.txt`)
  const lastCount = fs.existsSync(fp) ? (+fs.readFileSync(fp)) : 0
  const nowCount = lastCount + 1
  fs.writeFileSync(fp, String(nowCount), 'utf8')
  return nowCount
})()

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
  } while (!until() && isProd)
}

module.exports = {
  runCount,
  dir,
  log,
  isProd,
  uuid,
  autoRun,
  sleep,
  filterSpace,
  rimraf,
  mkdir,
  notEmpty,
  findTroughs,
  conc,
}