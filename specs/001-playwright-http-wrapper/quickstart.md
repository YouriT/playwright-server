# Quickstart Guide: Playwright HTTP Wrapper

**Feature Branch**: `001-playwright-http-wrapper`  
**Date**: 2025-11-19  

This guide will help you quickly get started with the Playwright HTTP Wrapper API.

---

## Prerequisites

- HTTP client (curl, Postman, or any programming language with HTTP support)
- Basic understanding of HTTP requests and JSON
- Familiarity with Playwright concepts (selectors, page navigation)

---

## Basic Workflow

1. **Create Session** → Get session URL and stop URL
2. **Execute Commands** → Interact with browser via HTTP
3. **Stop Session** → Clean up resources (or let TTL expire)

---

## Quick Example: Complete Automation Flow

### 1. Create a New Session

**Request:**
```bash
curl -X POST http://localhost:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "ttl": 1800000,
    "recording": false
  }'
```

**Response:**
```json
{
  "sessionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "sessionUrl": "http://localhost:3000/sessions/a1b2c3d4-e5f6-7890-abcd-ef1234567890/command",
  "stopUrl": "http://localhost:3000/sessions/a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "expiresAt": "2025-11-19T11:00:00.000Z",
  "createdAt": "2025-11-19T10:30:00.000Z"
}
```

Save the `sessionUrl` and `stopUrl` for subsequent requests.

---

### 2. Navigate to a Website

**Request:**
```bash
curl -X POST http://localhost:3000/sessions/a1b2c3d4-e5f6-7890-abcd-ef1234567890/command \
  -H "Content-Type: application/json" \
  -d '{
    "command": "navigate",
    "options": {
      "url": "https://example.com",
      "waitUntil": "networkidle"
    }
  }'
```

**Response:**
```json
{
  "result": null,
  "executedAt": "2025-11-19T10:30:15.456Z"
}
```

---

### 3. Extract Text from an Element

**Request:**
```bash
curl -X POST http://localhost:3000/sessions/a1b2c3d4-e5f6-7890-abcd-ef1234567890/command \
  -H "Content-Type: application/json" \
  -d '{
    "command": "textContent",
    "selector": "h1"
  }'
```

**Response:**
```json
{
  "result": "Example Domain",
  "executedAt": "2025-11-19T10:30:20.789Z"
}
```

---

### 4. Click a Button

**Request:**
```bash
curl -X POST http://localhost:3000/sessions/a1b2c3d4-e5f6-7890-abcd-ef1234567890/command \
  -H "Content-Type: application/json" \
  -d '{
    "command": "click",
    "selector": "#submit-button",
    "options": {
      "button": "left"
    }
  }'
```

**Response:**
```json
{
  "result": null,
  "executedAt": "2025-11-19T10:30:25.123Z"
}
```

---

### 5. Type Text into an Input Field

**Request:**
```bash
curl -X POST http://localhost:3000/sessions/a1b2c3d4-e5f6-7890-abcd-ef1234567890/command \
  -H "Content-Type: application/json" \
  -d '{
    "command": "type",
    "selector": "#username",
    "options": {
      "text": "testuser"
    }
  }'
```

**Response:**
```json
{
  "result": null,
  "executedAt": "2025-11-19T10:30:30.456Z"
}
```

---

### 6. Take a Screenshot

**Request:**
```bash
curl -X POST http://localhost:3000/sessions/a1b2c3d4-e5f6-7890-abcd-ef1234567890/command \
  -H "Content-Type: application/json" \
  -d '{
    "command": "screenshot",
    "options": {
      "fullPage": true
    }
  }'
```

**Response:**
```json
{
  "result": "iVBORw0KGgoAAAANSUhEUg... (base64 encoded image data)",
  "executedAt": "2025-11-19T10:30:35.789Z"
}
```

---

### 7. Stop the Session

