var { implSymbol } = require("jsdom/lib/jsdom/living/generated/utils.js");
var path = require("path");
var { writeFileSync, unlinkSync } = require("fs");
var mime = require("mime-types");

var map = {};
var URL = {};

URL.createObjectURL = (blob) => {
    var uuid = Math.random().toString(36).slice(2);
    var extension = mime.extension(blob.type);
    var savePath = `cache/${uuid}.${extension}`;
    writeFileSync(savePath, blob[implSymbol]._buffer);
    var url = `file://${path.join(__dirname, "../../", savePath)}`;
    map[url] = savePath;
    return url;
};
URL.revokeObjectURL = (url) => {
    unlinkSync(map[url]);
    delete map[url];
};
module.exports = URL;
