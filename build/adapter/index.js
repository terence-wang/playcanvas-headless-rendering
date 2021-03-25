export function createScopedPlaycanvas(window) {
    const navigator = window.navigator;
    const document = window.document;
    const Blob = window.Blob;
    const Image = window.Image;
    const Element = window.Element;
    const XMLHttpRequest = window.XMLHttpRequest;
    const HTMLCanvasElement = window.HTMLCanvasElement;
    const HTMLImageElement = window.Image;
    const HTMLVideoElement = window.HTMLVideoElement;
    const URL = window.URL;

    const exports = {};

    // playcanvas source code will be injected here
    __INJECT_PLAYCANVAS__;

    return exports;
}
