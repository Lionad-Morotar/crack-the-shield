const request = require('request')
const response = async () => await new Promise((resolve, reject) => {
  request({
    url: `http://Lionad.v4.dailiyun.com/query.txt?key=NP26E52ECA&count=${2}&rand=false&ltime=15&norepeat=true&detail=false`,
    method: 'GET',
  }, (err, proxedResponse) => {
    if (err) {
      // TODO retry
      console.log('代理云获取错误')
      reject(err)
    } else {
      console.log(proxedResponse.body)
      console.log(proxedResponse.body.split('\r\n')).filter(x => x)
      resolve(proxedResponse)
    }
  })
})

response()