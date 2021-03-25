var getPixels = require("./libs/get-pixels");
var imagesSrc = new WeakMap();
var imagesData = new WeakMap();

function Image() {
    this.width = 0;
    this.height = 0;
    imagesSrc.set(this, null);
}
function onError(image, err) {
    if (typeof image.onerror === "function") {
        image.onerror(err);
    } else {
        throw err;
    }
}
function onLoad(image) {
    if (typeof image.onload === "function") {
        image.onload();
    }
}
Object.defineProperty(Image.prototype, "src", {
    get() {
        return imagesSrc.get(this);
    },
    set(val) {
        imagesSrc.set(this, val);
        if (typeof val === "string") {
            getPixels(val, (err, pixels) => {
                if (err) {
                    onError(this, err);
                    return;
                }
                this.width = pixels.shape[0];
                this.height = pixels.shape[1];
                imagesData.set(this, pixels.data);
                onLoad(this);
            });
        } else if (Buffer.isBuffer(val)) {
            imagesData.set(this, val);
        } else if (val === null) {
            imagesData.set(this, null);
        }
    },
});
Object.defineProperty(Image.prototype, "data", {
    get() {
        return imagesData.get(this);
    },
});

module.exports = Image;
