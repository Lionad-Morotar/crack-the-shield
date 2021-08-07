const fs = require('fs')
const path = require('path')
const { mkdirsSync, conc, log } = require('./utils')

const sep = path.sep
const outputDir = path.join(__dirname, `${sep}dist${sep}`)

const tasks = require('./task.js')
const scrape = require('./src/scrape')

const concurrent = 1
conc(concurrent, tasks, main)

async function main (task) {
  const {
    name,
    url,
    force = false
  } = task

  const saveToDir = path.join(outputDir, name)
  if (fs.existsSync(saveToDir) && !force) {
    log(`[INFO] 跳过网站：${name}`)
    return
  }
  log(`[BEGIN] 开始抓取：${name}`)
  try {
    await scrape({
      urls: [url],
      directory: saveToDir
    })
  } catch (error) {
    console.error(error)
    throw new Error(error)
  }

  log(`[DONE]：${name}`)
}
