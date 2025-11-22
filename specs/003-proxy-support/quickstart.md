# Quickstart Guide: Proxy Configuration Support

**Feature**: 003-proxy-support  
**Date**: 2025-11-22  
**For**: Developers and system administrators

## Overview

This guide shows how to configure proxy servers for playwright-server. Proxy support enables routing browser traffic through HTTP, HTTPS, or SOCKS5 proxies with optional authentication.

**Use Cases**:

- Using commercial proxy services (Bright Data, Smartproxy, Oxylabs)
- Multi-region testing with different IP addresses
- Corporate proxy requirements
- IP rotation and anonymization

## Prerequisites

- playwright-server v1.1.0 or later
- Proxy server with HTTP, HTTPS, or SOCKS5 support
- (Optional) Proxy authentication credentials

## Configuration Options

You can configure proxies in two ways:

1. **Global proxy** (environment variables) - applies to all sessions by default
2. **Per-session proxy** (API request) - overrides global proxy for specific sessions

## Option 1: Global Proxy Configuration

Set proxy using environment variables at server startup. All sessions will use this proxy unless overridden.

### Environment Variables

```bash
# HTTP proxy (used for all requests)
export HTTP_PROXY=http://proxy.example.com:8080

# HTTPS proxy (optional override for HTTPS requests)
export HTTPS_PROXY=http://proxy.example.com:8080

# Bypass list (domains to exclude from proxy)
export NO_PROXY=localhost,127.0.0.1,.internal.com
```

### With Authentication

```bash
# Embedded credentials in URL
export HTTP_PROXY=http://username:password@proxy.example.com:8080
export NO_PROXY=localhost,127.0.0.1
```

### Start Server

```bash
# Server will load and validate proxy configuration at startup
npm start

# Expected log output:
# {"level":"info","time":"2025-11-22T10:00:00.123Z","type":"proxy_config","source":"environment","server":"http://proxy.example.com:8080","msg":"Global proxy configured"}
```

### Verify Configuration

```bash
# Create a session (will use global proxy)
curl -X POST http://localhost:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "ttl": 300000,
    "recording": false
  }'

# Response includes sessionUrl
# All browser requests will route through the configured proxy
```

## Option 2: Per-Session Proxy Configuration

Specify proxy in the session creation request. This overrides any global proxy configuration.

### Basic HTTP Proxy

```bash
curl -X POST http://localhost:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "ttl": 300000,
    "recording": false,
    "proxy": {
      "server": "http://proxy.example.com:8080"
    }
  }'
```

### HTTP Proxy with Authentication

```bash
curl -X POST http://localhost:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "ttl": 300000,
    "proxy": {
      "server": "http://proxy.example.com:8080",
      "username": "myuser",
      "password": "mypassword"
    }
  }'
```

### SOCKS5 Proxy

```bash
curl -X POST http://localhost:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "ttl": 300000,
    "proxy": {
      "server": "socks5://127.0.0.1:1080",
      "username": "user",
      "password": "pass"
    }
  }'
```

### Proxy with Bypass Rules

```bash
curl -X POST http://localhost:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "ttl": 300000,
    "proxy": {
      "server": "http://proxy.example.com:8080",
      "username": "user",
      "password": "pass",
      "bypass": "localhost,127.0.0.1,.internal.com"
    }
  }'
```

## Using Sessions with Proxies

Once a session is created with proxy configuration, all browser requests automatically route through the proxy:

```bash
# 1. Create session with proxy
SESSION_RESPONSE=$(curl -X POST http://localhost:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "ttl": 300000,
    "proxy": {
      "server": "http://proxy.example.com:8080",
      "username": "user",
      "password": "pass"
    }
  }')

# 2. Extract sessionUrl
SESSION_URL=$(echo $SESSION_RESPONSE | jq -r '.sessionUrl')

# 3. Execute commands (all traffic goes through proxy)
curl -X POST $SESSION_URL \
  -H "Content-Type: application/json" \
  -d '{
    "command": "goto",
    "options": {
      "url": "https://httpbin.org/ip"
    }
  }'

# 4. Extract IP address to verify proxy is working
curl -X POST $SESSION_URL \
  -H "Content-Type: application/json" \
  -d '{
    "command": "textContent",
    "selector": "body"
  }'

# Response will show proxy IP, not your actual IP
```

