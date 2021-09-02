const fs = require('fs')
const path = require('path')

const ocr = require('../../plugins/ocr')
const rembrandt = require('../../plugins/rembrandt')
const { findTroughs, sleep, log } = require('../../utils')

const MAX_RETRY = 3

// 检测验证码并出错重试
module.exports = async function antiSlider(page, config, retry) {
  if ((retry+1) > MAX_RETRY) {
    throw new Error('超过最大验证码次数')
  }
  const checkHasSlider = async () => {
    return await page.evaluate(() => document.querySelector('.verify-img-panel'))
  }

  const $slider = await checkHasSlider()
  if ($slider) {

    throw new Error('跳过验证码！')

    // 等子滑块加载完毕...
    await page.evaluate(async () => {
      await waitUntil(() => {
        const $elm = document.querySelector('.verify-sub-block img')
        return $elm && $elm.getAttribute('src').length > 50
      }, 10 * 1000)
    })

    const sliderImgBase64 = await page.evaluate(async () => (
      await waitUntilPropsLoaded('src', () => {
        const $elm = document.querySelector('.verify-img-panel img')
        return $elm && $elm.getAttribute('src')
      }, 10 * 1000))
    )

    // 找到要滑到第几个滑块
    // TODO 破解新的滑块
    let num
    if (config.sliderNum) {
      num = config.sliderNum
      log('移动至滑块：' + num)
    } else {
      const ocrRes = await ocr.numbers(sliderImgBase64, 'base64')
      if (ocrRes && ocrRes.words_result_num >= 0) {
        num = ocrRes.words_result[0].words.split('')[0]
      } else {
        num = 2
        log(`没有找到滑块，使用随机值: ${num}`)
      }
      log('移动至滑块：' + num)
    }

    // 设置滑块图片样式以方便图片比较
    const $sliderBG = await page.evaluateHandle(() => document.querySelector('.verify-img-panel .block-bg'))
    await page.evaluate(async $sliderBG => {
      $sliderBG.setAttribute('style', 'filter:grayscale(1)')
    }, $sliderBG)

    // 设置缩放（加速图片匹配）
    const $slider = await page.evaluateHandle(() => document.querySelector('.verify-slide'))
    await page.evaluate(async $slider => {
      $slider.setAttribute('style', 'transform:scale(0.5)')
    }, $slider)
    await sleep(100)

    // 保存基准图片
    const $sliderFloat = await page.evaluateHandle(() => document.querySelector('.verify-sub-block img'))
    await page.evaluate(async $sliderFloat => {
      $sliderFloat.setAttribute('style', 'opacity: 0')
    }, $sliderFloat)
    await sleep(100)
    const $panel_05 = await page.evaluateHandle(() => document.querySelector('.verify-img-panel'))
    const panelImg_05_Base64 = await $panel_05.screenshot({
      type: 'jpeg'
    })
    const sliderFloatStyle = `filter: grayscale(1) brightness(0.95)`
    await page.evaluate(async ($sliderFloat, sliderFloatStyle) => {
      $sliderFloat.setAttribute('style', `${sliderFloatStyle};left: 0px`)
    }, $sliderFloat, sliderFloatStyle)
    await sleep(100)

    // 用 15px 的速度取得局部最优解
    const res15px = []
    // 计算匹配程度
    let left = 75
    while (left <= 410) {
      await page.evaluate(async ($sliderFloat, left) => {
        const rawStyle = $sliderFloat.getAttribute('style')
        $sliderFloat.setAttribute('style', rawStyle.replace(/left:\s*\d+px/, `left: ${left}px`))
      }, $sliderFloat, left)
      const $panel = await page.evaluateHandle(() => document.querySelector('.verify-img-panel'))
      const panelImgBase64 = await $panel.screenshot({
        type: 'jpeg'
      })
      const compareRes = await rembrandt({
        imageA: panelImgBase64,
        imageB: panelImg_05_Base64
      })
      res15px.push({
        left,
        diff: compareRes.differences
      })
      left += 15
    }

    // 过滤出3个波谷
    let res15px3left
    const res15pxThroughIdxs = findTroughs(res15px.map(x => x.diff))
    if (res15pxThroughIdxs.length === 3) {
      res15px3left = res15pxThroughIdxs.map(x => res15px[x])
    } else if (res15pxThroughIdxs.length > 3) {
      // 类聚阈值从 1 开始扩增直到只留下 3 个波谷
      // @see 调试可使用网站 https://echarts.apache.org/examples/zh/editor.html?c=line-simple
      let group = [], count = 10, threshold = 0
      while (count && (group.length !== 3)) {
        count--
        threshold++
        group = res15pxThroughIdxs.reduce((h, c) => {
          const find = h.find(x => Math.abs(x - c) <= threshold)
          if (find) {
            const leftItem = res15px[find].diff < res15px[c].diff ? find : c
            if (leftItem === c) {
              h.splice(h.findIndex(x => x === find), 1, c)
            }
          } else {
            h.push(c)
          }
          return h
        }, [])
      }
      if (!count) {
        throw new Error('没有找到波谷：' + res15px.map(x => x.diff).join(','))
      }
      if (group.length === 3) {
        res15px3left = group.map(x => res15px[x])
      }
    } else {
      throw new Error('波谷不够：' + res15px.map(x => x.diff).join(','))
    }
    log('取得大致结果：' + res15px.map(x => x.diff).join(','))

    // 遍历取得最优解

    // 取消缩放
    await page.evaluate(async $slider => {
      $slider.setAttribute('style', '')
    }, $slider)

    await page.evaluate(async $sliderFloat => {
      $sliderFloat.setAttribute('style', 'opacity: 0')
    }, $sliderFloat)
    await sleep(100)
    const $panel_10 = await page.evaluateHandle(() => document.querySelector('.verify-img-panel'))
    const panelImg_10_Base64 = await $panel_10.screenshot({
      type: 'jpeg'
    })
    await page.evaluate(async ($sliderFloat, sliderFloatStyle) => {
      $sliderFloat.setAttribute('style', `${sliderFloatStyle};left: 0px`)
    }, $sliderFloat, sliderFloatStyle)
    await sleep(100)

    const mudLeft = res15px3left[num - 1].left
    left = mudLeft - 12
    const res1px = []
    while (left <= mudLeft + 12) {
      await page.evaluate(async ($sliderFloat, left) => {
        const rawStyle = $sliderFloat.getAttribute('style')
        $sliderFloat.setAttribute('style', rawStyle.replace(/left:\s*\d+px/, `left: ${left}px`))
      }, $sliderFloat, left)
      const $panel = await page.evaluateHandle(() => document.querySelector('.verify-img-panel'))
      const panelImgBase64 = await $panel.screenshot({
        type: 'jpeg'
      })
      const compareRes = await rembrandt({
        imageA: panelImgBase64,
        imageB: panelImg_10_Base64
      })
      res1px.push({
        left,
        diff: compareRes.differences
      })
      left += 2
    }
    const min1pxDiff = Math.min(...res1px.map(x => x.diff))
    const exactLeft = res1px.find(x => x.diff === min1pxDiff).left

    // 重置样式
    await page.evaluate(async $sliderFloat => {
      $sliderFloat.setAttribute('style', '')
    }, $sliderFloat)
    await page.evaluate(async $sliderBG => {
      $sliderBG.setAttribute('style', '')
    }, $sliderBG)

    // 模拟人肉移动滑块
    const $move = await page.evaluateHandle(() => document.querySelector('.verify-move-block'))
    const moveBox = await $move.boundingBox()
    await page.mouse.move(
      moveBox.x + moveBox.width / 2,
      moveBox.y + moveBox.height / 2
    )
    await page.mouse.down()
    await sleep(Math.random() * 550 + 300)
    await page.mouse.move(
      moveBox.x + exactLeft,
      moveBox.y + moveBox.height / 2,
      { steps: 8 }
    )
    await sleep(Math.random() * 50)
    await page.mouse.move(
      moveBox.x + exactLeft + (moveBox.width / 2),
      moveBox.y + moveBox.height / 2,
      { steps: 1 }
    )
    await sleep(Math.random() * 50)
    await page.mouse.move(
      moveBox.x + exactLeft + (moveBox.width / 2),
      moveBox.y + moveBox.height / 2,
      { steps: 1 }
    )
    await page.mouse.up()

    log(`向右移动：${exactLeft}px`)
    const moveResponse = await page.waitForResponse(res => {
      const validRes = res.url().length <= 400 && res.url().match(/check/)
      if (validRes) log('移动结果：' + res.status())
      return validRes && res.status()
    })

    // 等待页面跳转（或重试验证码）
    if (moveResponse.status() === 400) {
      await page.waitForResponse(res => {
        const validRes = res.url().match(/get/) && res.status() === 200
        if (validRes) log('重新获取验证码：' + res.status())
        return validRes && res.status()
      })
      await sleep(200)
      await antiSlider(page, config, retry + 1)
    } else {
      await page.waitForNavigation({ timeout: 15 * 1000 * page._timeRatio })
    }

  } else {
    return 'skip'
  }
}