const connectDB = require('../../src/connect-db')
const Crawler = require('../../src/crawler')

connectDB().then(mongo => {
  const db = mongo.db("spider-test")
  const collection = db.collection('shop-list')

  const tasks = [{
    run () {
      console.log('asdfasdf')
    }
  }]

  new Crawler({ collection })
    .exec(tasks)
    .then(() => {
      console.log('[INFO] task done')
    })
    .catch(error => {
      console.error('[ERR] task error : ', error)
    })
})
