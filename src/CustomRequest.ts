import Bottleneck from "bottleneck";
import loggerWinston from "./loggerWinston.js";
import {Logger} from "winston";
import chalk from "chalk";
import got from "got";
import axios from "axios";
import { SocksProxyAgent } from 'socks-proxy-agent';
import {format as formatUrl, parse as parseUrl} from 'url';
import { HttpsProxyAgent, HttpProxyAgent } from "hpagent";

export interface HttpClient {
    get(url:string, options?: RequestOptions): Promise<any>
    post(url: string, data?: any, options?: RequestOptions): Promise<any>
    setHeaders(newHeaders: Record<string, string>): void
    removeHeaders(headerKeys: string[]): void
    setCookies(newCookies: Record<string, string>, domain: string): void
    removeCookies(cookieKeys: string[], domain: string): void
    setProxy(proxy: string): void
    removeProxy(): void
    setTimeout(time: number): void
    removeTimeout(): void
    setAssignResponseCookie(flag: boolean): void
    getCookiesByDomain(domain: string): Record<string, string> | undefined
}

type Options = {
    requesterType: "got" | "axios"
    logName?: string
    loggerTumbler?: boolean
    timeout?: number
    maxConcurrent?: number
    minTime?: number
    assignResponseCookie?: boolean
    followRedirect?: boolean
    preRequestHook?: (url: string, options: RequestOptions) => void
    responseHook?: <T>(response: ApiResponse<T>, url: string, options: RequestOptions) => void
}

type RequestOptions = {
    params?: Params
    headers?: Record<string, string>
    cookie?: Record<string, string>
    proxy?: string
    timeout?: number
    followRedirect?: boolean
}

type Params = {
    [key: string]: string | number | boolean
}

export type ApiResponse<T> = {
    success: boolean
    code: number
    message: string
    data?: T
    headers?: Record<string, any>
}

abstract class BaseClient {
    headers: Record<string, string> = {}
    cookies: Record<string, Record<string, string>> = {}
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

    setCookies(newCookies: Record<string, string>, domain: string): void {
        if (!this.cookies[domain]) {
            this.cookies[domain] = {}
        }
        this.cookies[domain] = { ...this.cookies[domain], ...newCookies }
    }

    removeCookies(cookieKeys: string[], domain: string): void {
        if (this.cookies[domain]) {
            for (const key of cookieKeys) {
                delete this.cookies[domain][key]
            }
        }
    }

