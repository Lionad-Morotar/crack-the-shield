const MongoClient = require("mongodb").MongoClient

module.exports = function connect() {
  return new Promise((resolve) => {
    MongoClient.connect(
      "mongodb://localhost:27017",
      {
        useNewUrlParser: true,
        useUnifiedTopology: true
      },
      function (err, mongo) {
        if (err) throw err
        resolve(mongo)
      }
    )
  })
}
