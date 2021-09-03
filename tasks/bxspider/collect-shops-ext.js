// extensions: https://chrome.google.com/webstore/detail/user-javascript-and-css/nbhcbdghjpllgmfilhnhkllmkecfmpld

!(function () {
  const fn = ($elm, timeout = 300) => {
    let tick
    const target = typeof $elm === 'string'
      ? document.querySelector($elm)
      : $elm
    return new Promise((resolve, reject) => {
      if (!target) {
        console.log('跳过等待')
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
})()

!(async () => {
  await window.waitUntilLoaded('.exhibition-wrapper')
  const $shops = [...document.querySelectorAll('.exhibition')]
  const shops = $shops.map($shop => {
    const href = $shop.getAttribute('href') || ''
    const idMatch = href.match(/\/(.*)/)
    if (idMatch) {
      const [all, id] = idMatch
      const name = $shop.querySelector('.company-name').innerText.replace(/\s/g, '')
      const url = window.location.origin + href
      return {
        _id: id,
        name,
        href,
        ua: window.navigator.userAgent,
        referer: window.location.href,
        verify: '876'
      }
    } else {
      log.error('没有匹配到列表中某个店铺的数据')
      return null
    }
  })
  const uploads = shops.filter(x => x)
  console.log('[INFO]', uploads)
  fetch('http://172.17.5.55:3000/add-shops', {
    method: 'POST',
    body: JSON.stringify(uploads),
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json'
    }
  }).then(function (response) {
    return response.json()
  }).then(function (data) {
    console.log(data)
  }).catch(function (err) {
    console.log(err)
  })
})()
