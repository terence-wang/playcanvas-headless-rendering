var gl = require("gl");
var { createCanvas } = require("canvas");
var _events = new WeakMap();

module.exports = function Canvas(width, height) {
    var canvas = createCanvas(width, height);
    // 创建一个nodeGL
    var nodeGl = gl(width, height, { preserveDrawingBuffer: true });
    // getBoundingClientRect
    if (!("getBoundingClientRect" in canvas)) {
        canvas.getBoundingClientRect = function () {
            var ret = {
                x: 0,
                y: 0,
                top: 0,
                left: 0,
                width: canvas.width,
                height: canvas.height,
            };
            ret.right = ret.width;
            ret.bottom = ret.height;
            return ret;
        };
    }
    // clientRegion
    if (!("clientLeft" in canvas)) {
        canvas.clientLeft = 0;
        canvas.clientTop = 0;
    }
    if (!("clientWidth" in canvas)) {
        canvas.clientWidth = canvas.width;
        canvas.clientHeight = canvas.height;
    }
    // offsetRegion
    if (!("offsetLeft" in canvas)) {
        canvas.offsetLeft = 0;
        canvas.offsetTop = 0;
    }
    if (!("offsetWidth" in canvas)) {
        canvas.offsetWidth = canvas.width;
        canvas.offsetHeight = canvas.height;
    }
    // scrollRegion
    if (!("scrollLeft" in canvas)) {
        canvas.scrollLeft = 0;
        canvas.scrollTop = 0;
    }
    if (!("scrollWidth" in canvas)) {
        canvas.scrollWidth = canvas.width;
        canvas.scrollHeight = canvas.height;
    }
    Object.defineProperty(canvas, "style", {
        get() {
            return {
                width: canvas.width + "px",
                height: canvas.height + "px",
            };
        },
    });
    // 重写 getContext
    canvas.getContext = (name) => {
        if (name === "webgl") {
            return nodeGl;
        }
    };
    canvas.addEventListener = function (type, listener, options = {}) {
        let events = _events.get(this);
        if (!events) {
            events = {};
            _events.set(this, events);
        }
        if (!events[type]) {
            events[type] = [];
        }
        events[type].push(listener);
        if (options.capture) {
            console.warn("EventTarget.addEventListener: options.capture is not implemented.");
        }
        if (options.once) {
            console.warn("EventTarget.addEventListener: options.once is not implemented.");
        }
        if (options.passive) {
            console.warn("EventTarget.addEventListener: options.passive is not implemented.");
        }
    };
    canvas.removeEventListener = function (type, listener) {
        var events = _events.get(this);
        if (events) {
            var listeners = events[type];
            if (listeners && listeners.length > 0) {
                for (let i = listeners.length; i--; i > 0) {
                    if (listeners[i] === listener) {
                        listeners.splice(i, 1);
                        break;
                    }
                }
            }
        }
    };

    return canvas;
};
