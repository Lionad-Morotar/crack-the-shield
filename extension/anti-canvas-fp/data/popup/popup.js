var background = (function () {
  var tmp = {};
  chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    for (var id in tmp) {
      if (tmp[id] && (typeof tmp[id] === "function")) {
        if (request.path === "background-to-popup") {
          if (request.method === id) tmp[id](request.data);
        }
      }
    }
  });
  /*  */
  return {
    "receive": function (id, callback) {tmp[id] = callback},
    "send": function (id, data) {chrome.runtime.sendMessage({"path": "popup-to-background", "method": id, "data": data})}
  }
})();

var load = function () {
  var ids = ["support", "donation", "fingerprint", "notifications"];
  for (var i = 0; i < ids.length; i++) {
    var icon = document.querySelector("." + ids[i]);
    var button = document.querySelector("#" + ids[i]);
    /*  */
    button.addEventListener("click", function (e) {background.send(e.target.id)});
    icon.addEventListener("click", function (e) {background.send(e.target.className.replace("icon ", ''))});
  }
  /*  */
  if (navigator.userAgent.indexOf("Edg") !== -1) {
    document.getElementById("explore").style.display = "none";
  }
  /*  */
  background.send("load");
  window.removeEventListener("load", load, false);
};

background.receive("load", function (e) {
  var name = document.querySelector(".name");
  var notifications = document.querySelector(".notifications");
  /*  */
  name.textContent = chrome.runtime.getManifest().name;
  notifications.textContent = e.notifications ? '☑' : '☐';
});

window.addEventListener("load", load, false);
