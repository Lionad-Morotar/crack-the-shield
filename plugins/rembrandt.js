const Rembrandt = require('rembrandt')

module.exports = async (args) => {
  const rembrandt = new Rembrandt(args)
  return await rembrandt.compare()
}