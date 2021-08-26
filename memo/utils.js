// 字母表排列方式
const getCalcs = (m) => {
  const Alphas = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
  const alphas = 'abcdefghijklmnopqrstuvwxyz'.split('')
  const numbers = '0123456789'.split('')
  let res = []
  while (m) {
    let matchRes
    // (-x)
    if (matchRes = m.match(/^\(-(\d+)\)/)) {
      const [all, num] = matchRes
      res = res.slice(0, -+num)
      m = m.slice(all.length)
    }
    // (xxx)
    if (matchRes = m.match(/^\((.+)\)/)) {
      const [all, exts] = matchRes
      res = res.concat(exts.split(''))
      m = m.slice(all.length)
    }
    if (matchRes = m.match(/^A/)) {
      res = res.concat(Alphas)
      m = m.slice(1)
    }
    if (matchRes = m.match(/^a/)) {
      res = res.concat(alphas)
      m = m.slice(1)
    }
    if (matchRes = m.match(/^0/)) {
      res = res.concat(numbers)
      m = m.slice(1)
    }
  }
  return res
  // switch (m) {
  //   case 'A':
  //     return Alphas
  //   case 'a':
  //     return alphas
  //   case 'Aa':
  //     return Alphas.concat(alphas)
  //   case 'aA':
  //     return alphas.concat(Alphas)
  //   case 'Aa0':
  //     return Alphas.concat(alphas).concat(numbers)
  //   case 'aA0':
  //     return alphas.concat(Alphas).concat(numbers)
  //   case '0Aa':
  //     return numbers.concat(Alphas).concat(alphas)
  //   case '0aA':
  //     return numbers.concat(alphas).concat(Alphas)
  //   case 'A0a':
  //     return Alphas.concat(numbers).concat(alphas)
  //   case 'a0A':
  //     return alphas.concat(numbers).concat(Alphas)
  // }
}

// 两字母的距离
const minus = (c1, c2, m = 'Aa-') => {
  let idx1, idx2
  const [method, way] = m.split('-')
  const calcs = getCalcs(method)
  switch (way) {
    default:
    case '-':
      idx1 = calcs.findIndex(x => x === c1)
      idx2 = calcs.findIndex(x => x === c2)
      return idx1 - idx2
  }
}

// 单字母的位置
const index = (c1, m = 'aA', offset = 1) => {
  const calcs = getCalcs(m)
  return calcs.findIndex(x => x === c1) + offset
}

// 写入文件
const write = (dir) => {
  // TODO
}

module.exports = {
  getCalcs,
  minus,
  index,
  write
}