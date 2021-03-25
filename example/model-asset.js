const path = require("path");
const Jimp = require("jimp");
const { JSDOM } = require("jsdom");
const Canvas = require("../src/polyfill/canvas");
const Image = require("../src/polyfill/image");
const URL = require("../src/polyfill/URL");
const XMLHttpRequest = require("../src/polyfill/XMLHttpRequest").XMLHttpRequest;
const { createScopedPlaycanvas } = require("../src/playcanvas");

const width = 1024;
const height = 1024;

// get window
const { window } = new JSDOM(``, { url: "https://localhost", pretendToBeVisual: true });
window.innerWidth = width;
window.innerHeight = height;
window.Image = Image;
window.URL = URL;
window.XMLHttpRequest = XMLHttpRequest;

const canvas = new Canvas(window.innerWidth, window.innerHeight);
const canvasGl = canvas.getContext("webgl");

const pc = createScopedPlaycanvas(window);

// Create the app and start the update loop
var app = new pc.Application(canvas);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);

var entity, light, camera;

// Load a model file and create a Entity with a model component
var url = `file://${path.join(__dirname, "assets/models/statue.glb")}`;
app.assets.loadFromUrl(url, "container", function (err, asset) {
    app.start();

    entity = new pc.Entity();
    entity.addComponent("model", {
        type: "asset",
        asset: asset.resource.model,
        castShadows: true,
    });
    app.root.addChild(entity);

    // Create an Entity with a camera component
    camera = new pc.Entity();
    camera.addComponent("camera", {
        clearColor: new pc.Color(0.4, 0.45, 0.5),
    });
    camera.translate(0, 7, 24);
    app.root.addChild(camera);

    // Create an Entity with a point light component
    light = new pc.Entity();
    light.addComponent("light", {
        type: "point",
        color: new pc.Color(1, 1, 1),
        range: 100,
        castShadows: true,
    });
    light.translate(5, 0, 15);
    app.root.addChild(light);

    app.on("update", function (dt) {
        if (entity) {
            entity.rotate(0, 10 * dt, 0);
        }
    });

    app.preload(() => {
        setTimeout(() => {
            const bitmapData = new Uint8Array(width * height * 4);
            canvasGl.readPixels(0, 0, width, height, canvasGl.RGBA, canvasGl.UNSIGNED_BYTE, bitmapData);

            const image = new Jimp(
                {
                    data: Buffer.from(bitmapData),
                    width: width,
                    height: height,
                },
                function () {
                    const filename = path.basename(__filename).split(".").shift();
                    image.flip(false, true).writeAsync(`output/${filename}_${Date.now()}.png`);
                    setTimeout(() => {
                        process.exit(1);
                    }, 1000);
                }
            );
        }, 1000);
    });
});
