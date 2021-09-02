const io = require('socket.io-client')
const base = require('./config')

const uid = "6b872c484fd7484390d8fd87a489120b"
// const cookie = "bxf=4b26fc601742a78be16c4ed646177b93054"
const cookie = "bxf=123"

new Promise(resolve => {
  const options = {
    transports: ['websocket'],
    extraHeaders: {
      Cookie: cookie,
      'spider': 'yiguang'
    }
  }
  const ws = io(base.wss, options)
  console.log('wait for connected ...')
  ws.on('connect', () => {
    ws.emit('i-want-a-name', uid, owner => resolve(owner))
  })
  ws.on('error', () => {
    throw new Error("Couldn't connect to wss")
  })
  ws.on('disconnect', () => {
    throw new Error("Couldn't connect to wss")
  })
}).then(data => {
  console.log('data:', data)
}).catch(error => {
  console.log('error:', error)
})