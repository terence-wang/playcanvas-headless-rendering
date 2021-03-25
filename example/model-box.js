const path = require("path");
const Jimp = require("jimp");
const { JSDOM } = require("jsdom");
const Canvas = require("../src/polyfill/canvas");
const Image = require("../src/polyfill/image");
const { createScopedPlaycanvas } = require("../src/playcanvas");

const width = 1024;
const height = 1024;

// get window
const { window } = new JSDOM(``, { url: "https://localhost", pretendToBeVisual: true });
window.innerWidth = width;
window.innerHeight = height;
window.Image = Image;

const canvas = new Canvas(window.innerWidth, window.innerHeight);
const canvasGl = canvas.getContext("webgl");

const pc = createScopedPlaycanvas(window);

// Create the application and start the update loop
var app = new pc.Application(canvas);

app.start();

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);

// Create a Entity with a Box model component
var box = new pc.Entity();
box.addComponent("model", {
    type: "box",
});

// Create an Entity with a point light component and a sphere model component.
var light = new pc.Entity();
light.addComponent("light", {
    type: "point",
    color: new pc.Color(1, 0, 0),
    radius: 10,
});
light.addComponent("model", {
    type: "sphere",
});
// Scale the sphere down to 0.1m
light.setLocalScale(0.1, 0.1, 0.1);

// Create an Entity with a camera component
var camera = new pc.Entity();
camera.addComponent("camera", {
    clearColor: new pc.Color(0.4, 0.45, 0.5),
});

// Add the new Entities to the hierarchy
app.root.addChild(box);
app.root.addChild(light);
app.root.addChild(camera);

// Move the camera 10m along the z-axis
camera.translate(0, 0, 10);

// Set an update function on the app's update event
var angle = 0;
app.on("update", (dt) => {
    angle += dt;
    if (angle > 360) {
        angle = 0;
    }

    // Move the light in a circle
    light.setLocalPosition(3 * Math.sin(angle), 0, 3 * Math.cos(angle));

    // Rotate the box
    box.setEulerAngles(angle * 2, angle * 4, angle * 8);
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
