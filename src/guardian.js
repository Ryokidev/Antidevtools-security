(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined'
    ? (module.exports = factory())
    : typeof define === 'function' && define.amd
    ? define(factory)
    : ((global = global || self), (global.Guardian = factory()));
})(this, function () {
  'use strict';

  /** @type {Object} */
  var Guardian = {};

  /** @type {Object} */
  var _config = {
    debuggerTrap: true,
    antiInspect: true,
    devToolsDetection: true,
    consoleShield: false,
    antiSelect: false,
    antiCopy: false,
    antiIframe: true,
    headlessDetection: true,
    tamperDetection: true,
    domWatermark: false,
    action: 'warn',
    redirectUrl: '',
    warnMessage: '[Guardian] DevTools detected. Access restricted.',
    onDevToolsOpen: null,
    onDevToolsClose: null,
    onHeadlessDetected: null,
    onTamperDetected: null,
    trapInterval: 100,
    detectionInterval: 800,
  };

  /** @type {Object} */
  var _state = {
    devToolsOpen: false,
    trapTimer: null,
    detectionTimer: null,
    initialized: false,
    watermarkToken: null,
  };

  var DebuggerTrap = {
    /**
     * @param {number} intervalMs
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

    stop: function () {
      if (_state.trapTimer) {
        clearInterval(_state.trapTimer);
        _state.trapTimer = null;
      }
    },
  };

  var DevToolsDetector = {
    _methods: [],

    /**
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
     * @returns {boolean}
     */
    _timingCheck: function () {
      var start = performance.now();
      (function () {}.constructor('debugger')());
      return performance.now() - start > 20;
    },

    /**
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
     * @returns {boolean}
     */
    _firebugCheck: function () {
      return !!(window.console && window.console.firebug);
    },

    /**
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
     * @param {number}   intervalMs
     * @param {Function} onOpen
     * @param {Function} onClose
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

    stopPolling: function () {
      if (_state.detectionTimer) {
        clearInterval(_state.detectionTimer);
        _state.detectionTimer = null;
      }
    },
  };

  var AntiInspect = {
    /** @type {Array.<{key: string, ctrl?: boolean, shift?: boolean}>} */
    _blockedKeys: [
      { key: 'F12' },
      { key: 'I',           ctrl: true, shift: true },
      { key: 'J',           ctrl: true, shift: true },
      { key: 'C',           ctrl: true, shift: true },
      { key: 'U',           ctrl: true },
      { key: 'S',           ctrl: true },
      { key: 'P',           ctrl: true, shift: true },
      { key: 'F5',          ctrl: true },
      { key: 'PrintScreen' },
    ],

    /**
     * @param {KeyboardEvent} e
     */
    _keyHandler: function (e) {
      for (var i = 0; i < AntiInspect._blockedKeys.length; i++) {
        var rule = AntiInspect._blockedKeys[i];
        var ctrlMatch = rule.ctrl ? e.ctrlKey || e.metaKey : true;
        var shiftMatch = rule.shift ? e.shiftKey : true;
        if (
          (e.key === rule.key || (e.code === 'F12' && rule.key === 'F12')) &&
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
     * @param {MouseEvent} e
     */
    _contextHandler: function (e) {
      e.preventDefault();
      return false;
    },

    enable: function () {
      document.addEventListener('keydown', AntiInspect._keyHandler, true);
      document.addEventListener('contextmenu', AntiInspect._contextHandler, true);
    },

    disable: function () {
      document.removeEventListener('keydown', AntiInspect._keyHandler, true);
      document.removeEventListener('contextmenu', AntiInspect._contextHandler, true);
    },
  };

  var ConsoleShield = {
    /** @type {Object} */
    _original: {},
    /** @private */
    _noop: function () {},

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

    disable: function () {
      for (var key in ConsoleShield._original) {
        console[key] = ConsoleShield._original[key];
      }
    },
  };

  var ContentProtection = {
    /**
     * @param {Event} e
     */
    _selectHandler: function (e) {
      e.preventDefault();
      return false;
    },

    /**
     * @param {ClipboardEvent} e
     */
    _copyHandler: function (e) {
      e.clipboardData && e.clipboardData.setData('text/plain', '');
      e.preventDefault();
      return false;
    },

    /**
     * @param {DragEvent} e
     */
    _dragHandler: function (e) {
      e.preventDefault();
      return false;
    },

    enableAntiSelect: function () {
      document.addEventListener('selectstart', ContentProtection._selectHandler, true);
      document.body.style.userSelect = 'none';
      document.body.style.webkitUserSelect = 'none';
      document.body.style.mozUserSelect = 'none';
      document.body.style.msUserSelect = 'none';
    },

    enableAntiCopy: function () {
      document.addEventListener('copy', ContentProtection._copyHandler, true);
      document.addEventListener('cut', ContentProtection._copyHandler, true);
      document.addEventListener('dragstart', ContentProtection._dragHandler, true);
    },

    disableAntiSelect: function () {
      document.removeEventListener('selectstart', ContentProtection._selectHandler, true);
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
    },

    disableAntiCopy: function () {
      document.removeEventListener('copy', ContentProtection._copyHandler, true);
      document.removeEventListener('cut', ContentProtection._copyHandler, true);
      document.removeEventListener('dragstart', ContentProtection._dragHandler, true);
    },
  };

  var SourceProtection = {
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

  var ActionEngine = {
    /**
     * @param {Object} cfg
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

    restore: function () {
      document.body.style.filter = '';
      document.body.style.pointerEvents = '';
    },
  };

  var HeadlessDetector = {
    /**
     * @returns {boolean}
     */
    isHeadless: function () {
      if (navigator.webdriver) return true;
      if (/HeadlessChrome|PhantomJS/.test(navigator.userAgent)) return true;
      if (window._phantom || window.callPhantom || window.__phantomas) return true;
      if (navigator.plugins.length === 0 && !/Firefox/.test(navigator.userAgent)) return true;
      if (!window.chrome && /Chrome/.test(navigator.userAgent) && !/Edg/.test(navigator.userAgent)) return true;
      if (typeof navigator.permissions === 'undefined') return true;
      return false;
    },

    /**
     * @param {Function} onDetected
     */
    check: function (onDetected) {
      if (HeadlessDetector.isHeadless()) {
        if (typeof onDetected === 'function') onDetected();
      }
    },
  };

  var AntiIframe = {
    enable: function () {
      try {
        if (top !== self) {
          top.location = self.location.href;
        }
      } catch (e) {
        document.body.innerHTML = '';
        document.body.style.background = '#000';
      }

      Object.defineProperty(document, 'referrer', {
        get: function () { return ''; },
        configurable: true,
      });
    },
  };

  var TamperDetector = {
    /** @type {Object} */
    _snapshots: {},

    capture: function () {
      TamperDetector._snapshots.init    = Guardian.init.toString();
      TamperDetector._snapshots.destroy = Guardian.destroy.toString();
      TamperDetector._snapshots.config  = Guardian.config.toString();
    },

    /**
     * @returns {boolean}
     */
    isIntact: function () {
      return (
        Guardian.init.toString()    === TamperDetector._snapshots.init &&
        Guardian.destroy.toString() === TamperDetector._snapshots.destroy &&
        Guardian.config.toString()  === TamperDetector._snapshots.config
      );
    },

    /**
     * @param {Function} onTamper
     * @param {number}   intervalMs
     */
    startPolling: function (onTamper, intervalMs) {
      setInterval(function () {
        if (!TamperDetector.isIntact()) {
          if (typeof onTamper === 'function') onTamper();
        }
      }, intervalMs || 1000);
    },
  };

  var DOMWatermark = {
    /**
     * @returns {string}
     */
    _generate: function () {
      return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
    },

    /**
     * @returns {string}
     */
    inject: function () {
      var token = DOMWatermark._generate();
      _state.watermarkToken = token;

      var meta = document.createElement('meta');
      meta.name = 'x-session-id';
      meta.content = token;
      document.head.appendChild(meta);

      var node = document.createElement('span');
      node.setAttribute('data-guardian-wm', token);
      node.style.cssText = 'position:fixed;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none;';
      document.body.appendChild(node);

      return token;
    },

    /**
     * @returns {string|null}
     */
    getToken: function () {
      return _state.watermarkToken;
    },
  };

  /**
   * @param {Object} [userConfig]
   * @returns {Object}
   */
  Guardian.init = function (userConfig) {
    if (_state.initialized) return Guardian;

    Object.assign(_config, userConfig || {});
    _state.initialized = true;

    if (typeof document === 'undefined') return Guardian;

    if (_config.antiIframe) {
      AntiIframe.enable();
    }

    if (_config.headlessDetection) {
      HeadlessDetector.check(function () {
        ActionEngine.execute(_config);
        if (typeof _config.onHeadlessDetected === 'function') {
          _config.onHeadlessDetected();
        }
      });
    }

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

    if (_config.domWatermark) {
      DOMWatermark.inject();
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

    if (_config.tamperDetection) {
      TamperDetector.capture();
      TamperDetector.startPolling(function () {
        ActionEngine.execute(_config);
        if (typeof _config.onTamperDetected === 'function') {
          _config.onTamperDetected();
        }
      }, 1000);
    }

    return Guardian;
  };

  /**
   * @returns {Object}
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
   * @param {string|Object} key
   * @param {*} [value]
   * @returns {*|Object}
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
   * @returns {boolean}
   */
  Guardian.isDevToolsOpen = function () {
    return _state.devToolsOpen;
  };

  /**
   * @returns {string|null}
   */
  Guardian.getWatermarkToken = function () {
    return DOMWatermark.getToken();
  };

  /** @type {Object} */
  Guardian.modules = {
    DebuggerTrap: DebuggerTrap,
    DevToolsDetector: DevToolsDetector,
    AntiInspect: AntiInspect,
    ConsoleShield: ConsoleShield,
    ContentProtection: ContentProtection,
    SourceProtection: SourceProtection,
    ActionEngine: ActionEngine,
    HeadlessDetector: HeadlessDetector,
    AntiIframe: AntiIframe,
    TamperDetector: TamperDetector,
    DOMWatermark: DOMWatermark,
  };

  return Guardian;
});