## Docker Deployment

### Docker Compose with Global Proxy

```yaml
version: '3.8'
services:
  playwright-server:
    image: playwright-server:latest
    ports:
      - '3000:3000'
    environment:
      - PORT=3000
      - HTTP_PROXY=http://proxy.example.com:8080
      - HTTPS_PROXY=http://proxy.example.com:8080
      - NO_PROXY=localhost,127.0.0.1
```

### Docker Compose with Authenticated Proxy

```yaml
version: '3.8'
services:
  playwright-server:
    image: playwright-server:latest
    ports:
      - '3000:3000'
    environment:
      - PORT=3000
      - HTTP_PROXY=http://${PROXY_USER}:${PROXY_PASS}@proxy.example.com:8080
      - NO_PROXY=localhost,127.0.0.1
    env_file:
      - .env.secrets # Store credentials in separate file
```

`.env.secrets`:

```bash
PROXY_USER=myusername
PROXY_PASS=mypassword
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: playwright-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: playwright-server
  template:
    metadata:
      labels:
        app: playwright-server
    spec:
      containers:
        - name: playwright-server
          image: playwright-server:latest
          ports:
            - containerPort: 3000
          env:
            - name: PORT
              value: '3000'
            - name: HTTP_PROXY
              valueFrom:
                secretKeyRef:
                  name: proxy-config
                  key: proxy-url
            - name: NO_PROXY
              value: 'localhost,127.0.0.1,.cluster.local'
```

Proxy secret:

```bash
kubectl create secret generic proxy-config \
  --from-literal=proxy-url='http://user:pass@proxy.example.com:8080'
```

## Troubleshooting

### Problem: Server fails to start with "Invalid proxy configuration"

**Cause**: Proxy URL format is invalid

**Solution**: Check URL format - must be `protocol://host:port` or `protocol://user:pass@host:port`

```bash
# ✅ Valid formats
export HTTP_PROXY=http://proxy.example.com:8080
export HTTP_PROXY=http://user:pass@proxy.example.com:8080
export HTTP_PROXY=socks5://127.0.0.1:1080

# ❌ Invalid formats
export HTTP_PROXY=proxy.example.com:8080  # Missing protocol
export HTTP_PROXY=http://proxy.example.com  # Missing port (use default)
```

### Problem: Session creation fails with "Unsupported proxy protocol"

**Cause**: Using unsupported protocol (e.g., SOCKS4)

**Solution**: Use HTTP, HTTPS, or SOCKS5 only

```bash
# ✅ Supported
"proxy": { "server": "socks5://proxy.example.com:1080" }

# ❌ Not supported
"proxy": { "server": "socks4://proxy.example.com:1080" }
```

### Problem: Session creation fails with "Proxy authentication incomplete"

**Cause**: Username provided without password (or vice versa)

**Solution**: Provide both username and password, or neither

```bash
# ✅ Complete authentication
"proxy": {
  "server": "http://proxy.example.com:8080",
  "username": "user",
  "password": "pass"
}

# ✅ No authentication
"proxy": {
  "server": "http://proxy.example.com:8080"
}

# ❌ Incomplete authentication
"proxy": {
  "server": "http://proxy.example.com:8080",
  "username": "user"
  # Missing password
}
```

### Problem: Proxy credentials appear in logs

**Cause**: Not using the latest version with credential redaction

**Solution**: Upgrade to v1.1.0+. Credentials are automatically redacted:

