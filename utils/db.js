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

const findInCollection = async (collection, condition = {}) => {
  return new Promise((resolve, reject) => {
    collection.find(condition).toArray(function (err, res) {
      if (err) {
        reject(err)
      } else {
        resolve(res)
      }
    })
  })
}

module.exports = {
  asyncify,
  findInCollection
}
