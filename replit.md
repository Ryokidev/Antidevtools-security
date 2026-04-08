# Guardian.js — Browser Security Package

## Overview
A zero-dependency UMD JavaScript browser security package. Provides multiple independent protection layers that can be enabled individually or together.

## Architecture

```
src/guardian.js   — Main UMD module (all security logic)
server.js         — Minimal Node.js HTTP server (serves the demo)
demo/index.html   — Interactive demo + live configuration UI
package.json      — npm package metadata
```

## Security Modules

| Module | Description |
|--------|-------------|
| **DebuggerTrap** | Fires `debugger` via `Function constructor` on a rapid interval, freezing the browser when DevTools is open |
| **DevToolsDetector** | Polls with 4 heuristics: window-size delta, debugger timing, toString override, Firebug legacy |
| **AntiInspect** | Blocks F12, Ctrl+Shift+I/J/C, Ctrl+U/S, right-click context menu |
| **ConsoleShield** | Overrides all console methods (log, warn, error, table, dir…) with no-ops |
| **ContentProtection** | Prevents text selection (CSS + events) and copy/cut/drag |
| **SourceProtection** | Redirects view-source:// URIs, blocks Ctrl+U |
| **ActionEngine** | On detection: blur, redirect, clear, warn, or custom callback |

## API

```js
// Minimal init (all defaults on)
Guardian.init();

// Custom config
Guardian.init({
  debuggerTrap: true,
  antiInspect: true,
  devToolsDetection: true,
  consoleShield: false,
  antiSelect: false,
  antiCopy: false,
  action: 'blur' | 'redirect' | 'clear' | 'warn' | 'custom',
  redirectUrl: '',
  trapInterval: 100,
  detectionInterval: 800,
  onDevToolsOpen: fn,
  onDevToolsClose: fn,
});

Guardian.destroy();            // Tear down all protections
Guardian.isDevToolsOpen();     // → boolean
Guardian.modules.DebuggerTrap  // Access individual modules
```

## Server
- Port: 5000
- Start: `node server.js`
- Workflow: "Start application"
