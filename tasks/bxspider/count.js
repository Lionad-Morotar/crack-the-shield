const fs = require('fs')
const path = require('path')

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

  const res = findAlls.reduce((h, c) => {
    const {
      name = '',
      owner = '',
      address = '',
      mobile = '',
      hotline = '',
    } = c
    const cur = `${name},${owner},${address},${mobile},${hotline}`
    h.push(cur)
    return h
  }, [])

  const results = 'name,owner,address,mobile,hotline\n' + res.join('\n')

  fs.writeFileSync(path.join(__dirname, './杨韵澍.csv'), results)
})
