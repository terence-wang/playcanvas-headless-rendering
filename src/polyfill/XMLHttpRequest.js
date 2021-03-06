/**
 * Wrapper for built-in http.js to emulate the browser XMLHttpRequest object.
 *
 * This can be used with JS designed for browsers to improve reuse of code and
 * allow the use of existing libraries.
 *
 * Usage: include("XMLHttpRequest.js") and use XMLHttpRequest per W3C specs.
 *
 * @author Dan DeFelippi <dan@driverdan.com>
 * @contributor David Ellis <d.f.ellis@ieee.org>
 * @contributor Guillaume Grossetie <ggrossetie@yuzutech.fr>
 * @contributor David Jencks <djencks@apache.org>
 * @license MIT
 */
var Url = require("url");
var fs = require("fs");
var ospath = require("path");

// 100 MB
var DEFAULT_MAX_BUFFER = 1000 * 1000 * 100;

exports.XMLHttpRequest = function () {
    "use strict";

    /**
     * Private variables
     */
    var self = this;
    var http = require("http");
    var https = require("https");

    // Holds http.js objects
    let request;
    let response;

    // Request settings
    let settings = {};

    // Disable header blacklist.
    // Not part of XHR specs.
    let disableHeaderCheck = false;

    // Set some default headers
    var defaultHeaders = {
        "User-Agent": "node-XMLHttpRequest",
        Accept: "*/*",
    };

    let headers = {};
    var headersCase = {};

    // These headers are not user setable.
    // The following are allowed but banned in the spec:
    // * user-agent
    var forbiddenRequestHeaders = [
        "accept-charset",
        "accept-encoding",
        "access-control-request-headers",
        "access-control-request-method",
        "connection",
        "content-length",
        "content-transfer-encoding",
        "cookie",
        "cookie2",
        "date",
        "expect",
        "host",
        "keep-alive",
        "origin",
        "referer",
        "te",
        "trailer",
        "transfer-encoding",
        "upgrade",
        "via",
    ];

    // These request methods are not allowed
    var forbiddenRequestMethods = ["TRACE", "TRACK", "CONNECT"];

    // Send flag
    let sendFlag = false;
    // Error flag, used when errors occur or abort is called
    let errorFlag = false;

    // Binary response (chunk)
    var responseBinary = [];

    // Event listeners
    var listeners = {};

    /**
     * varants
     */

    this.UNSENT = 0;
    this.OPENED = 1;
    this.HEADERS_RECEIVED = 2;
    this.LOADING = 3;
    this.DONE = 4;

    /**
     * Public vars
     */

    // Current state
    this.readyState = this.UNSENT;

    // default ready state change handler in case one is not set or is set late
    this.onreadystatechange = null;

    // Result & response
    this.responseText = "";
    this.responseXML = "";
    this.status = null;
    this.statusText = null;

    // Whether cross-site Access-Control requests should be made using
    // credentials such as cookies or authorization headers
    this.withCredentials = false;
    // "text", "arraybuffer", "blob", or "document", depending on your data needs.
    // Note, setting xhr.responseType = '' (or omitting) will default the response to "text".
    // Omitting, '', or "text" will return a String.
    // Other values will return an ArrayBuffer.
    this.responseType = "";

    /**
     * Private methods
     */

    /**
     * Check if the specified header is allowed.
     *
     * @param header - {string} Header to validate
     * @return {boolean} - False if not allowed, otherwise true
     */
    var isAllowedHttpHeader = function (header) {
        return disableHeaderCheck || (header && forbiddenRequestHeaders.indexOf(header.toLowerCase()) === -1);
    };

    /**
     * Check if the specified method is allowed.
     *
     * @param method - {string}  Request method to validate
     * @return {boolean} - False if not allowed, otherwise true
     */
    var isAllowedHttpMethod = function (method) {
        return method && forbiddenRequestMethods.indexOf(method) === -1;
    };

    /**
     * Public methods
     */

    /**
     * Open the connection. Currently supports local server requests.
     *
     * @param method - {string} Connection method (eg GET, POST)
     * @param url - {string} URL for the connection.
     * @param async - {boolean} Asynchronous connection. Default is true.
     * @param [user] - {string} Username for basic authentication (optional)
     * @param [password] - {string} Password for basic authentication (optional)
     */
    this.open = function (method, url, async, user, password) {
        this.abort();
        errorFlag = false;

        // Check for valid request method
        if (!isAllowedHttpMethod(method)) {
            throw new Error("SecurityError: Request method not allowed");
        }

        settings = {
            method: method,
            url: url.toString(),
            async: typeof async !== "boolean" ? true : async,
            user: user || null,
            password: password || null,
        };

        setState(this.OPENED);
    };

    /**
     * Disables or enables isAllowedHttpHeader() check the request. Enabled by default.
     * This does not conform to the W3C spec.
     *
     * @param state - {boolean} Enable or disable header checking.
     */
    this.setDisableHeaderCheck = function (state) {
        disableHeaderCheck = state;
    };

    /**
     * Sets a header for the request or appends the value if one is already set.
     *
     * @param header - {string} Header name
     * @param value - {string} Header value
     */
    this.setRequestHeader = function (header, value) {
        if (this.readyState !== this.OPENED) {
            throw new Error("INVALID_STATE_ERR: setRequestHeader can only be called when state is OPEN");
        }
        if (!isAllowedHttpHeader(header)) {
            console.warn('Refused to set unsafe header "' + header + '"');
            return;
        }
        if (sendFlag) {
            throw new Error("INVALID_STATE_ERR: send flag is true");
        }
        header = headersCase[header.toLowerCase()] || header;
        headersCase[header.toLowerCase()] = header;
        headers[header] = headers[header] ? headers[header] + ", " + value : value;
    };

    /**
     * Gets a header from the server response.
     *
     * @param header - {string} Name of header to get.
     * @return {Object} - Text of the header or null if it doesn't exist.
     */
    this.getResponseHeader = function (header) {
        if (
            typeof header === "string" &&
            this.readyState > this.OPENED &&
            response &&
            response.headers &&
            response.headers[header.toLowerCase()] &&
            !errorFlag
        ) {
            return response.headers[header.toLowerCase()];
        }

        return null;
    };

    /**
     * Gets all the response headers.
     *
     * @return string A string with all response headers separated by CR+LF
     */
    this.getAllResponseHeaders = function () {
        if (this.readyState < this.HEADERS_RECEIVED || errorFlag) {
            return "";
        }
        let result = "";

        for (var i in response.headers) {
            // Cookie headers are excluded
            if (i !== "set-cookie" && i !== "set-cookie2") {
                result += i + ": " + response.headers[i] + "\r\n";
            }
        }
        return result.substr(0, result.length - 2);
    };

    /**
     * Gets a request header
     *
     * @param name - {string} Name of header to get
     * @return {string} Returns the request header or empty string if not set
     */
    this.getRequestHeader = function (name) {
        if (typeof name === "string" && headersCase[name.toLowerCase()]) {
            return headers[headersCase[name.toLowerCase()]];
        }

        return "";
    };

    /**
     * Sends the request to the server.
     *
     * @param data - {string} Optional data to send as request body.
     */
    this.send = function (data) {
        if (this.readyState !== this.OPENED) {
            throw new Error("INVALID_STATE_ERR: connection must be opened before send() is called");
        }

        if (sendFlag) {
            throw new Error("INVALID_STATE_ERR: send has already been called");
        }
        let ssl = false;
        let local = false;
        var url = new Url.URL(settings.url);
        let host;
        // Determine the server
        switch (url.protocol) {
            case "https:":
                ssl = true;
                host = url.hostname;
                break;
            case "http:":
                host = url.hostname;
                break;
            case "file:":
                local = true;
                break;
            case undefined:
            case null:
            case "":
                host = "localhost";
                break;
            default:
                throw new Error("Protocol not supported.");
        }

        // Load files off the local filesystem (file://)
        if (local) {
            if (settings.method !== "GET") {
                throw new Error("XMLHttpRequest: Only GET method is supported");
            }
            if (settings.async) {
                fs.readFile(url, function (error, data) {
                    if (error) {
                        self.handleError(error, url);
                    } else {
                        self.status = 200;
                        if(Buffer.isBuffer(data)){
                            self.response = data.buffer;
                        }else{
                            self.response = data;
                        }
                        setState(self.DONE);
                    }
                });
            } else {
                try {
                    this.responseText = fs.readFileSync(url);
                    this.status = 200;
                    setState(self.DONE);
                } catch (e) {
                    this.handleError(e, url);
                }
            }

            return;
        }

        // Default to port 80. If accessing localhost on another port be sure
        // to use http://localhost:port/path
        var port = url.port || (ssl ? 443 : 80);
        // Add query string if one is used
        var uri = url.pathname + (url.search ? url.search : "");

        // Set the defaults if they haven't been set
        for (var name in defaultHeaders) {
            if (!headersCase[name.toLowerCase()]) {
                headers[name] = defaultHeaders[name];
            }
        }

        // Set the Host header or the server may reject the request
        headers.Host = host;
        // IPv6 addresses must be escaped with brackets
        if (url.host[0] === "[") {
            headers.Host = "[" + headers.Host + "]";
        }
        if (!((ssl && port === 443) || port === 80)) {
            headers.Host += ":" + url.port;
        }

        // Set Basic Auth if necessary
        if (settings.user) {
            if (typeof settings.password === "undefined") {
                settings.password = "";
            }
            var authBuf = Buffer.from(settings.user + ":" + settings.password);
            headers.Authorization = "Basic " + authBuf.toString("base64");
        }

        // Set content length header
        if (settings.method === "GET" || settings.method === "HEAD") {
            data = null;
        } else if (data) {
            headers["Content-Length"] = Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data);

            if (!this.getRequestHeader("Content-Type")) {
                headers["Content-Type"] = "text/plain;charset=UTF-8";
            }
        } else if (settings.method === "POST") {
            // For a post with no data set Content-Length: 0.
            // This is required by buggy servers that don't meet the specs.
            headers["Content-Length"] = 0;
        }

        var options = {
            host: host,
            port: port,
            path: uri,
            method: settings.method,
            headers: headers,
            agent: false,
            withCredentials: self.withCredentials,
        };

        var responseType = this.responseType || "text";

        // Reset error flag
        errorFlag = false;

        // Handle async requests
        if (settings.async) {
            // Use the proper protocol
            var doRequest = ssl ? https.request : http.request;

            // Request is being sent, set send flag
            sendFlag = true;

            // As per spec, this is called here for historical reasons.
            self.dispatchEvent("readystatechange");

            // Handler for the response
            var responseHandler = function responseHandler(resp) {
                // Set response var to the response we got back
                // This is so it remains accessable outside this scope
                response = resp;
                // Check for redirect
                // @TODO Prevent looped redirects
                if (
                    response.statusCode === 301 ||
                    response.statusCode === 302 ||
                    response.statusCode === 303 ||
                    response.statusCode === 307
                ) {
                    // Change URL to the redirect location
                    settings.url = response.headers.location;
                    var url = new Url.URL(settings.url);
                    // Set host var in case it's used later
                    host = url.hostname;
                    // Options for the new request
                    var newOptions = {
                        hostname: url.hostname,
                        port: url.port,
                        path: url.path,
                        method: response.statusCode === 303 ? "GET" : settings.method,
                        headers: headers,
                        withCredentials: self.withCredentials,
                    };

                    // Issue the new request
                    request = doRequest(newOptions, responseHandler).on("error", errorHandler);
                    request.end();
                    // @TODO Check if an XHR event needs to be fired here
                    return;
                }

                var encoding = responseType === "text" ? "utf8" : "binary";
                if (encoding === "utf8") {
                    response.setEncoding("utf8");
                }

                setState(self.HEADERS_RECEIVED);
                self.status = response.statusCode;

                if (encoding === "utf8") {
                    response.on("data", function (chunk) {
                        // Make sure there's some data
                        if (chunk) {
                            self.responseText += chunk;
                        }
                        // Don't emit state changes if the connection has been aborted.
                        if (sendFlag) {
                            setState(self.LOADING);
                        }
                    });

                    response.on("end", function () {
                        if (sendFlag) {
                            // Discard the end event if the connection has been aborted
                            setState(self.DONE);
                            sendFlag = false;
                        }
                    });
                } else {
                    response.on("data", function (chunk) {
                        // Make sure there's some data
                        if (chunk) {
                            responseBinary.push(chunk);
                        }
                        // Don't emit state changes if the connection has been aborted.
                        if (sendFlag) {
                            setState(self.LOADING);
                        }
                    });

                    response.on("end", function () {
                        // buffers are Uint8Array instances
                        self.response = Buffer.concat(responseBinary).buffer;
                        if (sendFlag) {
                            // Discard the end event if the connection has been aborted
                            setState(self.DONE);
                            sendFlag = false;
                        }
                    });
                }

                response.on("error", function (error) {
                    self.handleError(error, url);
                });
            };

            // Error handler for the request
            var errorHandler = function errorHandler(error) {
                self.handleError(error, url);
            };

            // Create the request
            request = doRequest(options, responseHandler).on("error", errorHandler);

            // Node 0.4 and later won't accept empty data. Make sure it's needed.
            if (data) {
                request.write(data);
            }

            request.end();

            self.dispatchEvent("loadstart");
        } else {
            // Synchronous
            var maxBuffer = process.env.UNXHR_MAX_BUFFER
                ? parseInt(process.env.UNXHR_MAX_BUFFER)
                : DEFAULT_MAX_BUFFER;
            var encoding = responseType === "text" ? "utf8" : "binary";
            var scriptPath = ospath.join(__dirname, "request.js");
            var output = require("child_process").execSync(
                `"${process.execPath}" "${scriptPath}" \
 --ssl="${ssl}" \
 --encoding="${encoding}" \
 --request-options=${JSON.stringify(JSON.stringify(options))}`,
                { stdio: ["pipe", "pipe", "pipe"], input: data, maxBuffer: maxBuffer }
            );
            var result = JSON.parse(output.toString("utf8"));
            if (result.error) {
                throw translateError(result.error, url);
            } else {
                response = result.data;
                self.status = result.data.statusCode;
                if (encoding === "binary") {
                    self.response = Uint8Array.from(result.data.binary.data).buffer;
                } else {
                    self.responseText = result.data.text;
                }
                setState(self.DONE);
            }
        }
    };

    /**
     * Called when an error is encountered to deal with it.
     */
    this.handleError = function (error, url) {
        this.status = 0;
        this.statusText = "";
        this.responseText = "";
        errorFlag = true;
        setState(this.DONE);
        this.dispatchEvent("error", { error: translateError(error, url) });
    };

    /**
     * Aborts a request.
     */
    this.abort = function () {
        if (request) {
            request.abort();
            request = null;
        }

        headers = defaultHeaders;
        this.status = 0;
        this.responseText = "";
        this.responseXML = "";

        errorFlag = true;

        if (
            this.readyState !== this.UNSENT &&
            (this.readyState !== this.OPENED || sendFlag) &&
            this.readyState !== this.DONE
        ) {
            sendFlag = false;
            setState(this.DONE);
        }
        this.readyState = this.UNSENT;
        this.dispatchEvent("abort");
    };

    /**
     * Adds an event listener. Preferred method of binding to events.
     */
    this.addEventListener = function (event, callback) {
        if (!(event in listeners)) {
            listeners[event] = [];
        }
        // Currently allows duplicate callbacks. Should it?
        listeners[event].push(callback);
    };

    /**
     * Remove an event callback that has already been bound.
     * Only works on the matching funciton, cannot be a copy.
     */
    this.removeEventListener = function (event, callback) {
        if (event in listeners) {
            // Filter will return a new array with the callback removed
            listeners[event] = listeners[event].filter(function (ev) {
                return ev !== callback;
            });
        }
    };

    /**
     * Dispatch any events, including both "on" methods and events attached using addEventListener.
     */
    this.dispatchEvent = function (event, args) {
        if (typeof self["on" + event] === "function") {
            self["on" + event](args);
        }
        if (event in listeners) {
            for (let i = 0, len = listeners[event].length; i < len; i++) {
                listeners[event][i].call(self, args);
            }
        }
    };

    /**
     * Changes readyState and calls onreadystatechange.
     *
     * @param state - {Number} New state
     */
    var setState = function (state) {
        if (state === self.LOADING || self.readyState !== state) {
            self.readyState = state;

            if (settings.async || self.readyState < self.OPENED || self.readyState === self.DONE) {
                self.dispatchEvent("readystatechange");
            }

            if (self.readyState === self.DONE && !errorFlag) {
                self.dispatchEvent("load");
                // @TODO figure out InspectorInstrumentation::didLoadXHR(cookie)
                self.dispatchEvent("loadend");
            }
        }
    };

    var translateError = function (error, url) {
        if (typeof error === "object") {
            if (error.code === "ENOTFOUND" || error.code === "EAI_AGAIN") {
                // XMLHttpRequest throws a DOMException when DNS lookup fails:
                // code: 19
                // message: "Failed to execute 'send' on 'XMLHttpRequest': Failed to load 'http://url/'."
                // name: "NetworkError"
                // stack: (...)
                return new Error(`Failed to execute 'send' on 'XMLHttpRequest': Failed to load '${url}'.`);
            }
            if (error instanceof Error) {
                return error;
            }
            return new Error(JSON.stringify(error));
        }
        return new Error(error);
    };
};
