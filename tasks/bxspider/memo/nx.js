const fs = require('fs')
const path = require('path')

const { dir } = require('../utils')

const FILENAME = 'bfjs'

let nxContent = fs.readFileSync(dir(`memo/statics/${FILENAME}/${FILENAME}.nx.js`), 'utf8')
const attrName = '_0x3a1d'
const strs = [
  "sameSite",
  "setDefault",
  "cookieEnabled",
  "2400728tUGYAg",
  "fill",
  "beginPath",
  "top",
  "backend",
  "isPlainObject",
  "bytes",
  "expiresMultiplier",
  "setItem",
  "[object Array]",
  "185556BqLiHW",
  "bfv",
  "blocks",
  "then",
  "data",
  "call",
  "text",
  "#069",
  "arrayBuffer",
  "create",
  "createHash",
  "url",
  "exports",
  "onstorage",
  "1676426WGloIM",
  "getImageData",
  "umask",
  "cDoubleReadOut",
  "removeListener",
  "apply",
  "cReadOut",
  "secure",
  "isView",
  "JS_MD5_NO_COMMON_JS",
  "versions",
  "cwd",
  "lastByteIndex",
  "prototype",
  "buffer8",
  "removeAllListeners",
  "&f=",
  "string",
  "chdir",
  "JS_MD5_NO_NODE_JS",
  "rgb(255,255,0)",
  "defineProperty",
  "\"prod\"",
  "setTimeout has not been defined",
  "object",
  "utils",
  "indexOf",
  "?cf=1&s=",
  "#f60",
  "oldValue",
  "join",
  "start",
  "multiply",
  "__BF_URL__",
  "evenodd",
  "keys",
  "push",
  "rgba(0, 127, 255, 255)",
  "charCodeAt",
  "function",
  "base64",
  "addListener",
  "undefined",
  "array",
  "return this",
  "__esModule",
  "putImageData",
  "toUTCString",
  "finalized",
  "__BF_VERSION__",
  "__BF_IDENTITY__",
  "toDataURL",
  "replace",
  "toArray",
  "node",
  "listeners",
  "hex",
  "\"fc276cce08ba22dc\"",
  "hasOwnProperty",
  "run",
  "globalCompositeOperation",
  "decode",
  "__BF_IP__",
  "expires",
  "path",
  "remove",
  "width",
  "debug",
  "addEventListener",
  "nextTick",
  "fillRect",
  "canvas",
  "alphabetic",
  "clearTimeout has not been defined",
  "closePath",
  "digest",
  "empty",
  "localStorage",
  "cookie",
  "bxf",
  "14px 'Arial'",
  "substring",
  "get",
  "1048587kWRCsb",
  "11528syUDza",
  "defaults",
  "domain",
  "JS_MD5_NO_WINDOW",
  "encode",
  "isArray",
  "fillStyle",
  "browser",
  "18243XnkPeg",
  "input is invalid type",
  "cKnownPixels",
  "prependListener",
  "amd",
  "30eKWTPo",
  "info",
  "createElement",
  "md5",
  "fun",
  "clear",
  "floor",
  "null",
  "split",
  "shift",
  "JS_MD5_NO_ARRAY_BUFFER_IS_VIEW",
  "textBaseline",
  "rgb(0,255,255)",
  "Buffer",
  "off",
  "[object Object]",
  "length",
  "buffer",
  "hash",
  "newValue",
  "height",
  "hBytes",
  "splice",
  "attachEvent",
  "rgba(0, 255, 0, 0.5)",
  "\"180.167.171.194\"",
  "process.chdir is not supported",
  ";domain=",
  "toString",
  "arc",
  "\"/shield/s.png\"",
  "retrieve",
  "storage",
  "fillText",
  "constructor",
  "first",
  "all",
  "toStringTag",
  "set",
  "1006816JaAXMv",
  "hashed",
  "a2f3c18daca94b4c0e1e512e6315fec7",
  "uri",
  "default",
  "update",
  ";SameSite=",
  "getContext",
  "JS_MD5_NO_ARRAY_BUFFER",
  "forEach",
  "5991765CUyDlr",
  "__BF_SIGN__",
  "finalize"
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

const attrNames = [attrName]
const toWash = [attrName]
let curName
while (curName = toWash.pop()) {
  const attrNamesMatches = nxContent.match(
    new RegExp(`(_0x[a-zA-Z0-9]*)\\s*=\\s*${curName}`, 'img')
  )
  if (attrNamesMatches) {
    attrNamesMatches.map(x => {
      const [all, attr] = x.match(
        new RegExp(`(_0x[a-zA-Z0-9]*)\\s*=\\s*${curName}`)
      )
      attrNames.push(attr)
      toWash.push(attr)
    })
  }
}
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