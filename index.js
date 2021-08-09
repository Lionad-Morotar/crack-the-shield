const fs = require('fs')
const path = require('path')
const { mkdirsSync, conc, log, rimraf } = require('./utils')

const sep = path.sep
const outputDir = path.join(__dirname, `${sep}dist${sep}`)

const mainTasks = require('./tasks/index.json')
const testBot = require('./tasks/bot.json')
const testFingerprint = require('./tasks/fingerprint.json')
const scrape = require('./src/scrape')
const getSnapshot = require('./src/snapshot')

const pending = mainTasks
const { concurrent = 1, tasks = pending } = pending
conc(concurrent, tasks, main)

async function main (task) {
  const { name, url, snapshot = true, force = false } = task
  const saveToDir = path.join(outputDir, name)

  /* 抓取站点 */

  if (fs.existsSync(saveToDir)) {
    if (force) {
      await rimraf(saveToDir)
    } else {
      log(`[INFO] 跳过网站：${name}`)
      return
    }
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

  /* 站点截图 */

  if (snapshot) {
    log(`[INFO] 开始截图：${name}`)
    mkdirsSync(snapshotSaveDir)
    try {
      await getSnapshot({
        name,
        url: `file:${sep}${sep}` + path.join(saveToDir, `${sep}index.html`),
        saveTo: path.join(saveToDir, `${sep}snapshot`)
      })
    } catch (error) {
      console.error(error)
      throw new Error(error)
    }
  }

  log(`[DONE] 任务完成：${name}`)
}
