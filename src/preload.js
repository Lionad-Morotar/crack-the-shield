// $ = undefined

Object.defineProperty(navigator, "language", {
  get() {
    return "zh-CN"
  }
})

// window.console && (window.console.log = (...args) => {})

/******************************************************** Utils */

// TODO toString.toString() 
function toNativeFn(obj, prop, fn) {
  // console.log(obj, prop, fn)
  fn.toString = () => `function ${fn.name}() { [native code] }`
  Object.defineProperty(obj, prop, {
    get () {
      return fn
    }
  })
}

/******************************************************** SetTimeout 拦截 */

const noop = () => 'do!nothing!'
window._setTimeout = window.setTimeout
window._clearTimeout = window.clearTimeout
window._cbs = {
  pools: [],
  record(cb, time, opts = {}) {
    const { skip = false, timeCheck } = opts
    try {
      const id = String(Math.random()).slice(-6) + '-' + (+new Date())
      const cbWrapper = async () => {
        try {
          await cb()
          const idx = window._cbs.pools.findIndex(x => x === id)
          window._cbs.pools.splice(idx, 1)
        } catch (cbError) {
          console.error('[ERR]', cbError)
        }
      }
      if (skip || time < 10) {
        // console.log('[INFO] skip record timeout')
        return window._setTimeout(cb, time)
      } else {
        time = timeCheck ? timeCheck(cb, time) : time
        const timeoutID = window._setTimeout(cbWrapper, time)
        window._cbs.pools.push({
          id,
          time,
          timeout: timeoutID,
          cb: cbWrapper,
          pause: false
        })
        // console.log('[INFO] record timeout')
        return timeoutID
      }
    } catch (recordError) {
      console.error('[ERR]', recordError)
      noop()
      return null
    }
  },
  pauseAll() {
    console.log('[INFO] pauseAll', window._cbs.pools)
    window._cbs.pools.map(item => {
      const { timeout, pause } = item
      if (!pause) {
        window._clearTimeout(timeout)
        item.pause = true
      }
    })
  },
  resumeAll() {
    console.log('[INFO] resumeAll', window._cbs.pools)
    window._cbs.pools.map(item => {
      const { cb, time, pause } = item
      if (pause) {
        item.timeout = window._setTimeout(cb, time)
        item.pause = false
      }
    })
  }
}

/* 篡改我们的地址计时，提高加载速度 */
toNativeFn(window, 'setTimeout', function (cb, time) {
  const timeCheck = (cb, time) => {
    const fnStr = cb.toString()
    if (fnStr.match(/nasnu1\[/)) {
      return 0
    } else {
      return time
    }
  }
  window._cbs.record(cb, time, {
    timeCheck
  })
})

/******************************************************** 防止 window.name、window.opener 属性泄露隐私 */

const windowNames = new WeakMap()
Object.defineProperty(window, 'name', {
  set(name) {
    windowNames.set(this, name)
  },
  get() {
    return windowNames.get(this) || ""
  }
})
Object.defineProperty(window, 'opener', {
  value: null
})