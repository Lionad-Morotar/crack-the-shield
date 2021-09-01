const connectDB = require('../../src/connect-db')

// 开始任务
connectDB().then(async mongo => {
  const db = mongo.db('spider')
  shopCollection = db.collection('shops')

  const findAlls = await new Promise((resolve, reject) => {
    shopCollection.find({}).toArray(function (err, res) {
      if (err) {
        reject(err)
      } else {
        resolve(res)
      }
    })
  })
  const todos = findAlls.filter(x => !x.done)
  console.log(`剩余${todos.length}个详情页任务`)
})
