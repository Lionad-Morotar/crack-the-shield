// FIXME ???
const asyncify = collection => {
  const _insertOne = collection.insertOne
  collection.insertOne = (function (data) {
    return new Promise((resolve, reject) => {
      _insertOne(data, function (err) {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }).bind(collection)
  return collection
}

module.exports = {
  asyncify
}
