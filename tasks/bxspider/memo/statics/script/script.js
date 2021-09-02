function es(base64) {
  let res = ''
  const numStr = window['atob'](base64)
  for (let i = 0; i < numStr.length; i++) {
      res += String.fromCharCode(numStrcharCodeAt(i) - 10)
  }
  return res
}
