import Bottleneck from "bottleneck";
import { Logger } from "winston";
export interface HttpClient {
    get(url: string, options?: RequestOptions): Promise<any>;
    post(url: string, data?: any, options?: RequestOptions): Promise<any>;
    setHeaders(newHeaders: Record<string, string>): void;
    removeHeaders(headerKeys: string[]): void;
    setCookies(newCookies: Record<string, string>): void;
    removeCookies(cookieKeys: string[]): void;
    setProxy(proxy: string): void;
    removeProxy(): void;
    setTimeout(time: number): void;
    removeTimeout(): void;
    setAssignResponseCookie(flag: boolean): void;
}
type Options = {
    requesterType: "got" | "axios";
    logName?: string;
    loggerTumbler?: boolean;
    timeout?: number;
    maxConcurrent?: number;
    minTime?: number;
    assignResponseCookie?: boolean;
};
type RequestOptions = {
    params?: Params;
    headers?: Record<string, string>;
    cookie?: Record<string, string>;
    proxy?: string;
    timeout?: number;
};
type Params = {
    [key: string]: string | number | boolean;
};
export type ApiResponse<T> = {
    success: boolean;
    code: number;
    message: string;
    data?: T;
};
declare class CustomRequest {
    logger: Logger;
    loggerTumbler: boolean;
    limiter: Bottleneck;
    client: HttpClient;
    constructor(options: Options);
    get<T>(url: string, options?: RequestOptions): Promise<ApiResponse<T>>;
    post<T>(url: string, data?: any, options?: RequestOptions): Promise<ApiResponse<T>>;
    setHeaders(newHeaders: Record<string, string>): void;
    removeHeaders(headerKeys: string[]): void;
    setCookies(newCookies: Record<string, string>): void;
    removeCookies(cookieKeys: string[]): void;
    setProxy(proxy: string): void;
    removeProxy(): void;
    removeTimeout(): void;
    setTimeout(time: number): void;
    setAssignResponseCookie(flag: boolean): void;
}
export default CustomRequest;
