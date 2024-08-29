import Bottleneck from "bottleneck";
import loggerWinston from "./loggerWinston.js";
import {Logger} from "winston";
import chalk from "chalk";
import got from "got";
import axios from "axios";
import {HttpsProxyAgent} from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import {format as formatUrl, parse as parseUrl} from 'url';

export interface HttpClient {
    get(url:string, options?: RequestOptions): Promise<any>
    post(url: string, data?: any, options?: RequestOptions): Promise<any>
    setHeaders(newHeaders: Record<string, string>): void
    removeHeaders(headerKeys: string[]): void
    setCookies(newCookies: Record<string, string>): void
    removeCookies(cookieKeys: string[]): void
    setProxy(proxy: string): void
    removeProxy(): void
    setTimeout(time: number): void
    removeTimeout(): void
    setAssignResponseCookie(flag: boolean): void
}

type Options = {
    requesterType: "got" | "axios"
    logName?: string
    loggerTumbler?: boolean
    timeout?: number
    maxConcurrent?: number
    minTime?: number,
    assignResponseCookie?: boolean
}

type RequestOptions = {
    params?: Params
    headers?: Record<string, string>
    cookie?: Record<string, string>
    proxy?: string
    timeout?: number
}

type Params = {
    [key: string]: string | number | boolean
}

export type ApiResponse<T> = {
    success: boolean
    code: number
    message: string
    data?: T
}

abstract class BaseClient {
    headers: Record<string, string> = {}
    cookies: Record<string, string> = {}
    timeout?: number = 20000
    assignResponseCookie: boolean = false
    proxy?: string

    buildQueryString(params: Params) {
        return  Object.entries(params)
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
            .join("&")
    }

    buildRequestString(url: string, params: Params): string {
        const urlObj = parseUrl(url, true);
        let combinedParams = { ...urlObj.query, ...params }

        urlObj.search = ''
        //@ts-ignore
        urlObj.query = combinedParams;
        return formatUrl(urlObj);
    }

    setHeaders(newHeaders: Record<string, string>): void {
        this.headers = { ...this.headers, ...newHeaders }
    }

    removeHeaders(headerKeys: string[]): void {
        for (const key of headerKeys) {
            delete this.headers[key]
        }
    }

    setCookies(newCookies: Record<string, string>): void {
        this.cookies = { ...this.cookies, ...newCookies }
    }

    removeCookies(cookieKeys: string[]): void {
        for (const key of cookieKeys) {
            delete this.cookies[key]
        }
    }

    setResponseCookie(res:any) {
        res.headers["set-cookie"]?.forEach((newCookie:any) => {
            const [cookie] = newCookie.split(';')
            const [name, value] = cookie.split('=')
            this.cookies[name.trim()] = value.trim()
        })
    }

    setTimeout(time: number) {
        this.timeout = time
    }

    setProxy(proxy: string) {
        this.proxy = proxy
    }

    removeProxy() {
        this.proxy = undefined
    }

    removeTimeout() {
        this.timeout = 20000
    }

    determineAgent(proxy: string) {
        const url = new URL(proxy)

        switch (url.protocol) {
            case 'http:':
            case 'https:':
                return new HttpsProxyAgent(proxy)
            case 'socks4:':
            case 'socks5:':
                return new SocksProxyAgent(proxy)
            default:
                throw new Error(`Unsupported proxy protocol: ${url.protocol}`)
        }
    }

    getCookiesHeader(configCookie: Record<string, any>): string {
        Object.entries(this.cookies).forEach(([key, value]) => {
            if (!configCookie.hasOwnProperty(key))
            configCookie[key] = value
        })

        return Object.entries(configCookie)
            .map(([key, value]) => `${key}=${value}`)
            .join("; ")
    }

    getHeaders(configHeaders: Record<string, any>): Record<string, any> {
        Object.entries(this.headers).forEach(([key, value]) => {
            if (!configHeaders.hasOwnProperty(key))
                configHeaders[key] = value
        })

        return configHeaders
    }

    setAssignResponseCookie(flag: boolean) {
        this.assignResponseCookie = flag
    }

