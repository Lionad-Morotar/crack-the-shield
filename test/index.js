const utils = require('./utils')
const caser = require('./caser')
const { getCalcs, minus, index } = utils
let res

res = caser({
  move: 20,
  size: 4,
  sort: 'Aa0',
  maxRow: 10
})

// console.log(getCalcs('Aa'))
// res = minus('g', 'w', 'Aa')

console.log(res)