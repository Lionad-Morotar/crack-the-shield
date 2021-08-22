var background = (function () {
  var tmp = {};
  chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    for (var id in tmp) {
      if (tmp[id] && (typeof tmp[id] === "function")) {
        if (request.path === "background-to-page") {
          if (request.method === id) tmp[id](request.data);
        }
      }
    }
  });
  /*  */
  return {
    "receive": function (id, callback) {tmp[id] = callback},
    "send": function (id, data) {chrome.runtime.sendMessage({"path": "page-to-background", "method": id, "data": data})}
  }
})();

var inject = function () {
  const toBlob = HTMLCanvasElement.prototype.toBlob;
  const toDataURL = HTMLCanvasElement.prototype.toDataURL;
  const getImageData = CanvasRenderingContext2D.prototype.getImageData;
  //
  var noisify = function (canvas, context) {
    if (context) {
      const shift = {
        'r': Math.floor(Math.random() * 10) - 5,
        'g': Math.floor(Math.random() * 10) - 5,
        'b': Math.floor(Math.random() * 10) - 5,
        'a': Math.floor(Math.random() * 10) - 5
      };
      //
      const width = canvas.width;
      const height = canvas.height;
      if (width && height) {
        const imageData = getImageData.apply(context, [0, 0, width, height]);
        for (let i = 0; i < height; i++) {
          for (let j = 0; j < width; j++) {
            const n = ((i * (width * 4)) + (j * 4));
            imageData.data[n + 0] = imageData.data[n + 0] + shift.r;
            imageData.data[n + 1] = imageData.data[n + 1] + shift.g;
            imageData.data[n + 2] = imageData.data[n + 2] + shift.b;
            imageData.data[n + 3] = imageData.data[n + 3] + shift.a;
          }
        }
        //
        window.top.postMessage("canvas-fingerprint-defender-alert", '*');
        context.putImageData(imageData, 0, 0); 
      }
    }
  };
  //
  Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", {
    "value": function () {
      noisify(this, this.getContext("2d"));
      return toBlob.apply(this, arguments);
    }
  });
  //
  Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
    "value": function () {
      noisify(this, this.getContext("2d"));
      return toDataURL.apply(this, arguments);
    }
  });
  //
  Object.defineProperty(CanvasRenderingContext2D.prototype, "getImageData", {
    "value": function () {
      noisify(this.canvas, this);
      return getImageData.apply(this, arguments);
    }
  });
  //
  document.documentElement.dataset.cbscriptallow = true;
};

var script_1 = document.createElement("script");
script_1.textContent = "(" + inject + ")()";
document.documentElement.appendChild(script_1);
script_1.remove();

if (document.documentElement.dataset.cbscriptallow !== "true") {
  var script_2 = document.createElement("script");
  script_2.textContent = `{
    const iframes = [...window.top.document.querySelectorAll("iframe[sandbox]")];
    for (var i = 0; i < iframes.length; i++) {
      if (iframes[i].contentWindow) {
        if (iframes[i].contentWindow.CanvasRenderingContext2D) {
          iframes[i].contentWindow.CanvasRenderingContext2D.prototype.getImageData = CanvasRenderingContext2D.prototype.getImageData;
        }
        if (iframes[i].contentWindow.HTMLCanvasElement) {
          iframes[i].contentWindow.HTMLCanvasElement.prototype.toBlob = HTMLCanvasElement.prototype.toBlob;
          iframes[i].contentWindow.HTMLCanvasElement.prototype.toDataURL = HTMLCanvasElement.prototype.toDataURL;
        }
      }
    }
  }`;
  //
  window.top.document.documentElement.appendChild(script_2);
  script_2.remove();
}

window.addEventListener("message", function (e) {
  if (e.data && e.data === "canvas-fingerprint-defender-alert") {
    background.send("fingerprint", {"host": document.location.host});
  }
}, false);
