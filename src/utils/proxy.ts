/**
 * Mask credentials in proxy server URL for safe logging
 */
export function maskProxyServerUrl(url: string): string {
  if (!url || typeof url !== 'string') return '[REDACTED]';

  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password) {
      // Replace credentials in URL
      parsed.username = '[USER]';
      parsed.password = '';
      return parsed.toString();
    }
    return url;
  } catch {
    // Pattern matching fallback for invalid URLs: protocol://user:pass@host:port
    const credsPattern = /^([a-z]+:\/\/)([^:]+:[^@]+@)(.+)$/i;
    if (credsPattern.test(url)) {
      return url.replace(credsPattern, '$1[USER]:[PASS]@$3');
    }
    return url;
  }
}
