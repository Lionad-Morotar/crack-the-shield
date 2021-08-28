// 将样式对象转为字符串
const styles = () => {
  const fn = obj => Object.entries(obj)
    .map(([k, v]) => ([k.replace(/([A-Z])/g, (match) => '-' + match.toLowerCase()), v]))
    .map(x => x.join(':'))
    .join(';')
  if (window) {
    window.styles = fn
  } else {
    return fn
  }
}

const waitUntilLoaded = function () {
  const fn = ($elm, timeout = 500) => {
    let tick
    const target = typeof $elm === 'string'
      ? document.querySelector($elm)
      : $elm
    return new Promise((resolve, reject) => {
      if (!target) {
        console.log('[INFO] skip wait no elem')
        resolve()
      }
      // 超时报错
      const errorTick = setTimeout(() => {
        tick && window.clearTimeout(tick)
        reject()
      }, 10 * 1000)

      tick = setTimeout(() => {
        window.clearTimeout(errorTick)
        resolve()
      }, timeout)

      const observer = new window.MutationObserver(list => {
        console.log(list)
        tick && window.clearTimeout(tick)
        tick = setTimeout(() => {
          window.clearTimeout(errorTick)
          resolve()
        }, timeout)
      })
      observer.observe(target, {
        childList: true,
        subtree: true
      })
    })
  }
  if (window) {
    window.waitUntilLoaded = fn
  } else {
    return fn
  }
}

module.exports = {
  styles,
  waitUntilLoaded
}
