const fs = require('fs')
const path = require('path')

const { dir } = require('../utils')

let nxContent = fs.readFileSync(dir('memo/statics/loaded.nx.js'), 'utf8')
const attrName = '_0x5ab7'
const strs = [
  '/detail/', '10fQXGin',
  '1589KjImGM', '368210gLZjYv',
  'click', '32dYzLqV',
  'data', '843292TxnSjk',
  '1627827jNHFAP', 'length',
  '15cVAUPZ', '#addressText',
  '1706938RpNKWN', '5217311lSQsIY',
  'substr', 'ajax',
  '10776wLYPuR', 'emit',
  '1320912mNXpzP', 'html',
  'websocket', '#owner',
  '/mobile', '#view-owner'
]
const baseIDX = 0xc6
let washNum

/* 清洗十六进制数字 */

washNum = baseIDX + strs.length
while (washNum >= 0) {
  const num0x = '0x' + washNum.toString(16)
  // TODO find no use idx
  nxContent = nxContent.replace(
    new RegExp(`${num0x}([^a-zA-Z0-9])`, 'img'),
    `${washNum}$1`
  )
  washNum--
}

/* 清洗属性 */

const attrNames = []
const attrNamesMatches = nxContent.match(
  new RegExp(`(_0x[a-zA-Z0-9]*)\\s*=\\s*${attrName}`, 'img')
)
attrNamesMatches.map(x => {
  const [all, attr] = x.match(
    new RegExp(`(_0x[a-zA-Z0-9]*)\\s*=\\s*${attrName}`)
  )
  attrNames.push(attr)
})
attrNames.push(attrName)
attrNames.map(samename => {
  washNum = baseIDX + strs.length
  while (washNum >= 0) {
    nxContent = nxContent.replace(
      new RegExp(`${samename}.${washNum}.`, 'img'),
      `"${strs[washNum - baseIDX]}"`
    )
    washNum--
  }
})
// nxContent = nxContent.replace(new RegExp(`function.${attrName}[^}]*}\\s+`, 'img'), '')

/* 写入文件 */

fs.writeFileSync(dir('memo/statics/loaded.js'), nxContent)
