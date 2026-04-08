/**
 * Guardian.js
 * Browser security package — UMD build, zero dependencies.
 * Provides: debugger trap, devtools detection, anti-inspect,
 * console shield, anti-select, anti-copy, and source protection.
 */
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined'
    ? (module.exports = factory())
    : typeof define === 'function' && define.amd
    ? define(factory)
    : ((global = global || self), (global.Guardian = factory()));
})(this, function () {
  'use strict';

  /** @type {Object} Public Guardian namespace */
  var Guardian = {};

  /**
   * Default configuration merged with user-supplied options on init.
   * @type {Object}
   */
  var _config = {
    debuggerTrap: true,
    antiInspect: true,
    devToolsDetection: true,
    consoleShield: false,
    antiSelect: false,
    antiCopy: false,
    action: 'warn',
    redirectUrl: '',
    warnMessage: '[Guardian] DevTools detected. Access restricted.',
    onDevToolsOpen: null,
    onDevToolsClose: null,
    trapInterval: 100,
    detectionInterval: 800,
  };

  /**
   * Internal runtime state shared across all modules.
   * @type {Object}
   */
  var _state = {
    devToolsOpen: false,
    trapTimer: null,
    detectionTimer: null,
    initialized: false,
  };

  /**
   * DebuggerTrap
   * Fires a `debugger` statement on a tight interval using the
   * Function constructor. When DevTools is open the browser pauses
   * on every tick, making the page effectively unusable for inspection.
   */
  var DebuggerTrap = {
    /**
     * Start the trap loop.
     * @param {number} intervalMs - Milliseconds between each debugger call.
     */
    start: function (intervalMs) {
      if (_state.trapTimer) return;
      _state.trapTimer = setInterval(function () {
        (function () {
          return false;
        }
          .constructor('debugger')
          .call());
      }, intervalMs || 100);
    },

    /**
     * Stop and clear the trap loop.
     */
    stop: function () {
      if (_state.trapTimer) {
        clearInterval(_state.trapTimer);
        _state.trapTimer = null;
      }
    },
  };

  /**
   * DevToolsDetector
   * Polls using four independent heuristics to detect whether the
   * browser's developer tools panel is currently open.
   */
  var DevToolsDetector = {
    _methods: [],

    /**
     * Window-size delta check — works for docked and undocked DevTools.
     * @returns {boolean}
     */
    _sizeCheck: function () {
      var threshold = 160;
      return (
        window.outerWidth - window.innerWidth > threshold ||
        window.outerHeight - window.innerHeight > threshold
      );
    },

    /**
     * Debugger timing check — DevTools dramatically slows eval execution.
     * @returns {boolean}
     */
    _timingCheck: function () {
      var start = performance.now();
      (function () {}.constructor('debugger')());
      return performance.now() - start > 20;
    },

    /**
     * toString override trick — the getter fires only when DevTools formats
     * the sentinel object for display in the console panel.
     * @returns {boolean}
     */
    _toStringCheck: (function () {
      var triggered = false;
      var sentinel = Object.defineProperty({}, 'id', {
        get: function () {
          triggered = true;
        },
      });
      return function () {
        triggered = false;
        console.log(sentinel);
        console.clear();
        return triggered;
      };
    })(),

    /**
     * Firebug legacy check.
     * @returns {boolean}
     */
    _firebugCheck: function () {
      return !!(window.console && window.console.firebug);
    },

    /**
     * Run all heuristics and return true if any one triggers.
     * @returns {boolean}
     */
    isOpen: function () {
      return (
        DevToolsDetector._sizeCheck() ||
        DevToolsDetector._timingCheck() ||
        DevToolsDetector._firebugCheck()
      );
    },

    /**
     * Begin interval-based polling. Fires onOpen/onClose on state changes.
     * @param {number}   intervalMs - Poll frequency in milliseconds.
     * @param {Function} onOpen     - Called once when DevTools opens.
     * @param {Function} onClose    - Called once when DevTools closes.
     */
    startPolling: function (intervalMs, onOpen, onClose) {
      if (_state.detectionTimer) return;
      _state.detectionTimer = setInterval(function () {
        var open = DevToolsDetector.isOpen();
        if (open && !_state.devToolsOpen) {
          _state.devToolsOpen = true;
          if (typeof onOpen === 'function') onOpen();
        } else if (!open && _state.devToolsOpen) {
          _state.devToolsOpen = false;
          if (typeof onClose === 'function') onClose();
        }
      }, intervalMs || 800);
    },

    /**
     * Stop the polling interval.
     */
    stopPolling: function () {
      if (_state.detectionTimer) {
        clearInterval(_state.detectionTimer);
        _state.detectionTimer = null;
      }
    },
  };

  /**
   * AntiInspect
   * Blocks every common keyboard shortcut and gesture used to open
   * browser developer tools or view the page source.
   */
  var AntiInspect = {
    /**
     * List of key rules to intercept and suppress.
     * Each entry may carry ctrl and shift modifier flags.
     */
    _blockedKeys: [
      { key: 'F12' },
      { key: 'I', ctrl: true, shift: true },
      { key: 'J', ctrl: true, shift: true },
      { key: 'C', ctrl: true, shift: true },
      { key: 'U', ctrl: true },
      { key: 'S', ctrl: true },
      { key: 'P', ctrl: true, shift: true },
      { key: 'F5', ctrl: true },
    ],

    /**
     * Keydown event handler — cancels any matching blocked key combo.
     * @param {KeyboardEvent} e
     */
    _keyHandler: function (e) {
      for (var i = 0; i < AntiInspect._blockedKeys.length; i++) {
        var rule = AntiInspect._blockedKeys[i];
        var keyMatch = e.key === rule.key || e.keyCode === (rule.keyCode || 0);
        var ctrlMatch = rule.ctrl ? e.ctrlKey || e.metaKey : true;
        var shiftMatch = rule.shift ? e.shiftKey : true;
        if (
          (e.key === rule.key || e.code === 'F12' && rule.key === 'F12') &&
          ctrlMatch &&
          shiftMatch
        ) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      }
    },

    /**
     * Contextmenu event handler — suppresses the right-click menu.
     * @param {MouseEvent} e
     */
    _contextHandler: function (e) {
      e.preventDefault();
      return false;
    },

    /**
     * Attach all listeners to the document (capture phase).
     */
    enable: function () {
      document.addEventListener('keydown', AntiInspect._keyHandler, true);
      document.addEventListener('contextmenu', AntiInspect._contextHandler, true);
    },

    /**
     * Remove all listeners from the document.
     */
    disable: function () {
      document.removeEventListener('keydown', AntiInspect._keyHandler, true);
      document.removeEventListener('contextmenu', AntiInspect._contextHandler, true);
    },
  };

  /**
   * ConsoleShield
   * Replaces every console method with a no-op so no application output
   * leaks through the browser's console panel.
   */
  var ConsoleShield = {
    /** @type {Object} Stores originals so they can be restored later. */
    _original: {},
    /** @private No-operation placeholder. */
    _noop: function () {},

    /**
     * Override all console methods with no-ops.
     */
    enable: function () {
      var methods = [
        'log', 'debug', 'info', 'warn', 'error',
        'table', 'dir', 'dirxml', 'group', 'groupEnd',
        'time', 'timeEnd', 'count', 'trace', 'assert',
      ];
      for (var i = 0; i < methods.length; i++) {
        ConsoleShield._original[methods[i]] = console[methods[i]];
        console[methods[i]] = ConsoleShield._noop;
      }
    },

    /**
     * Restore all original console methods.
     */
    disable: function () {
      for (var key in ConsoleShield._original) {
        console[key] = ConsoleShield._original[key];
      }
    },
  };

  /**
   * ContentProtection
   * Prevents text selection and blocks clipboard copy, cut, and drag
   * operations so page content cannot be easily extracted.
   */
  var ContentProtection = {
    /**
     * Cancels selectstart events to prevent text selection.
     * @param {Event} e
     */
    _selectHandler: function (e) {
      e.preventDefault();
      return false;
    },

    /**
     * Clears clipboard data on copy and cut events.
     * @param {ClipboardEvent} e
     */
    _copyHandler: function (e) {
      e.clipboardData && e.clipboardData.setData('text/plain', '');
      e.preventDefault();
      return false;
    },

    /**
     * Cancels dragstart to prevent drag-based content extraction.
     * @param {DragEvent} e
     */
    _dragHandler: function (e) {
      e.preventDefault();
      return false;
    },

    /**
     * Enable text-selection blocking via CSS and event listener.
     */
    enableAntiSelect: function () {
      document.addEventListener('selectstart', ContentProtection._selectHandler, true);
      document.body.style.userSelect = 'none';
      document.body.style.webkitUserSelect = 'none';
      document.body.style.mozUserSelect = 'none';
      document.body.style.msUserSelect = 'none';
    },

    /**
     * Enable copy, cut, and drag blocking.
     */
    enableAntiCopy: function () {
      document.addEventListener('copy', ContentProtection._copyHandler, true);
      document.addEventListener('cut', ContentProtection._copyHandler, true);
      document.addEventListener('dragstart', ContentProtection._dragHandler, true);
    },

    /**
     * Disable text-selection blocking.
     */
    disableAntiSelect: function () {
      document.removeEventListener('selectstart', ContentProtection._selectHandler, true);
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
    },

    /**
     * Disable copy, cut, and drag blocking.
     */
    disableAntiCopy: function () {
      document.removeEventListener('copy', ContentProtection._copyHandler, true);
      document.removeEventListener('cut', ContentProtection._copyHandler, true);
      document.removeEventListener('dragstart', ContentProtection._dragHandler, true);
    },
  };

  /**
   * SourceProtection
   * Redirects away from view-source:// URIs and blocks the Ctrl+U
   * shortcut that opens source in a new tab.
   */
  var SourceProtection = {
    /**
     * Activate source-viewing protections.
     */
    enable: function () {
      if (
        window.location.href.indexOf('view-source:') === 0 ||
        window.location.protocol === 'view-source:'
      ) {
        window.location.replace('about:blank');
      }

      document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
          e.preventDefault();
          return false;
        }
      }, true);
    },
  };

  /**
   * ActionEngine
   * Executes the configured response action whenever DevTools is detected,
   * and restores the page to its original state when DevTools is closed.
   */
  var ActionEngine = {
    /**
     * Run the action specified in cfg.action.
     * @param {Object} cfg - The active Guardian configuration object.
     */
    execute: function (cfg) {
      switch (cfg.action) {
        case 'redirect':
          window.location.href = cfg.redirectUrl || 'about:blank';
          break;
        case 'blur':
          document.body.style.filter = 'blur(8px)';
          document.body.style.pointerEvents = 'none';
          break;
        case 'clear':
          document.body.innerHTML = '';
          break;
        case 'warn':
          console.warn(cfg.warnMessage);
          break;
        case 'custom':
          break;
        default:
          console.warn(cfg.warnMessage);
      }
    },

    /**
     * Undo visual effects applied by the blur action.
     */
    restore: function () {
      document.body.style.filter = '';
      document.body.style.pointerEvents = '';
    },
  };

  /**
   * Initialize Guardian with the given configuration.
   * Calling init() more than once is a no-op until destroy() is called.
   * @param {Object} [userConfig] - Partial config to merge with defaults.
   * @returns {Object} Guardian instance (chainable).
   */
  Guardian.init = function (userConfig) {
    if (_state.initialized) return Guardian;

    Object.assign(_config, userConfig || {});
    _state.initialized = true;

    if (typeof document === 'undefined') return Guardian;

    if (_config.antiInspect) {
      AntiInspect.enable();
    }

    if (_config.consoleShield) {
      ConsoleShield.enable();
    }

    if (_config.antiSelect) {
      ContentProtection.enableAntiSelect();
    }

    if (_config.antiCopy) {
      ContentProtection.enableAntiCopy();
    }

    SourceProtection.enable();

    if (_config.debuggerTrap) {
      DebuggerTrap.start(_config.trapInterval);
    }

    if (_config.devToolsDetection) {
      DevToolsDetector.startPolling(
        _config.detectionInterval,
        function onOpen() {
          ActionEngine.execute(_config);
          if (typeof _config.onDevToolsOpen === 'function') {
            _config.onDevToolsOpen();
          }
        },
        function onClose() {
          ActionEngine.restore();
          if (typeof _config.onDevToolsClose === 'function') {
            _config.onDevToolsClose();
          }
        }
      );
    }

    return Guardian;
  };

  /**
   * Tear down all active protections and reset internal state.
   * @returns {Object} Guardian instance (chainable).
   */
  Guardian.destroy = function () {
    DebuggerTrap.stop();
    DevToolsDetector.stopPolling();
    AntiInspect.disable();
    ConsoleShield.disable();
    ContentProtection.disableAntiSelect();
    ContentProtection.disableAntiCopy();
    ActionEngine.restore();
    _state.initialized = false;
    return Guardian;
  };

  /**
   * Get or set a configuration value at runtime.
   * Pass an object to merge multiple keys at once.
   * @param {string|Object} key   - Config key or object of key/value pairs.
   * @param {*}             [value] - Value to set (omit to read).
   * @returns {*|Object} The config value when reading, or Guardian when writing.
   */
  Guardian.config = function (key, value) {
    if (typeof key === 'object') {
      Object.assign(_config, key);
    } else if (typeof key === 'string') {
      if (value === undefined) return _config[key];
      _config[key] = value;
    }
    return Guardian;
  };

  /**
   * Check whether DevTools is currently detected as open.
   * @returns {boolean}
   */
  Guardian.isDevToolsOpen = function () {
    return _state.devToolsOpen;
  };

  /**
   * Direct access to individual security modules for advanced usage.
   * @type {Object}
   */
  Guardian.modules = {
    DebuggerTrap: DebuggerTrap,
    DevToolsDetector: DevToolsDetector,
    AntiInspect: AntiInspect,
    ConsoleShield: ConsoleShield,
    ContentProtection: ContentProtection,
    SourceProtection: SourceProtection,
    ActionEngine: ActionEngine,
  };

  return Guardian;
});