**Request:**
```bash
curl -X DELETE http://localhost:3000/sessions/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

**Response:**
```json
{
  "message": "Session terminated successfully"
}
```

---

## Recording Sessions

To enable video recording, set `recording: true` when creating a session:

**Request:**
```bash
curl -X POST http://localhost:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "ttl": 1800000,
    "recording": true,
    "videoSize": {
      "width": 1280,
      "height": 720
    }
  }'
```

**Response:**
```json
{
  "sessionId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "sessionUrl": "http://localhost:3000/sessions/b2c3d4e5-f6a7-8901-bcde-f12345678901/command",
  "stopUrl": "http://localhost:3000/sessions/b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "playbackUrl": "http://localhost:3000/recordings/b2c3d4e5-f6a7-8901-bcde-f12345678901/video.webm",
  "expiresAt": "2025-11-19T11:00:00.000Z",
  "createdAt": "2025-11-19T10:30:00.000Z"
}
```

**Access the recording** after the session ends:
```bash
curl http://localhost:3000/recordings/b2c3d4e5-f6a7-8901-bcde-f12345678901/video.webm \
  --output session-recording.webm
```

Recordings are available for 1 hour after session termination.

---

## Available Commands

### Navigation
- `navigate` / `goto`: Navigate to a URL
  ```json
  {
    "command": "navigate",
    "options": {
      "url": "https://example.com",
      "waitUntil": "networkidle"
    }
  }
  ```

### Element Interaction
- `click`: Click an element
  ```json
  {
    "command": "click",
    "selector": "#button-id",
    "options": {
      "button": "left",
      "clickCount": 1
    }
  }
  ```

- `type` / `fill`: Type text into an input
  ```json
  {
    "command": "type",
    "selector": "#input-id",
    "options": {
      "text": "Hello World"
    }
  }
  ```

- `press`: Press a keyboard key
  ```json
  {
    "command": "press",
    "options": {
      "key": "Enter"
    }
  }
  ```

### Data Extraction
- `textContent`: Get text content of an element
  ```json
  {
    "command": "textContent",
    "selector": "h1"
  }
  ```

- `getAttribute`: Get an attribute value
  ```json
  {
    "command": "getAttribute",
    "selector": "#element-id",
    "options": {
      "attribute": "href"
    }
  }
  ```

- `screenshot`: Capture a screenshot
  ```json
  {
    "command": "screenshot",
    "options": {
      "fullPage": true
    }
  }
  ```

### Page Manipulation
- `waitForSelector`: Wait for an element to appear
  ```json
  {
    "command": "waitForSelector",
    "selector": "#dynamic-element",
    "options": {
      "timeout": 5000
    }
  }
  ```

- `evaluate`: Execute JavaScript in page context
  ```json
  {
    "command": "evaluate",
    "options": {
      "script": "document.title"
    }
  }
  ```

---

## Error Handling

### Session Not Found (404)
```json
{
  "error": "SessionNotFoundError",
  "message": "Session not found or has expired"
}
```

**Cause**: Session ID is invalid, session expired, or was already terminated.

### Invalid Command (400)
```json
{
  "error": "CommandNotFoundError",
  "message": "Command 'invalidCommand' is not registered"
}
```

**Cause**: Command name not recognized by the system.

### Element Not Found (404)
```json
{
  "error": "ElementNotFoundError",
  "message": "Element matching selector '#missing-button' not found"
}
```

**Cause**: Selector did not match any elements on the page.

### Timeout (408)
```json
{
  "error": "TimeoutError",
  "message": "Command execution exceeded timeout (30000ms)"
}
```

**Cause**: Command took longer than 30 seconds to execute (Playwright default timeout).

### Execution Error (500)
```json
{
  "error": "ExecutionError",
  "message": "Browser context closed unexpectedly"
}
```

**Cause**: Browser crashed or command execution failed due to internal error.

### Maximum Sessions Reached (503)
```json
{
  "error": "MaxSessionsReached",
  "message": "Maximum concurrent sessions limit reached (10). Please try again later."
}
```

**Cause**: Server has reached the maximum number of concurrent sessions (configurable via environment variable).

---

## Session TTL and Keep-Alive

- Sessions automatically expire after the specified TTL (default: 30 minutes)
- **Keep-alive behavior**: Every successful command execution resets the TTL
- Sessions are terminated within 30 seconds of TTL expiration
- Manual termination via stop URL is recommended to free resources immediately

**Example**: If you create a session with 30-minute TTL and execute a command every 10 minutes, the session will remain active indefinitely until you manually stop it.

---

## Programming Language Examples

### Python (using requests)
```python
import requests

