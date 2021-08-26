const _ = require('lodash')
const { getCalcs } = require('./utils')

const caser = ({
  log = {},
  move = 0,
  size = 1,
  sort,
  maxRow,
  pad
}) => {
  let calcs = getCalcs(sort)
  if (maxRow) {
    const maxLen = size * maxRow
    const calcsLen = calcs.length
    log.maxRow && console.log(maxLen, calcsLen)
    // TODO pad conf
    if (calcsLen < maxLen) {
      const padStr = pad
        ? getCalcs(pad).join('')
        : calcs.join('')
      calcs = calcs
        .join('')
        .padEnd(maxLen, padStr)
        .split('')
    }
  }
  log.calcs && console.log(calcs)
  const posMove = Math.abs(move)
  const moves = move === 0
    ? calcs
    : move < 0
      ? calcs.slice(move).concat(calcs.slice(0, calcs.length - posMove))
      : calcs.slice(posMove).concat(calcs.slice(0, posMove))
  log.moves && console.log(moves)
  const grouped = moves.reduce((h, c) => {
    const last = h.length ? h[h.length - 1] : null
    const handle = last 
      ? ((last.length === size) ? [] : last)
      : []
    if (!h.includes(handle)) {
      h.push(handle)
    }
    handle.push(c)
    return h
  }, [])
  log.grouped && console.log(grouped)
  const res = maxRow
    ? grouped.slice(0, maxRow)
    : grouped
  log.res && console.log(res)
  return res
}

caser.join = (conf) => {
  return caser(conf).map(x => x[0]).join('')
}

caser.calcs = (conf) => {
  return getCalcs(conf.sort)
}

module.exports = caser