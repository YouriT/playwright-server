/**
 * Proxy protocol types supported by Playwright/Patchright
 */
export type ProxyProtocol = 'http' | 'https' | 'socks5';

/**
 * Proxy configuration for browser context
 */
export interface ProxyConfig {
  protocol: ProxyProtocol;
  hostname: string;
  port: number;
  username?: string;
  password?: string;
  bypass?: string;
}

/**
 * Proxy configuration from API request (before parsing)
 */
export interface ProxyRequestConfig {
  server: string;
  username?: string;
  password?: string;
  bypass?: string;
}
