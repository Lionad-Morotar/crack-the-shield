const path = require('path')
const ocr = require('../plugins/ocr')

// const res = ocr(path.join(__dirname, './slider-3.png'), 'path')

const res = ocr.numbers(path.join(__dirname, './slider-2.png'), 'path')

res.then(data => {
  console.log('data:', data)
})
