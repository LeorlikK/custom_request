var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _AxiosClient_instances, _AxiosClient_request, _GotClient_instances, _GotClient_request;
import Bottleneck from "bottleneck";
import loggerWinston from "./loggerWinston.js";
import chalk from "chalk";
import got from "got";
import axios from "axios";
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { format as formatUrl, parse as parseUrl } from 'url';
class BaseClient {
    constructor() {
        this.headers = {};
        this.cookies = {};
        this.timeout = 20000;
        this.assignResponseCookie = false;
    }
    buildQueryString(params) {
        return Object.entries(params)
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
            .join("&");
    }
    buildRequestString(url, params) {
        const urlObj = parseUrl(url, true);
        let combinedParams = Object.assign(Object.assign({}, urlObj.query), params);
        urlObj.search = '';
        //@ts-ignore
        urlObj.query = combinedParams;
        return formatUrl(urlObj);
    }
    setHeaders(newHeaders) {
        this.headers = Object.assign(Object.assign({}, this.headers), newHeaders);
    }
    removeHeaders(headerKeys) {
        for (const key of headerKeys) {
            delete this.headers[key];
        }
    }
    setCookies(newCookies) {
        this.cookies = Object.assign(Object.assign({}, this.cookies), newCookies);
    }
    removeCookies(cookieKeys) {
        for (const key of cookieKeys) {
            delete this.cookies[key];
        }
    }
    setResponseCookie(res) {
        var _a;
        (_a = res.headers["set-cookie"]) === null || _a === void 0 ? void 0 : _a.forEach((newCookie) => {
            const [cookie] = newCookie.split(';');
            const [name, value] = cookie.split('=');
            this.cookies[name.trim()] = value.trim();
        });
    }
    setTimeout(time) {
        this.timeout = time;
    }
    setProxy(proxy) {
        this.proxy = proxy;
    }
    removeProxy() {
        this.proxy = undefined;
    }
    removeTimeout() {
        this.timeout = 20000;
    }
    determineAgent(proxy) {
        const url = new URL(proxy);
        switch (url.protocol) {
            case 'http:':
            case 'https:':
                return new HttpsProxyAgent(proxy);
            case 'socks4:':
            case 'socks5:':
                return new SocksProxyAgent(proxy);
            default:
                throw new Error(`Unsupported proxy protocol: ${url.protocol}`);
        }
    }
    getCookiesHeader(configCookie) {
        Object.entries(this.cookies).forEach(([key, value]) => {
            if (!configCookie.hasOwnProperty(key))
                configCookie[key] = value;
        });
        return Object.entries(configCookie)
            .map(([key, value]) => `${key}=${value}`)
            .join("; ");
    }
    getHeaders(configHeaders) {
        Object.entries(this.headers).forEach(([key, value]) => {
            if (!configHeaders.hasOwnProperty(key))
                configHeaders[key] = value;
        });
        return configHeaders;
    }
    setAssignResponseCookie(flag) {
        this.assignResponseCookie = flag;
    }
    settingConfig(configSettings) {
        configSettings.headers = Object.assign(Object.assign({}, this.getHeaders(configSettings.headers)), { Cookie: this.getCookiesHeader(configSettings.cookie) });
        delete configSettings.proxy;
        delete configSettings.cookie;
    }
}
class AxiosClient extends BaseClient {
    constructor() {
        super(...arguments);
        _AxiosClient_instances.add(this);
    }
    get(url_1) {
        return __awaiter(this, arguments, void 0, function* (url, options = {}) {
            const { params = {}, headers = {}, cookie = {}, proxy } = options;
            const finalUrl = this.buildRequestString(url, params);
            return yield __classPrivateFieldGet(this, _AxiosClient_instances, "m", _AxiosClient_request).call(this, (config) => __awaiter(this, void 0, void 0, function* () {
                return yield axios.get(finalUrl, config);
            }), {
                headers, cookie, proxy
            });
        });
    }
    post(url_1, data_1) {
        return __awaiter(this, arguments, void 0, function* (url, data, options = {}) {
            const { headers = {}, cookie = {}, proxy } = options;
            return yield __classPrivateFieldGet(this, _AxiosClient_instances, "m", _AxiosClient_request).call(this, (config) => __awaiter(this, void 0, void 0, function* () {
                return yield axios.post(url, data, config);
            }), {
                headers, cookie, proxy
            });
        });
    }
    settingConfig(configSettings) {
        if (configSettings.proxy) {
            configSettings.httpsAgent = this.determineAgent(configSettings.proxy);
        }
        else if (this.proxy) {
            configSettings.httpsAgent = this.determineAgent(this.proxy);
        }
        if (this.timeout && !configSettings.timeout) {
            configSettings.timeout = this.timeout;
        }
        super.settingConfig(configSettings);
    }
}
_AxiosClient_instances = new WeakSet(), _AxiosClient_request = function _AxiosClient_request(execute, configSettings) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            this.settingConfig(configSettings);
            const res = yield execute(configSettings);
            if (this.assignResponseCookie)
                this.setResponseCookie(res);
            return {
                success: true,
                code: res.status,
                message: res.statusText,
                data: res.data
            };
        }
        catch (e) {
            return {
                success: false,
                code: ((_a = e.response) === null || _a === void 0 ? void 0 : _a.status) || 500,
                message: e.message,
            };
        }
    });
};
class GotClient extends BaseClient {
    constructor() {
        super(...arguments);
        _GotClient_instances.add(this);
    }
    get(url_1) {
        return __awaiter(this, arguments, void 0, function* (url, options = {}) {
            const { params = {}, headers = {}, cookie = {}, proxy } = options;
            const finalUrl = this.buildRequestString(url, params);
            return yield __classPrivateFieldGet(this, _GotClient_instances, "m", _GotClient_request).call(this, (config) => __awaiter(this, void 0, void 0, function* () {
                return yield got.get(finalUrl, config);
            }), {
                headers, cookie, proxy
            });
        });
    }
    post(url_1, data_1) {
        return __awaiter(this, arguments, void 0, function* (url, data, options = {}) {
            const { headers = {}, cookie = {}, proxy } = options;
            return yield __classPrivateFieldGet(this, _GotClient_instances, "m", _GotClient_request).call(this, (config) => __awaiter(this, void 0, void 0, function* () {
                return yield got.post(url, Object.assign({ json: data }, config));
            }), {
                headers, cookie, proxy
            });
        });
    }
    settingConfig(configSettings) {
        if (configSettings.proxy) {
            configSettings.agent = {
                https: this.determineAgent(configSettings.proxy)
            };
        }
        else if (this.proxy) {
            configSettings.agent = {
                https: this.determineAgent(this.proxy)
            };
        }
        if (this.timeout && !configSettings.timeout) {
            configSettings.timeout = { request: this.timeout };
        }
        else if (configSettings.timeout) {
            configSettings.timeout = { request: configSettings.timeout };
        }
        super.settingConfig(configSettings);
    }
}
_GotClient_instances = new WeakSet(), _GotClient_request = function _GotClient_request(execute, configSettings) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            this.settingConfig(configSettings);
            const res = yield execute(configSettings);
            if (this.assignResponseCookie)
                this.setResponseCookie(res);
            return {
                success: true,
                code: res.statusCode,
                message: res.statusMessage,
                data: res.body
            };
        }
        catch (e) {
            return {
                success: false,
                code: ((_a = e.response) === null || _a === void 0 ? void 0 : _a.statusCode) || 500,
                message: e.message,
            };
        }
    });
};
class CustomRequest {
    constructor(options) {
        var _a, _b;
        this.logger = loggerWinston.child({ service: (_a = options.logName) !== null && _a !== void 0 ? _a : "default" });
        this.loggerTumbler = (_b = options.loggerTumbler) !== null && _b !== void 0 ? _b : true;
        const bottleneckOptions = {};
        if (options.maxConcurrent) {
            bottleneckOptions.maxConcurrent = options.maxConcurrent;
        }
        if (options.minTime) {
            bottleneckOptions.minTime = options.minTime;
        }
        this.limiter = new Bottleneck(bottleneckOptions);
        if (options.requesterType === "got") {
            this.client = new GotClient();
        }
        else {
            this.client = new AxiosClient();
        }
        this.setAssignResponseCookie(!!options.assignResponseCookie);
        if (options.timeout)
            this.setTimeout(options.timeout);
    }
    get(url_1) {
        return __awaiter(this, arguments, void 0, function* (url, options = {}) {
            return yield this.limiter.schedule(() => __awaiter(this, void 0, void 0, function* () {
                const response = yield this.client.get(url, options);
                if (!response.success) {
                    if (this.loggerTumbler) {
                        this.logger.error(chalk.red(`${url} ERROR: ${response.message}`));
                    }
                }
                return response;
            }));
        });
    }
    post(url_1, data_1) {
        return __awaiter(this, arguments, void 0, function* (url, data, options = {}) {
            return yield this.limiter.schedule(() => __awaiter(this, void 0, void 0, function* () {
                const response = yield this.client.post(url, data, options);
                if (!response.success) {
                    if (this.loggerTumbler) {
                        this.logger.error(chalk.red(`${url} ERROR: ${response.message}`));
                    }
                }
                return response;
            }));
        });
    }
    setHeaders(newHeaders) {
        this.client.setHeaders(newHeaders);
    }
    removeHeaders(headerKeys) {
        this.client.removeHeaders(headerKeys);
    }
    setCookies(newCookies) {
        this.client.setCookies(newCookies);
    }
    removeCookies(cookieKeys) {
        this.client.removeCookies(cookieKeys);
    }
    setProxy(proxy) {
        this.client.setProxy(proxy);
    }
    removeProxy() {
        this.client.removeProxy();
    }
    removeTimeout() {
        this.client.removeTimeout();
    }
    setTimeout(time) {
        this.client.setTimeout(time);
    }
    setAssignResponseCookie(flag) {
        this.client.setAssignResponseCookie(flag);
    }
}
export default CustomRequest;
