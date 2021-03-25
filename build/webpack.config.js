const fs = require("fs");
const path = require("path");
const StringReplacePlugin = require("string-replace-webpack-plugin");

function resolvePlaycanvasModule() {
    const playcanvasPath = require.resolve("playcanvas");
    const code = fs.readFileSync(path.resolve(playcanvasPath), "utf8");
    return code;
}

module.exports = {
    entry: path.join(__dirname, "./adapter/index.js"),
    target: "node",
    output: {
        path: path.join(__dirname, "../src"),
        filename: "playcanvas.js",
        libraryTarget: "commonjs",
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                loader: "babel-loader",
                options: {
                    presets: ["@babel/preset-env"],
                    plugins: ["@babel/plugin-proposal-class-properties"],
                },
            },
            {
                test: /\index.js$/,
                loader: StringReplacePlugin.replace({
                    replacements: [
                        {
                            pattern: /__INJECT_PLAYCANVAS__/gi,
                            replacement: () => {
                                return resolvePlaycanvasModule();
                            },
                        },
                    ],
                }),
            },
        ],
    },
    plugins: [
        // an instance of the plugin must be present
        new StringReplacePlugin(),
    ],
    optimization: {
        minimize: true,
    },
};
