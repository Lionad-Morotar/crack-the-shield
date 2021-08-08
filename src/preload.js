$ = undefined

(function (window) {

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
    value: null,
    get () {
      return null
    }
  })

})(window)