    setResponseCookie(res:any, domain: string) {
        res.headers["set-cookie"]?.forEach((newCookie: string) => {
            const [cookie, ...options] = newCookie.split(';')
            const [name, value] = cookie.split('=')
            if (!this.cookies[domain]) this.cookies[domain] = {}
            this.cookies[domain][name.trim()] = value.trim()
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
                return new HttpsProxyAgent({ proxy: proxy })
            case 'socks4:':
            case 'socks5:':
                return new SocksProxyAgent(proxy)
            default:
                throw new Error(`Unsupported proxy protocol: ${url.protocol}`)
        }
    }

    getCookiesByDomain(domain: string): Record<string, string> | undefined {
        return this.cookies[domain] || undefined;
    }

    getCookiesHeader(domain: string, configCookie: Record<string, any>): string {
        const domainCookies = this.cookies[domain] || {}

        Object.entries(domainCookies).forEach(([key, value]) => {
            if (!configCookie.hasOwnProperty(key)) {
                configCookie[key] = value
            }
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

    settingConfig(configSettings: Record<string, any>, domain: string) {
        configSettings.headers = {...this.getHeaders(configSettings.headers), Cookie: this.getCookiesHeader(domain, configSettings.cookie)}

        delete configSettings.domain
        delete configSettings.proxy
        delete configSettings.cookie
    }
}
class AxiosClient extends BaseClient implements HttpClient {
    async #request<T>(execute:(config: Record<string, any>) => Promise<any>, configSettings: Record<string, any>): Promise<ApiResponse<T>> {
        try {
            const domain = configSettings.domain
            this.settingConfig(configSettings)

            const res = await execute(configSettings)
            if (this.assignResponseCookie) this.setResponseCookie(res, domain)

            return {
                success: true,
                code: res.status,
                message: res.statusText,
                data: res.data,
                headers: res.headers
            }
        }catch (e:any) {
            if (e.response?.status === 302 || e.response?.status === 303) {
                return {
                    success: true,
                    code: e.response?.status,
                    message: e.response.statusText,
                    data: e.response.data,
                    headers: e.response.headers
                }
            }
            return {
                success: false,
                code: e.response?.status || undefined,
                message: e.message,
            }
        }
    }

    async get(url:string, options: RequestOptions = {}): Promise<any> {
        const { params = {}, headers = {}, cookie = {}, proxy, followRedirect = true, timeout } = options
        const finalUrl = this.buildRequestString(url, params)
        const domain = new URL(url).hostname

        return await this.#request(async (config: Record<string, any>) => {
            return await axios.get(finalUrl, config)
        }, {
            headers, cookie, proxy, domain, followRedirect, timeout
        })
    }

    async post(url:string, data:any, options: RequestOptions = {}): Promise<any> {
        const { headers = {}, cookie = {}, proxy, followRedirect = true, timeout } = options
        const domain = new URL(url).hostname

        return await this.#request(async (config: Record<string, any>) => {
            return await axios.post(url, data, config)
        }, {
            headers, cookie, proxy, domain, followRedirect, timeout
        })
    }

    settingConfig(configSettings: Record<string, any>) {
        if (configSettings.proxy) {
            configSettings.httpsAgent = this.determineAgent(configSettings.proxy)
        } else if (this.proxy) {
            configSettings.httpsAgent = this.determineAgent(this.proxy)
        }

        if (configSettings.timeout) {
            configSettings.timeout = configSettings.timeout
        } else if (this.timeout) {
            configSettings.timeout = this.timeout
        }

        if (configSettings.followRedirect === false)  {
            configSettings.maxRedirects = 0
        }

        super.settingConfig(configSettings, configSettings.domain)
    }
}
class GotClient extends BaseClient implements HttpClient {
    async #request<T>(execute:(config: Record<string, any>) => Promise<any>, configSettings: Record<string, any>): Promise<ApiResponse<T>> {
        try {
            const domain = configSettings.domain
            this.settingConfig(configSettings)

            const res = await execute(configSettings)
            if (this.assignResponseCookie) this.setResponseCookie(res, domain)

            try {
                res.body = JSON.parse(res.body)
            } catch(e:any) {}

            return {
                success: true,
                code: res.statusCode,
                message: res.statusMessage,
                data: res.body,
                headers: res.headers
            }
        }catch (e:any) {
            return {
                success: false,
                code: e.response?.statusCode || undefined,
                message: e.message,
            }
        }
    }

    async get(url:string, options: RequestOptions = {}): Promise<any> {
        const { params = {}, headers = {}, cookie = {}, proxy, followRedirect = true, timeout } = options
        const finalUrl = this.buildRequestString(url, params)
        const domain = new URL(url).hostname

        return await this.#request(async (config: Record<string, any>) => {
            return await got.get(finalUrl, config)
        }, {
            headers, cookie, proxy, domain, followRedirect, timeout
        })
    }

    async post(url:string, data:any, options: RequestOptions = {}): Promise<any> {
        const { headers = {}, cookie = {}, proxy, followRedirect = true, timeout } = options
        const domain = new URL(url).hostname

        return await this.#request(async (config: Record<string, any>) => {
            // Проверяем, является ли data FormData или другим типом, который не нужно сериализовать в JSON
            const isFormData = data instanceof FormData || 
                              (typeof data === 'object' && data?.constructor?.name === 'FormData') ||
                              (data && typeof data === 'object' && data.constructor?.name === 'Buffer') ||
                              typeof data === 'string'
            
            if (isFormData) {
                return await got.post(url, {
                    body: data,
                    ...config
                })
            } else {
                return await got.post(url, {
                    json: data,
                    ...config
                })
            }
        }, {
            headers, cookie, proxy, domain, followRedirect, timeout
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

        if (configSettings.timeout) {
            configSettings.timeout = { request: configSettings.timeout }
        } else if (this.timeout) {
            configSettings.timeout = { request: this.timeout }
        }

        super.settingConfig(configSettings, configSettings.domain)
    }
}

class CustomRequest {
    logger: Logger
    loggerTumbler: boolean
    limiter: Bottleneck
    client: HttpClient
    protected preRequestHook?: (url: string, options: RequestOptions) => void
    protected responseHook?: <T>(response: ApiResponse<T>, url: string, options: RequestOptions) => void

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
        if (options.preRequestHook) {
            this.preRequestHook = options.preRequestHook
        }
        if (options.responseHook) {
            this.responseHook = options.responseHook
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
        if (this.preRequestHook) {
            this.preRequestHook(url, options)
        }

        return await this.limiter.schedule(async () => {
            const response = await this.client.get(url, options)
            if (!response.success) {
                if (this.loggerTumbler) {
                    this.logger.error(chalk.red(`${url} ERROR: ${response.message}`))
                }
            }

            if (this.responseHook) {
                this.responseHook(response, url, options)
            }

            return response
        })
    }

    async post<T>(url: string, data?: any, options: RequestOptions = {}): Promise<ApiResponse<T>> {
        if (this.preRequestHook) {
            this.preRequestHook(url, options)
        }

        return await this.limiter.schedule(async () => {
            const response = await this.client.post(url, data, options)
            if (!response.success) {
                if (this.loggerTumbler) {
                    this.logger.error(chalk.red(`${url} ERROR: ${response.message}`))
                }
            }

            if (this.responseHook) {
                this.responseHook(response, url, options)
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

    setCookies(newCookies: Record<string, string>, domain: string) {
        this.client.setCookies(newCookies, domain)
    }

    removeCookies(cookieKeys: string[], domain: string) {
        this.client.removeCookies(cookieKeys, domain)
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

    setPreRequestHook(hook: (url: string, options: RequestOptions) => void) {
        this.preRequestHook = hook
    }

    setResponseHook(hook: <T>(response: ApiResponse<T>, url: string, options: RequestOptions) => void) {
        this.responseHook = hook
    }

    getCookiesByDomain(domain: string): Record<string, string> | undefined {
        return this.client.getCookiesByDomain(domain)
    }
}

export default CustomRequest