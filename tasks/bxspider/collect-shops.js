const fs = require('fs')
const path = require('path')
const Koa = require('koa')
const cors = require('koa2-cors')
const bodyParser = require('koa-bodyparser')

const { isProd, autoRun } = require('../../utils')

const app = new Koa()
const connectDB = require('../../src/connect-db')

app.use(cors())
app.use(bodyParser())

connectDB().then(async mongo => {
  const db = mongo.db('spider')
  shopCollection = db.collection('shops')

  // app.use(async ctx => {
  //   const shops = ctx.request.body || []

  //   const saved = await Promise.all(
  //     shops.map((shop, idx) => new Promise((resolve, reject) => {
  //       const shopID = shop._id || shop.id
  //       shopCollection.find({ _id: shopID }).toArray((err, res) => {
  //         const verified = shop.verify === '876'
  //         if (err) {
  //           console.error('保存前校验店铺数据错误')
  //           reject(err)
  //         } else if (!verified) {
  //           console.error('数据校验错误')
  //           reject(err)
  //         } else {
  //           if (res.length > 0) {
  //             if (isProd) {
  //               log('重复的！不用保存了！可恶哇！')
  //             }
  //             resolve()
  //           } else {
  //             const data = Object.assign({
  //               ...shop,
  //               _id: shopID,
  //               version: 'human-spider',
  //               done: false
  //             }, shop)
  //             shopCollection.insertOne(data, function (err) {
  //               if (err) {
  //                 log.error('储存店铺数据错误')
  //                 reject(err)
  //               } else {
  //                 resolve(true)
  //               }
  //             })
  //           }
  //         }
  //       })
  //     }))
  //   ).then(res => {
  //     return res.length > 0
  //   }).catch(error => {
  //     throw new Error(error)
  //   })

  //   if (saved) {
  //     console.log(`[COLLECT] ${shops.length}`)
  //     ctx.body = { message: 'ok' }
  //   } else {
  //     ctx.body = { message: 'error' }
  //   }
  // })

  const shopListTask = async () => {
    const shops = fs.readFileSync(path.join(__dirname, './new.json'))
    let json
    try {
      json = JSON.parse(shops)
      fs.writeFileSync(path.join(__dirname, './new.json'), '[]')
    } catch (error) {
      json = []
    }
    json.map((shop, idx) => new Promise((resolve, reject) => {
      const shopID = shop._id || shop.id
      shopCollection.find({ _id: shopID }).toArray((err, res) => {
        const verified = shop.verify === '876'
        if (err) {
          console.error('保存前校验店铺数据错误')
          reject(err)
        } else if (!verified) {
          console.error('数据校验错误')
          reject(err)
        } else {
          if (res.length > 0) {
            if (isProd) {
              log('重复的！不用保存了！可恶哇！')
            }
            resolve()
          } else {
            const data = Object.assign({
              ...shop,
              _id: shopID,
              version: 'human-spider',
              done: false
            }, shop)
            shopCollection.insertOne(data, function (err) {
              if (err) {
                log.error('储存店铺数据错误')
                reject(err)
              } else {
                resolve(true)
              }
            })
          }
        }
      })
    }))
  }

  autoRun(shopListTask, {
    name: '店铺列表页',
    until: () => false,
    timewait: 3000
  })

  // app.listen(3000)
  // console.log('[STARTED]')
})
