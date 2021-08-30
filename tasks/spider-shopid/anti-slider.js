const fs = require('fs')
const path = require('path')

const ocr = require('../../plugins/ocr')
const rembrandt = require('../../plugins/rembrandt')
const { findTroughs, log } = require('../../utils')

const slider_1_raw = fs.readFileSync(path.join(__dirname, './sliders/slider-1-raw.png'))
const slider_2_raw = fs.readFileSync(path.join(__dirname, './sliders/slider-2-raw.png'))
const slider_3_raw = fs.readFileSync(path.join(__dirname, './sliders/slider-3-raw.png'))
const slider_1_s1 = fs.readFileSync(path.join(__dirname, './sliders/slider-1-s1.png'))
const slider_2_s1 = fs.readFileSync(path.join(__dirname, './sliders/slider-2-s1.png'))
const slider_3_s1 = fs.readFileSync(path.join(__dirname, './sliders/slider-3-s1.png'))
const slider_1_s05 = fs.readFileSync(path.join(__dirname, './sliders/slider-1-s05.png'))
const slider_2_s05 = fs.readFileSync(path.join(__dirname, './sliders/slider-2-s05.png'))
const slider_3_s05 = fs.readFileSync(path.join(__dirname, './sliders/slider-3-s05.png'))
const slider_s05 = {
  1: slider_1_s05,
  2: slider_2_s05,
  3: slider_3_s05
}
const slider_s1 = {
  1: slider_1_s1,
  2: slider_2_s1,
  3: slider_3_s1
}

// 检测验证码并出错重试
module.exports = async function antiSlider(page, config) {

  const $slider = await page.evaluate(() => document.querySelector('.verify-img-panel'))
  if ($slider) {

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
    let num
    if (config.useLocalSliderNum) {
      num = 1
      log('use dev slider num' + num)
    } else {
      const ocrRes = await ocr.numbers(sliderImgBase64, 'base64')
      if (ocrRes && ocrRes.words_result_num >= 0) {
        num = ocrRes.words_result[0].words.split('')[0]
      } else {
        throw new Error('no slider number found')
      }
      log('slider num' + num)
    }

    // 找到是哪种类型的 slider
    const $sliderImg = await page.evaluateHandle(() => document.querySelector('.verify-img-panel img'))
    const sliderImg = await $sliderImg.screenshot()
    const typeRes = await Promise.all([
      rembrandt({
        imageA: sliderImg,
        imageB: slider_1_raw
      }),
      rembrandt({
        imageA: sliderImg,
        imageB: slider_2_raw
      }),
      rembrandt({
        imageA: sliderImg,
        imageB: slider_3_raw
      }),
    ])
    const minDifferences = Math.min(...typeRes.map(x => x.differences))
    const sliderTemplateID = typeRes.findIndex(x => x.differences === minDifferences) + 1
    if (sliderTemplateID) {
      log('slider template' + sliderTemplateID)
    } else {
      throw new Error('no slider type found')
    }

    // 设置滑块样式以方便图片比较
    const $sliderFloat = await page.evaluateHandle(() => document.querySelector('.verify-sub-block img'))
    await page.evaluate(async $sliderFloat => {
      $sliderFloat.setAttribute('style', 'filter:grayscale(1) brightness(.95) drop-shadow(0 0 2px #888);left: 0px')
    }, $sliderFloat)

    // 设置滑块图片样式以方便图片比较
    const $sliderBG = await page.evaluateHandle(() => document.querySelector('.verify-img-panel .block-bg'))
    await page.evaluate(async $sliderBG => {
      $sliderBG.setAttribute('style', 'filter:grayscale(1)')
    }, $sliderBG)

    // 用 10px 的速度取得局部最优解
    const $slider = await page.evaluateHandle(() => document.querySelector('.verify-slide'))
    await page.evaluate(async $slider => {
      $slider.setAttribute('style', 'transform:scale(0.5)')
    }, $slider)
    const res10px = []
    // 计算匹配程度
    let left = 85
    while (left <= 395) {
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
        imageB: slider_s05[sliderTemplateID]
      })
      res10px.push({
        left,
        diff: compareRes.differences
      })
      left += 15
    }

    // 过滤出3个波谷
    let res10px3left
    const res10pxThroughIdxs = findTroughs(res10px.map(x => x.diff))
    if (res10pxThroughIdxs.length === 3) {
      res10px3left = res10pxThroughIdxs.map(x => res10px[x])
    } else if (res10pxThroughIdxs.length > 3) {
      // 类聚阈值从 1 开始扩增直到只留下 3 个波谷
      // @see 调试可使用网站 https://echarts.apache.org/examples/zh/editor.html?c=line-simple
      let group = [], count = 10, threshold = 0
      while (count && (group.length !== 3)) {
        count--
        threshold++
        group = res10pxThroughIdxs.reduce((h, c) => {
          const find = h.find(x => Math.abs(x - c) <= threshold)
          if (find) {
            const leftItem = res10px[find].diff < res10px[c].diff ? find : c
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
        throw new Error('throughs not found')
      }
      if (group.length === 3) {
        res10px3left = group.map(x => res10px[x])
      }
    } else {
      throw new Error('throughs not enough')
    }

    // 遍历取得最优解
    await page.evaluate(async $slider => {
      $slider.setAttribute('style', '')
    }, $slider)
    const mudLeft = res10px3left[num - 1].left
    left = mudLeft - 7
    const res1px = []
    while (left <= mudLeft + 7) {
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
        imageB: slider_s1[sliderTemplateID]
      })
      res1px.push({
        left,
        diff: compareRes.differences
      })
      left += 1
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

    // 开始移动滑块
    const $move = await page.evaluateHandle(() => document.querySelector('.verify-move-block'))
    const moveBox = await $move.boundingBox()
    await page.mouse.move(
      moveBox.x + moveBox.width / 2,
      moveBox.y + moveBox.height / 2
    )
    await page.mouse.down()
    await sleep(Math.random() * 500 + 500)
    await page.mouse.move(
      moveBox.x + exactLeft,
      moveBox.y + moveBox.height / 2,
      { steps: 8 }
    )
    await page.mouse.up()
  }
}