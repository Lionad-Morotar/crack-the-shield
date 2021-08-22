app.popup.receive("load", function (e) {
  app.popup.send("load", {
    "notifications": config.notification.show
  });
});

app.popup.receive("notifications", function () {
  config.notification.show = !config.notification.show;
  app.contextmenu.create();
  app.popup.send("load", {
    "notifications": config.notification.show
  });
});

app.content_script.receive("fingerprint", function (e) {
  var message = "\nA fingerprinting attempt is detected!\nYour browser is reporting a fake value.";
  if (config.notification.show) {
    if (config.notification.timeout) window.clearTimeout(config.notification.timeout);
    config.notification.timeout = window.setTimeout(function () {
      app.notification.create(e.host + message);
    }, 1000);
  }
});

app.contextmenu.clicked(function (e) {
  if (e.menuItemId === "test.page") app.tab.open(config.test.page);
  else {
    config.notification.show = !config.notification.show;
    app.contextmenu.create();
  }
});

window.setTimeout(app.contextmenu.create, 300);
app.popup.receive("support", function () {app.tab.open(app.homepage())});
app.popup.receive("fingerprint", function () {app.tab.open(config.test.page)});
app.popup.receive("donation", function () {app.tab.open(app.homepage() + "?reason=support")});
