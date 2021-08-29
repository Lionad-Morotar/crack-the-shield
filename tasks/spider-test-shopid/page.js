const fs = require('fs')
const path = require('path')
const utils = require('../../memo/utils')
const caser = require('../../memo/caser')

const maxPage = 500

const oneKeys = [
  caser.join({
    sort: '(VWX)',
  }),
  caser.join({
    sort: 'Aa0(00)',
    move: 0,
    size: 16,
    maxRow: 4
  })
]

const tenKeys = [
  caser.join({
    sort: '(VWX)',
  }),
  caser.join({
    sort: 'Aa0',
    move: 5,
    size: 16
  }),
  caser.join({
    sort: 'Aa0',
    move: 20,
    size: 4,
    maxRow: 10
  })
]

const hundKeys = [
  caser.join({
    sort: '(VWX)',
  }),
  caser.join({
    sort: '(FVIl1)',
  }),
  caser.join({
    sort: 'Aa0',
    move: 21,
    size: 4,
    maxRow: 10
  }),
  caser.join({
    sort: 'Aa',
    move: 21,
    size: 1,
    maxRow: 10
  })
]
// console.log('hundKeys:', tenKeys)
// return

const knownPage = {
  1: 'Vg',
  10: 'VlU',
  100: 'VlVV'
}
const useKeys = {
  1: oneKeys,
  10: tenKeys,
  100: hundKeys
}
let keys
const pageMap = Array(maxPage).fill('').map((_, i) => i).reduce((h, i) => {
  const page = i + 1
  keys = useKeys[page] || keys
  const hasKnown = knownPage[page]
  if (hasKnown) {
    h[page] = knownPage[page]
  } else {
    const last = h[page-1]
    // TODO repeated caser
    // console.log('keys', page, keys, last)
    const lastIdxs = last.split('').map((x,i) => keys[i].indexOf(x))
    // console.log(lastIdxs)
    let add = 1
    let nextIdxs = [...lastIdxs]
    let i = nextIdxs.length - 1
    while (add) {
      const idx = nextIdxs[i]
      const key = keys[i]
      // console.log(idx, key)
      let sumIdx = idx + add
      if (sumIdx > key.length - 1) {
        sumIdx = sumIdx % key.length
        add = 1
      } else {
        add = 0
      }
      if (i >= 0) {
        nextIdxs[i] = sumIdx
      } else {
        // TODO
        console.log('TODO')
      }
      i--
    }
    // console.log(page, nextIdxs)
    const next = nextIdxs.map((x, i) => keys[i][x]).join('')
    h[page] = next
  }
  return h
}, {})

const res = Object.entries(pageMap).reduce((h, [k, v]) => {
  h[k] = v.padEnd(4, '=')
  return h
}, {})

fs.writeFileSync(
  path.join(__dirname, './page.json'),
  JSON.stringify(res, undefined, 2)
)