# Create session
response = requests.post('http://localhost:3000/sessions', json={
    'ttl': 1800000,
    'recording': False
})
session = response.json()
session_url = session['sessionUrl']

# Navigate to website
requests.post(session_url, json={
    'command': 'navigate',
    'options': {'url': 'https://example.com'}
})

# Extract text
response = requests.post(session_url, json={
    'command': 'textContent',
    'selector': 'h1'
})
print(response.json()['result'])  # "Example Domain"

# Stop session
requests.delete(session['stopUrl'])
```

### JavaScript (using fetch)
```javascript
// Create session
const session = await fetch('http://localhost:3000/sessions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ttl: 1800000, recording: false })
}).then(r => r.json());

const sessionUrl = session.sessionUrl;

// Navigate to website
await fetch(sessionUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    command: 'navigate',
    options: { url: 'https://example.com' }
  })
});

// Extract text
const result = await fetch(sessionUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    command: 'textContent',
    selector: 'h1'
  })
}).then(r => r.json());

console.log(result.result); // "Example Domain"

// Stop session
await fetch(session.stopUrl, { method: 'DELETE' });
```

### Go (using net/http)
```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
)

func main() {
    // Create session
    body := map[string]interface{}{"ttl": 1800000, "recording": false}
    bodyBytes, _ := json.Marshal(body)
    resp, _ := http.Post("http://localhost:3000/sessions", "application/json", bytes.NewReader(bodyBytes))
    
    var session map[string]interface{}
    json.NewDecoder(resp.Body).Decode(&session)
    sessionUrl := session["sessionUrl"].(string)
    
    // Navigate to website
    cmd := map[string]interface{}{
        "command": "navigate",
        "options": map[string]string{"url": "https://example.com"},
    }
    cmdBytes, _ := json.Marshal(cmd)
    http.Post(sessionUrl, "application/json", bytes.NewReader(cmdBytes))
    
    // Extract text
    textCmd := map[string]interface{}{
        "command": "textContent",
        "selector": "h1",
    }
    textBytes, _ := json.Marshal(textCmd)
    resp, _ = http.Post(sessionUrl, "application/json", bytes.NewReader(textBytes))
    
    var result map[string]interface{}
    json.NewDecoder(resp.Body).Decode(&result)
    fmt.Println(result["result"]) // "Example Domain"
    
    // Stop session
    req, _ := http.NewRequest("DELETE", session["stopUrl"].(string), nil)
    http.DefaultClient.Do(req)
}
```

---

## Tips and Best Practices

1. **Always clean up sessions**: Use the stop URL when done to free browser resources immediately
2. **Handle TTL resets**: If your workflow takes longer than the initial TTL, successful commands will reset it automatically
3. **Use appropriate selectors**: CSS selectors are simpler, XPath provides more power when needed
4. **Enable recording for debugging**: Video recordings help diagnose unexpected behavior
5. **Check error responses**: All errors include descriptive messages to help troubleshoot issues
6. **Monitor session limits**: Default limit is 10 concurrent sessions; plan your automation accordingly
7. **Wait for elements**: Use `waitForSelector` before interacting with dynamically loaded content

---

## Next Steps

- Review the [OpenAPI specification](contracts/openapi.yaml) for complete API documentation
- Check the [data model](data-model.md) for entity details and validation rules
- Read the [research document](research.md) for technical implementation decisions
- Refer to the [implementation plan](plan.md) for architecture and design details

---

**Questions or Issues?**  
Refer to Playwright documentation for command-specific details: https://playwright.dev/docs/api/class-page
