const fs = require('fs')
const path = require('path')

const rembrandt = require('../plugins/rembrandt')

const imageA = fs.readFileSync(path.join(__dirname, './slider-1.png'))
const imageB = fs.readFileSync(path.join(__dirname, './slider-1-raw.png'))

const res = rembrandt({
  imageA,
  imageB
})

res.then(data => {
  console.log('data:', data)
})
