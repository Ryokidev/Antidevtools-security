# ANTIDEVTOOLS 
## 📙 XEDD

![Language](https://img.shields.io/badge/language-JavaScript-f7df1e?style=flat-square&logo=javascript&logoColor=black)
![Module](https://img.shields.io/badge/module-UMD-blue?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![Dependencies](https://img.shields.io/badge/dependencies-none-lightgrey?style=flat-square)

Client-side browser security library. Drop it in, call `init()`, and it handles the rest.

Works as a UMD module — no bundler required, no dependencies. Plain ES5 JavaScript, runs in any browser.

---

## What it does

| Module | What it actually does |
|---|---|
| Debugger Trap | Fires `debugger` on a tight loop via the Function constructor. If DevTools is open the browser locks up on every tick. |
| DevTools Detection | Polls with four heuristics (size delta, eval timing, toString override, Firebug check). Fires callbacks on open/close. |
| Anti-Inspect | Kills F12, Ctrl+Shift+I/J/C, Ctrl+U/S, PrintScreen, and right-click. |
| Console Shield | Replaces every `console.*` method with a no-op. Restorable. |
| Anti-Select / Anti-Copy | CSS + event-based text selection and clipboard blocking. |
| Source Protection | Redirects `view-source://` and blocks Ctrl+U. |
| Headless Detection | Checks `navigator.webdriver`, plugin count, UA strings, and other automation flags to catch Puppeteer/Playwright/PhantomJS. |
| Anti-Iframe | Busts out of foreign iframes on load. If the framebusting is blocked by sandbox, blanks the document instead. |
| Tamper Detection | Snapshots critical Guardian functions on init and re-checks them every second. Triggers the action engine if they've been patched. |
| DOM Watermark | Injects a unique session token into the `<head>` and a hidden DOM node. Useful for tracing scraped HTML back to a session. |

---

## Install

Just include the script. No npm, no build step needed.

```html
<script src="guardian.js"></script>
```

Or via module:

```js
const Guardian = require('./src/guardian');
```

---

## Usage

```js
Guardian.init();
```

That's the minimal case. Everything except `consoleShield`, `antiSelect`, `antiCopy`, and `domWatermark` is on by default.

Full config:

```js
Guardian.init({
  debuggerTrap:      true,
  devToolsDetection: true,
  antiInspect:       true,
  antiIframe:        true,
  headlessDetection: true,
  tamperDetection:   true,
  consoleShield:     false,
  antiSelect:        false,
  antiCopy:          false,
  domWatermark:      false,

  action:      'blur',        // 'warn' | 'blur' | 'redirect' | 'clear' | 'custom'
  redirectUrl: 'about:blank', // used when action is 'redirect'

  trapInterval:      100,  // ms between debugger calls
  detectionInterval: 800,  // ms between devtools polls

  onDevToolsOpen:     function() {},
  onDevToolsClose:    function() {},
  onHeadlessDetected: function() {},
  onTamperDetected:   function() {},
});
```

---

## Callbacks

Every detection path exposes a callback. The `action` field controls the built-in response, but you can layer your own logic on top:

```js
Guardian.init({
  action: 'custom',
  onDevToolsOpen: function() {
    document.getElementById('overlay').style.display = 'flex';
  },
  onDevToolsClose: function() {
    document.getElementById('overlay').style.display = 'none';
  },
  onHeadlessDetected: function() {
    window.location.href = '/blocked';
  },
  onTamperDetected: function() {
    document.body.innerHTML = '';
  },
});
```

---

## Watermark

When `domWatermark: true`, a unique token gets injected into the page on every load. You can read it back:

```js
var token = Guardian.getWatermarkToken();
// send to your server, log it, whatever
```

The token shows up as a `<meta name="x-session-id">` and a hidden `<span data-guardian-wm="...">`. If someone scrapes your HTML and you find it in the wild, the token tells you which session it came from.

---

## Individual modules

All modules are accessible directly if you only need one piece:

```js
var { HeadlessDetector, TamperDetector, DOMWatermark, AntiIframe } = Guardian.modules;

if (HeadlessDetector.isHeadless()) {
  // handle it
}

DOMWatermark.inject();
console.log(DOMWatermark.getToken());

AntiIframe.enable();

TamperDetector.capture();
TamperDetector.startPolling(function() {
  console.log('something patched Guardian');
}, 500);
```

---

## Teardown

```js
Guardian.destroy();
```

Stops all timers, removes event listeners, restores console methods, and resets state. Safe to call multiple times.

---

## Caveats

This library makes inspection harder, not impossible. A sufficiently motivated person with local control of the browser can work around most of this. That's true of every client-side protection. The goal is to raise the cost for casual scraping, automated tooling, and opportunistic inspection — not to be a cryptographic guarantee.

The tamper detection and headless checks in particular are heuristics. They'll catch common automation setups but won't catch a fully patched or custom-built browser.

The debugger trap is the most effective piece — it genuinely makes DevTools unusable while active. Everything else is defense in depth.

---

## License

MIT
