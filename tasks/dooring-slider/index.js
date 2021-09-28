const fs = require("fs");

const rembrandt = require("../../plugins/rembrandt");
const {
  getInstance,
  useRandomHeaders,
  useRandomUA,
  useCustomCSS,
  utils,
} = require("../../src/chrome");
const { sleep, dir } = require("../../utils");
const { waitUntilLoaded } = require("../../utils/dom");
const preloadFile = fs.readFileSync(dir("src/preload.js"), "utf8");

const getPage = async () => {
  const chrome = await getInstance();
  const page = await chrome.newPage();
  await useRandomHeaders(page, {
    "Accept-Language": "zh-CN,zhq=0.9,en-USq=0.8,en",
  });
  await page.setDefaultNavigationTimeout(30 * 1000);
  await page.evaluateOnNewDocument(preloadFile);
  await page.evaluateOnNewDocument(waitUntilLoaded);
  await page.setViewport(utils.setViewport());
  await useRandomUA(page);
  await useCustomCSS(
    page,
    `
    #hello-react-slider-vertify + p:nth-child(2) { display: none }
    .markdown, .markdown + div, .refreshIcon { display: none }
    #Vertify-demo-4 { display: block }
    .canvasArea { display: flex; blur(0.5px) }
  `
  );
  return page;
};

(async () => {
  const page = await getPage();

  await page.goto("http://h5.dooring.cn/slider-vertify");

  // 打开菜单进入页面

  const innerPageSelector = ".__dumi-default-menu-list li:nth-child(2)";
  await page.waitForSelector(innerPageSelector);
  await page.click(innerPageSelector);

  // 等待所有图片加载完（不然之后可能捕获到不正确的图片）
  await sleep(2500);

  // 找到滑动验证码并等待加载

  await page.waitForSelector("#Vertify-demo-4");
  await page.hover("#Vertify-demo-4 > div > div");
  const $show4thSliderButton = await page.$("#Vertify-demo-4 > div > div");
  await $show4thSliderButton.click();
  let rawImage;
  await page.waitForResponse(async (res) => {
    // console.log(res.url(), res.url().match(/160/) && res.status() === 200);
    if (res.url().match(/160/) && res.status() === 200) {
      rawImage = await res.buffer();
      return true;
    } else {
      return false;
    }
  });
  await page.evaluate(async () => {
    await waitUntilLoaded("#Vertify-demo-4 .canvasArea canvas", 1000);
  });
  await sleep(500);

  /* 滑滑块相关变量初始化 */

  const $sliderFloat = await page.$(
    "#Vertify-demo-4 .canvasArea canvas:nth-child(2)"
  );
  const setLeft = async (left) => {
    await page.evaluate(
      async ($sliderFloat, left) => {
        $sliderFloat.setAttribute("style", `left: ${left}px`);
      },
      $sliderFloat,
      left
    );
  };
  const compare = async () => {
    const $panel = await page.$("#Vertify-demo-4 .canvasArea");
    const panelImgBase64 = await $panel.screenshot({
      type: "jpeg",
    });
    // * for test
    // if (left === 45) {
    //   await $panel.screenshot({
    //     type: "jpeg",
    //     path: "./tasks/dooring-slider/test-shot2.jpg",
    //   });
    //   fs.writeFileSync("./tasks/dooring-slider/test-shot1.jpg", rawImage);
    // }
    return await rembrandt({
      imageA: panelImgBase64,
      imageB: rawImage,
    });
  };

  // 用 15px 速度取得局部最优解
  let left = 45;
  const max15Offset = 265;
  const res15px = [];
  while (left <= max15Offset) {
    await setLeft(left);
    const compareRes = await compare();
    res15px.push({
      left,
      diff: compareRes.differences,
    });
    left += 15;
  }
  // await page.evaluate((res15px) => console.log(res15px), res15px);

  // 用 2px 速度取得局部最优解
  const min15pxDiff = Math.min(...res15px.map((x) => x.diff));
  const min15pxLeft = res15px.find((x) => x.diff === min15pxDiff).left;
  left = min15pxLeft - 12;
  const max2Offset = min15pxLeft + 8;
  const res2px = [];
  while (left <= max2Offset) {
    await setLeft(left);
    const compareRes = await compare();
    res2px.push({
      left,
      diff: compareRes.differences,
    });
    left += 2;
  }
  // await page.evaluate((res2px) => console.log(res2px), res2px);

  // 用 1px 速度取得局部最优解
  const min2pxDiff = Math.min(...res2px.map((x) => x.diff));
  const min2pxLeft = res2px.find((x) => x.diff === min2pxDiff).left;
  left = min2pxLeft - 3;
  const max1Offset = min2pxLeft + 2;
  const res1px = [];
  while (left <= max1Offset) {
    await setLeft(left);
    const compareRes = await compare();
    res1px.push({
      left,
      diff: compareRes.differences,
    });
    left += 1;
  }
  // await page.evaluate((res1px) => console.log(res1px), res1px);
  const minDiff = Math.min(...res1px.map((x) => x.diff));
  const exactLeft = res1px.find((x) => x.diff === minDiff).left;

  // * for test
  // const exactLeft = 145

  /* 移动滑块 */

  await page.evaluate(($sliderFloat) => {
    $sliderFloat.setAttribute("style", `left: 0px`);
  }, $sliderFloat);

  await page.evaluate(() => {
    window.addEventListener("mousedown", (e) => console.log(e));
    window.addEventListener("mouseup", (e) => console.log(e));
  });

  const getRandOffset = (enableNegative = true, max = 3) => {
    const negative = enableNegative ? (Math.random() < 0.5 ? -1 : 1) : 1;
    return Math.floor(Math.random() * max) * negative;
  };

  // 白色高光边缘误差
  const edgeOffset = 4;

  const $move = await page.$("#Vertify-demo-4 .sliderIcon");
  const moveBox = await $move.boundingBox();
  const targets = [
    {
      time: 800,
      x:
        moveBox.x +
        moveBox.width / 2 +
        exactLeft +
        edgeOffset +
        getRandOffset(false, 15),
      y: moveBox.y + moveBox.height / 2 + getRandOffset(false, 5),
      steps: 10,
    },
    {
      time: 100,
      x: moveBox.x + moveBox.width / 2 + exactLeft + edgeOffset,
      y: moveBox.y + moveBox.height / 2,
      steps: 3,
    },
  ];
  await page.hover("#Vertify-demo-4 .sliderIcon");
  const now = {
    x: moveBox.x + moveBox.width / 2,
    y: moveBox.y + moveBox.height / 2,
  };

  await page.mouse.down();
  for await (const target of targets) {
    const step = {
      x: Math.floor((target.x - now.x) / target.steps),
      y: Math.floor((target.y - now.y) / target.steps),
      time: target.time / target.steps,
    };
    let gap;
    while (((gap = Math.abs(target.x - now.x)), gap > 0)) {
      await sleep(step.time);
      // 最后一步就直接滑动到位，不需要随机数了
      const inOneStep = Math.abs(target.x - now.x) <= Math.abs(step.x);
      if (inOneStep) {
        now.x = target.x;
        now.y = target.y;
      } else {
        now.x += step.x + getRandOffset();
        now.y += step.y + getRandOffset();
      }
      await page.mouse.move(now.x, now.y);
    }
  }
  await sleep(100);
  page.on("dialog", async (dialog) => {
    await sleep(3000);
    console.log(dialog.accept());
  });
  await page.mouse.up();
})();
