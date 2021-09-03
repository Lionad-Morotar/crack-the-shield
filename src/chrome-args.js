/**
 * try to speed up chrome
 * @see https://github.com/puppeteer/puppeteer/issues/3938
 */
module.exports = [
  '--autoplay-policy=user-gesture-required',
  // '--disable-canvas-aa',
  // '--disable-2d-canvas-clip-aa',
  // '--disable-gl-drawing-for-tests',
  '--disable-background-networking',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-breakpad',
  '--disable-client-side-phishing-detection',
  '--disable-component-update',
  '--disable-default-apps',
  '--disable-dev-shm-usage',
  '--disable-domain-reliability',
  '--disable-extensions',
  '--disable-features=AudioServiceOutOfProcess',
  '--disable-hang-monitor',
  '--disable-ipc-flooding-protection',
  '--disable-notifications',
  '--disable-offer-store-unmasked-wallet-cards',
  '--disable-popup-blocking',
  '--disable-print-preview',
  '--disable-prompt-on-repost',
  '--disable-renderer-backgrounding',
  '--disable-setuid-sandbox',
  '--disable-speech-api',
  '--disable-sync',
  '--hide-scrollbars',
  '--ignore-gpu-blacklist',
  '--metrics-recording-only',
  '--mute-audio',
  '--no-default-browser-check',
  '--no-first-run',
  '--disable-infobars',
  '--no-pings',
  '--no-sandbox',
  '--no-zygote',
  '--password-store=basic',
  '--use-gl=swiftshader',
  '--use-mock-keychain',
  '--user-data-dir=D:/@Github/crack-the-shield/cache',
  /**
   * remove cors
   * @see https://github.com/puppeteer/puppeteer/issues/4889
   **/
  '--disable-features=OutOfBlinkCors',
  '--disable-web-security',
  /* remove cors end */
]