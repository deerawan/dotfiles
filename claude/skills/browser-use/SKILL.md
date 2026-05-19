# Browser Automation with browser-use CLI

The `browser-use` command enables fast, persistent browser automation through a background daemon that maintains browser state across commands, achieving approximately 50ms latency per operation.

## Setup & Verification

Begin by verifying your installation:
```bash
browser-use doctor
```

## Fundamental Workflow

1. **Open a URL** — `browser-use open <url>` initializes the browser
2. **Check current state** — `browser-use state` displays clickable elements with indices
3. **Perform interactions** — Use returned indices to click, type, or manipulate elements
4. **Validate results** — Screenshots or state checks confirm actions
5. **Continue automation** — Browser remains active between commands
6. **Terminate session** — `browser-use close` when finished

## Browser Startup Modes

- **Headless (default):** `browser-use open <url>`
- **Visible window:** `browser-use --headed open <url>`
- **Existing Chrome profile:** `browser-use --profile "Default" open <url>`
- **Auto-detect running Chrome:** `browser-use --connect open <url>`
- **CDP endpoint:** `browser-use --cdp-url ws://localhost:9222/... open <url>`

## Key Commands

**Navigation:** open, back, scroll, switch, close-tab

**State inspection:** state (returns clickable elements), screenshot

**Element interaction:** click, type, input, keys, select, upload, hover, dblclick, rightclick

**Data retrieval:** eval, title, html, text, value, attributes, bbox

**Timing:** wait selector or text with customizable timeout

**Cookies:** get, set, clear, export, import operations

**Python execution:** Persistent session with browser object methods

## Essential Tips

- Always execute `state` before interactions to identify element indices
- Use `--headed` mode during development to observe browser behavior visually
- Sessions persist between commands, enabling efficient chaining with `&&`
- For authenticated workflows, leverage Chrome profiles with existing login sessions

## Session Management

View active sessions: `browser-use sessions`
Terminate all: `browser-use close --all`