```json
// Logged (credentials masked):
{
  "level": "info",
  "type": "session_created",
  "proxy": {
    "server": "http://[USER]:[PASS]@proxy.example.com:8080",
    "username": "u***",
    "password": "[REDACTEDx8]"
  }
}
```

### Problem: Navigation fails with timeout errors

**Possible causes**:

1. Proxy server is unreachable
2. Proxy authentication failed
3. Proxy does not support HTTPS CONNECT tunneling

**Solutions**:

1. Test proxy connectivity manually:

   ```bash
   curl -x http://user:pass@proxy.example.com:8080 https://httpbin.org/ip
   ```

2. Check proxy server logs for authentication errors

3. Try HTTP proxy instead of HTTPS for HTTPS sites (uses CONNECT method)

### Problem: Internal requests leak through proxy

**Cause**: Missing NO_PROXY configuration

**Solution**: Always exclude localhost and internal domains:

```bash
export NO_PROXY=localhost,127.0.0.1,::1,.internal.com,.local
```

Or per-session:

```json
"proxy": {
  "server": "http://proxy.example.com:8080",
  "bypass": "localhost,127.0.0.1,.internal.com"
}
```

## Best Practices

### Security

1. **Store credentials securely**:
   - Use environment variables, not hardcoded values
   - Use secrets management (Vault, AWS Secrets Manager)
   - Rotate credentials regularly

2. **Use bypass rules**:
   - Always exclude localhost: `NO_PROXY=localhost,127.0.0.1,::1`
   - Exclude internal networks to prevent credential leakage

3. **Monitor logs**:
   - Verify credentials are redacted in all log output
   - Check for proxy authentication failures

### Performance

1. **Choose proxy location wisely**:
   - Use proxies geographically close to target websites
   - Consider latency (typically 100-500ms overhead)

2. **Use session-specific proxies**:
   - Different proxies for different regions
   - Better isolation and debugging

3. **Configure appropriate timeouts**:
   - Account for proxy latency in TTL settings
   - Longer TTL for proxied sessions

### Testing

1. **Verify proxy is working**:

   ```bash
   # Navigate to IP check service
   curl -X POST $SESSION_URL -H "Content-Type: application/json" -d '{
     "command": "goto",
     "options": { "url": "https://httpbin.org/ip" }
   }'

   # Check IP matches proxy IP
   curl -X POST $SESSION_URL -H "Content-Type: application/json" -d '{
     "command": "textContent",
     "selector": "body"
   }'
   ```

2. **Test authentication**:
   - Intentionally use wrong credentials
   - Verify clear error messages

3. **Test bypass rules**:
   - Navigate to bypassed domains
   - Verify direct connection (no proxy)

## API Reference

See [OpenAPI specification](./contracts/openapi.yaml) for complete API documentation.

## Environment Variable Reference

| Variable      | Format                             | Example                             | Required |
| ------------- | ---------------------------------- | ----------------------------------- | -------- |
| `HTTP_PROXY`  | `protocol://[user:pass@]host:port` | `http://proxy.example.com:8080`     | No       |
| `http_proxy`  | (lowercase, same format)           | `http://proxy.example.com:8080`     | No       |
| `HTTPS_PROXY` | (same as HTTP_PROXY)               | `https://proxy.example.com:443`     | No       |
| `https_proxy` | (lowercase, same format)           | `https://proxy.example.com:443`     | No       |
| `NO_PROXY`    | Comma-separated domains            | `localhost,127.0.0.1,.internal.com` | No       |
| `no_proxy`    | (lowercase, same format)           | `localhost,127.0.0.1`               | No       |

**Priority**: lowercase variants checked first for compatibility

## Next Steps

- Review [data model](./data-model.md) for detailed entity definitions
- Review [research findings](./research.md) for implementation decisions
- See [implementation plan](./plan.md) for development roadmap

## Support

For issues or questions:

- GitHub Issues: https://github.com/YouriT/playwright-server/issues
- Documentation: https://github.com/YouriT/playwright-server/tree/main/specs/003-proxy-support