    settingConfig(configSettings: Record<string, any>) {
        configSettings.headers = {...this.getHeaders(configSettings.headers), Cookie: this.getCookiesHeader(configSettings.cookie)}

        delete configSettings.proxy
        delete configSettings.cookie
    }
}
class AxiosClient extends BaseClient implements HttpClient {
    async #request<T>(execute:(config: Record<string, any>) => Promise<any>, configSettings: Record<string, any>): Promise<ApiResponse<T>> {
        try {
            this.settingConfig(configSettings)

            const res = await execute(configSettings)
            if (this.assignResponseCookie) this.setResponseCookie(res)

            return {
                success: true,
                code: res.status,
                message: res.statusText,
                data: res.data
            }
        }catch (e:any) {
            return {
                success: false,
                code: e.response?.status || 500,
                message: e.message,
            }
        }
    }

    async get(url:string, options: RequestOptions = {}): Promise<any> {
        const { params = {}, headers = {}, cookie = {}, proxy } = options
        const finalUrl = this.buildRequestString(url, params)

        return await this.#request(async (config: Record<string, any>) => {
            return await axios.get(finalUrl, config)
        }, {
            headers, cookie, proxy
        })
    }

    async post(url:string, data:any, options: RequestOptions = {}): Promise<any> {
        const { headers = {}, cookie = {}, proxy } = options

        return await this.#request(async (config: Record<string, any>) => {
            return await axios.post(url, data, config)
        }, {
            headers, cookie, proxy
        })
    }

    settingConfig(configSettings: Record<string, any>) {
        if (configSettings.proxy) {
            configSettings.httpsAgent = this.determineAgent(configSettings.proxy)
        } else if (this.proxy) {
            configSettings.httpsAgent = this.determineAgent(this.proxy)
        }

        if (this.timeout && !configSettings.timeout){
            configSettings.timeout = this.timeout
        }

        super.settingConfig(configSettings)
    }
}
class GotClient extends BaseClient implements HttpClient {
    async #request<T>(execute:(config: Record<string, any>) => Promise<any>, configSettings: Record<string, any>): Promise<ApiResponse<T>> {
        try {
            this.settingConfig(configSettings)

            const res = await execute(configSettings)
            if (this.assignResponseCookie) this.setResponseCookie(res)

            return {
                success: true,
                code: res.statusCode,
                message: res.statusMessage,
                data: res.body
            }
        }catch (e:any) {
            return {
                success: false,
                code: e.response?.statusCode || 500,
                message: e.message,
            }
        }
    }

    async get(url:string, options: RequestOptions = {}): Promise<any> {
        const { params = {}, headers = {}, cookie = {}, proxy } = options
        const finalUrl = this.buildRequestString(url, params)

        return await this.#request(async (config: Record<string, any>) => {
            return await got.get(finalUrl, config)
        }, {
            headers, cookie, proxy
        })
    }

    async post(url:string, data:any, options: RequestOptions = {}): Promise<any> {
        const { headers = {}, cookie = {}, proxy } = options

        return await this.#request(async (config: Record<string, any>) => {
            return await got.post(url, {
                json: data,
                ...config
            })
        }, {
            headers, cookie, proxy
        })
    }

    settingConfig(configSettings: Record<string, any>) {
        if (configSettings.proxy) {
            configSettings.agent = {
                https: this.determineAgent(configSettings.proxy)
            }
        } else if (this.proxy) {
            configSettings.agent = {
                https: this.determineAgent(this.proxy)
            }
        }

        if (this.timeout && !configSettings.timeout){
            configSettings.timeout = { request: this.timeout }
        } else if (configSettings.timeout) {
            configSettings.timeout = { request: configSettings.timeout }
        }

        super.settingConfig(configSettings)
    }
}

class CustomRequest {
    logger: Logger
    loggerTumbler: boolean
    limiter: Bottleneck
    client: HttpClient

    constructor(options: Options) {
        this.logger = loggerWinston.child({service: options.logName ?? "default"})
        this.loggerTumbler = options.loggerTumbler ?? true

        const bottleneckOptions: Record<string, number> = {}
        if (options.maxConcurrent) {
            bottleneckOptions.maxConcurrent = options.maxConcurrent
        }
        if (options.minTime) {
            bottleneckOptions.minTime = options.minTime
        }
        this.limiter = new Bottleneck(bottleneckOptions)

        if (options.requesterType === "got") {
            this.client = new GotClient()
        } else {
            this.client = new AxiosClient()
        }

        this.setAssignResponseCookie(!!options.assignResponseCookie)

        if (options.timeout) this.setTimeout(options.timeout)
    }

    async get<T>(url: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
        return await this.limiter.schedule(async () => {
            const response = await this.client.get(url, options)
            if (!response.success) {
                if (this.loggerTumbler) {
                    this.logger.error(chalk.red(`${url} ERROR: ${response.message}`))
                }
            }
            return response
        })
    }

    async post<T>(url: string, data?: any, options: RequestOptions = {}): Promise<ApiResponse<T>> {
        return await this.limiter.schedule(async () => {
            const response = await this.client.post(url, data, options)
            if (!response.success) {
                if (this.loggerTumbler) {
                    this.logger.error(chalk.red(`${url} ERROR: ${response.message}`))
                }
            }
            return response
        })
    }

    setHeaders(newHeaders: Record<string, string>) {
        this.client.setHeaders(newHeaders)
    }

    removeHeaders(headerKeys: string[]) {
        this.client.removeHeaders(headerKeys)
    }

    setCookies(newCookies: Record<string, string>) {
        this.client.setCookies(newCookies)
    }

    removeCookies(cookieKeys: string[]) {
        this.client.removeCookies(cookieKeys)
    }

    setProxy(proxy: string) {
        this.client.setProxy(proxy)
    }

    removeProxy() {
        this.client.removeProxy()
    }

    removeTimeout() {
        this.client.removeTimeout()
    }

    setTimeout(time: number) {
        this.client.setTimeout(time)
    }

    setAssignResponseCookie(flag:boolean) {
        this.client.setAssignResponseCookie(flag)
    }
}

export default CustomRequest