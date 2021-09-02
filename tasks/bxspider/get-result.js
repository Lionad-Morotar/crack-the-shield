const fs = require('fs')
const path = require('path')
const iconv = require('iconv-lite')

const connectDB = require('../../src/connect-db')

connectDB().then(async mongo => {
  const db = mongo.db('spider')
  shopCollection = db.collection('shops')

  const shops = await new Promise((resolve, reject) => {
    shopCollection.find({}).toArray((err, res) => {
      if (err) {
        reject(err)
      } else {
        resolve(res)
      }
    })
  })

  const results = shops.reduce((h, c) => {
    const cur = `${c.name},${c.owner},${c.address},${c.mobile},${c.hotline}\r\n`
    return h + cur
  }, 'name,owner,address,mobile,hotline\r\n')

  /**
   * GBK in NodeJS
   * @see https://www.zhihu.com/question/26121387
   */
  const resultsGBK = iconv.encode(results, 'gbk').toString('binary')

  fs.writeFileSync(path.join(__dirname, './杨韵澍.csv'), results)

  process.exit(0)
})
