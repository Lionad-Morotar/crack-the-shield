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

// 等待元素加载完毕
const waitUntilLoaded = function () {
  const fn = ($elm, timeout = 300) => {
    let tick
    const targets = typeof $elm === 'string'
      ? [...document.querySelectorAll($elm)]
      : $elm instanceof Array ? $elm : [$elm]
    return new Promise((resolve, reject) => {
      if (targets.length === 0) {
        console.log("跳过等待")
        resolve()
      }
      // 超时报错
      const errorTick = setTimeout(() => {
        tick && window.clearTimeout(tick)
        reject('等待超时')
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
      targets.map(target => {
        observer.observe(target, {
          childList: true,
          subtree: true
        })
      })
    })
  }
  if (window) {
    window.waitUntilLoaded = fn
  } else {
    return fn
  }
}

// 等待对象上某属性挂载完毕
const waitUntilPropsLoaded = function () {
  const fn = (name, objFn, maxTimeout = 5000) => {
    let tick
    return new Promise((resolve, reject) => {
      const errorTick = setTimeout(() => {
        tick && window.clearTimeout(tick)
        reject('没有找到对象上的' + name + '属性')
      }, maxTimeout)

      const re = () => setTimeout(() => {
        const targetObj = objFn || window
        const checkFn = targetObj instanceof Function
          ? prop => targetObj(prop)
          : prop => (targetObj.hasOwnProperty(prop), targetObj[prop])
        const res = checkFn(name)
        if (res) {
          window.clearTimeout(errorTick)
          resolve(res)
        } else {
          tick = re()
        }
      }, 25)

      tick = re()
    })
  }
  if (window) {
    window.waitUntilPropsLoaded = fn
  } else {
    return fn
  }
}

// 等待对象上某属性挂载完毕
const waitUntil = function () {
  const fn = (checkFn, maxTimeout = 5000) => {
    let tick
    return new Promise((resolve, reject) => {
      const errorTick = setTimeout(() => {
        tick && window.clearTimeout(tick)
        reject('等待超时')
      }, maxTimeout)

      const re = () => setTimeout(() => {
        const res = checkFn()
        if (res) {
          window.clearTimeout(errorTick)
          resolve(res)
        } else {
          tick = re()
        }
      }, 25)

      tick = re()
    })
  }
  if (window) {
    window.waitUntil = fn
  } else {
    return fn
  }
}

module.exports = {
  styles,
  waitUntil,
  waitUntilLoaded,
  waitUntilPropsLoaded
}
