const fs = require('fs')
const path = require('path')
const { mkdir, conc, log, rimraf } = require('../utils')

const outputDir = path.join(__dirname, `../dist/`)

const mainTasks = require('../defined/index.json')
const testBot = require('../defined/bot.json')
const testFingerprint = require('../defined/fingerprint.json')
const scrape = require('../src/scrape')
const getSnapshot = require('../src/snapshot')

const pending = mainTasks
const { concurrent = 1, tasks = pending } = pending
conc(concurrent, tasks, main)

async function main (task) {
  const { name, url, snapshot = false, force = false } = task
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
      directory: saveToDir,
      request: {
        headers: {
          'spider': 'yiguang'
        }
      }
    })
  } catch (error) {
    console.error(error)
    throw new Error(error)
  }

  /* 站点截图 */

  if (snapshot) {
    log(`[INFO] 开始截图：${name}`)
    const snapshotSaveDir = path.join(saveToDir, `${sep}snapshot`)
    mkdir(snapshotSaveDir)
    try {
      await getSnapshot({
        name,
        url: `file:${sep}${sep}` + path.join(saveToDir, `${sep}index.html`),
        saveTo: snapshotSaveDir
      })
    } catch (error) {
      console.error(error)
      throw new Error(error)
    }
  }

  log(`[DONE] 任务完成：${name}`)
}
