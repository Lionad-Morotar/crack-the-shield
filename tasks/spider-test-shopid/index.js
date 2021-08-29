const _ = require('lodash')

const connectDB = require('../../src/connect-db')
const Crawler = require('../../src/crawler')
const pageMap = require('./page.json')

const shopListPageTasks = _.shuffle(
  Object.entries(pageMap).map(([k, v]) => {
    return {
      id: k,
      async run ({ collection }) {
        const url = `http://192.168.1.7:8080/spider-main/?p=${v}`
        const data = { _id: k, url }
        await new Promise((resolve, reject) => {
          collection.insertOne(data, function (err) {
            if (err) {
              reject(err)
            } else {
              resolve()
            }
          })
        })
      }
    }
  })
)

connectDB().then(async mongo => {
  const db = mongo.db("spider-test")

  /* 排列列表页面任务 */

  const listCollection = db.collection('shop-list-page')
  const finds = await new Promise((resolve, reject) => {
    listCollection.find({}).toArray(function (err, res) {
      if (err) {
        reject(err)
      } else {
        resolve(res)
      }
    })
  })
  const todos = shopListPageTasks.filter(x => !finds.find(y => y._id === x.id))
  console.log(`[INFO] 剩余${todos.length}个列表页任务`)

  await new Crawler({ colection: listCollection })
    .exec(todos)
    .then(() => {
      console.log('[INFO] task done')
    })
    .catch(error => {
      console.error('[ERR] task error : ', error)
    })

  /* 排列列表页面任务 */
  // TODO
})
