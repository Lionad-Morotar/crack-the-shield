const base = require('./config')
const request = require('request')

request({
  url: `${base.url}/detail/e9a18e1dd1c64cd09833c0fd45e7bc06/mobile`,
  method: 'GET',
  strictSSL: false,
  followRedirect: false,
  headers: {
    'spider': 'yiguang',
    cookie: 'bxf=11111111122222222133333333144444444'
  }
}, (err, response) => {
  if (err) {
    reject(err)
  } else {
    const decodeMobile = (base64) => {
      let mobile = ''
      const numStr = new Buffer(base64, 'base64').toString()
      for (let i = 0; i < numStr.length; i++) {
        mobile += String.fromCharCode(
          numStr.charCodeAt(i) - 10
        )
      }
      return mobile
    }
    const data = JSON.parse(response.body)
    const mobile = decodeMobile(data.data)
    console.log(mobile)
  }
})