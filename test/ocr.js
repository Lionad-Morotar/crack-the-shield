const path = require('path')
const ocr = require('../plugins/ocr')

const res = ocr(path.join(__dirname, './rt-nums.png'))

res.then(data => {
  console.log('data:', data)
})
