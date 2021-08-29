const fs = require('fs')
const path = require('path')

const { dir } = require('../utils')

const FILENAME = 'script'

let nxContent = fs.readFileSync(dir(`memo/statics/${FILENAME}/${FILENAME}.nx.js`), 'utf8')
const attrName = '_0x46a74e'
const strs = [
  'charCodeAt', '402lYzVpj',
  'String', '184566FbtOwC',
  '2586681FJDgMu', 'navigator',
  '2786400DMdyoH', '43840jbRtHW',
  '151571bsjvYT', 'write',
  '141qRscZu', 'stop',
  'length', '487019SPLCOV',
  'webdriver', '53272WgNAZV'
]
const baseIDX = 0x6d
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

fs.writeFileSync(dir(`memo/statics/${FILENAME}/${FILENAME}.js`), nxContent)

// TODO setTimout