
(function () {
  const _0x19d1f5 = io(wsUrl, { transports: ["websocket"] });
  $("#view-owner")['on']("click", function () {
    _0x19d1f5["emit"]('i-want-a-name', uid, (_0x3c4d69) => {
      $("#owner")['html'](_0x3c4d69), $("#view-owner")['hide']();
    });
  }),
    $('#view-owner')['on']("click", function () {
      $["ajax"]({
        url: "/detail/" + uid + "/mobile",
        success: function (_0x27c507) {
          const _0x21b15d = es(_0x27c507["data"]);
          $('#phone-number')["html"](_0x21b15d),
            $('#view-owner')['hide']();
        },
      });
    });
  var _0x1851a6 = 1;
  function _0x1d4efe() {
    var _0x1133d3 = nasnu1["substr"](0, _0x1851a6);
    $("#addressText")["html"](_0x1133d3), _0x1851a6++;
    if (_0x1851a6 > nasnu1["length"]) return;
    setTimeout(_0x1d4efe, 80);
  }
  _0x1d4efe();
})();
