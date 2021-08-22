var app = {};

app.name = function () {return chrome.runtime.getManifest().name};
app.version = function () {return chrome.runtime.getManifest().version};
app.short = function () {return chrome.runtime.getManifest().short_name};
app.homepage = function () {return chrome.runtime.getManifest().homepage_url};
app.tab = {"open": function (url) {chrome.tabs.create({"url": url, "active": true})}};

if (!navigator.webdriver) {
  chrome.runtime.setUninstallURL(app.homepage() + "?v=" + app.version() + "&type=uninstall", function () {});
  chrome.runtime.onInstalled.addListener(function (e) {
    chrome.management.getSelf(function (result) {
      if (result.installType === "normal") {
        window.setTimeout(function () {
          var previous = e.previousVersion !== undefined && e.previousVersion !== app.version();
          var doupdate = previous && parseInt((Date.now() - config.welcome.lastupdate) / (24 * 3600 * 1000)) > 45;
          if (e.reason === "install" || (e.reason === "update" && doupdate)) {
            var parameter = (e.previousVersion ? "&p=" + e.previousVersion : '') + "&type=" + e.reason;
            app.tab.open(app.homepage() + "?v=" + app.version() + parameter);
            config.welcome.lastupdate = Date.now();
          }
        }, 3000);
      }
    });
  });
}

app.notification = {
  "id": (app.short() + "-fingerPrint-defender"),
  "clear": function () {chrome.notifications.clear(app.notification.id)},
  "create": function (message) {
    chrome.notifications.clear(app.notification.id);
    chrome.notifications.create(app.notification.id, {
      "type": "basic",
      "message": message,
      "title": app.name(),
      "iconUrl": chrome.runtime.getURL("data/icons/64.png")
    });
  }
};

app.contextmenu = (function () {
  var clicked;
  chrome.contextMenus.onClicked.addListener(function (e) {if (clicked) clicked(e)});
  /*  */
  return {
    "clicked": function (e) {clicked = e},
    "create": function () {
      chrome.contextMenus.removeAll(function () {
        chrome.contextMenus.create({
          "id": "test.page",
          "contexts": ["browser_action"],
          "title": "What is my Fingerprint"
        });
        /*  */
        chrome.contextMenus.create({
          "type": "checkbox",
          "contexts": ["browser_action"],
          "title": "Desktop Notifications",
          "checked": config.notification.show
        });
      });
    }
  };
})();

app.storage = (function () {
  var objs = {};
  window.setTimeout(function () {
    chrome.storage.local.get(null, function (o) {
      objs = o;
      var script = document.createElement("script");
      script.src = "../common.js";
      document.body.appendChild(script);
    });
  }, 0);
  /*  */
  return {
    "read": function (id) {return objs[id]},
    "write": function (id, data) {
      var tmp = {};
      tmp[id] = data;
      objs[id] = data;
      chrome.storage.local.set(tmp, function () {});
    }
  }
})();

app.popup = (function () {
  var tmp = {};
  chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    for (var id in tmp) {
      if (tmp[id] && (typeof tmp[id] === "function")) {
        if (request.path === "popup-to-background") {
          if (request.method === id) tmp[id](request.data);
        }
      }
    }
  });
  /*  */
  return {
    "receive": function (id, callback) {tmp[id] = callback},
    "send": function (id, data, tabId) {
      chrome.runtime.sendMessage({"path": "background-to-popup", "method": id, "data": data});
    }
  }
})();

app.content_script = (function () {
  var tmp = {};
  chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    for (var id in tmp) {
      if (tmp[id] && (typeof tmp[id] === "function")) {
        if (request.path === "page-to-background") {
          if (request.method === id) {
            tmp[id](request.data);
          }
        }
      }
    }
  });
  /*  */
  return {
    "receive": function (id, callback) {tmp[id] = callback},
    "send": function (id, data) {
      chrome.tabs.query({}, function (tabs) {
        tabs.forEach(function (tab) {
          chrome.tabs.sendMessage(tab.id, {"path": "background-to-page", "method": id, "data": data});
        });
      });
    }
  }
})();
