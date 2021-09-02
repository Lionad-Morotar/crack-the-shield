const { log } = require('../utils')

const createProxy = (fn, retFn, maxSize = 64) => {
  let base = 1
  const pool = []
  const maxHalf = Math.floor(maxSize / 2)
  
  const requestIP = async () => {
    const response = await fn(base)
    const ips = response.body.split('\r\n').filter(x => x)
    pool.push(...ips)
  }
  
  const getIP = async () => {
    if (pool.length <= 1 && base <= maxHalf) {
      base *= 2
      log(`BASE DOUBLED: ${base}`)
      await requestIP()
      return pool.pop()
    }
    if (pool.length <= Math.floor(base / 3)) {
      requestIP()
    }
    return pool.pop()
  }
  
  const getProxy = async () => {
    const ip = await getIP()
    return retFn ? retFn(ip) : ip
  }

  return {
    pool,
    getProxy
  }
}

module.exports = createProxy
