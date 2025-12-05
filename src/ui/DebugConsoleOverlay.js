/* ==================== src/ui/DebugConsoleOverlay.js ==================== */
/**
 * DebugConsoleOverlay mirrors console output inside the game canvas view.
 *
 * Designed for mobile debugging sessions where the browser console is
 * inaccessible (e.g., Safari on iOS without a tethered Mac). When enabled via
 * `CONFIG.DEBUG.CONSOLE_OVERLAY.ENABLED`, it decorates the built-in console
 * methods so every log, warning, and error is rendered into a lightweight
 * on-screen overlay.
 */
export class DebugConsoleOverlay {
  /**
   * Builds the DOM scaffold for the overlay and immediately hooks the
   * browser's console so future log messages appear on screen.
   *
   * The overlay will re-use an existing element with the `debug` id when
   * present. Otherwise a container is generated and appended to `<body>` so
   * the feature can be enabled without markup changes.
   *
   * @param {Object} [options]
   * @param {number} [options.maxEntries=200]  Maximum number of log entries to keep.
   * @param {boolean} [options.includeTimestamp=true]  Whether to prefix logs with time.
   * @param {HTMLElement} [options.root]  Optional container element to render into.
   */
  constructor({ maxEntries = 200, includeTimestamp = true, root } = {}) {
    this.maxEntries = Math.max(1, maxEntries);
    this.includeTimestamp = includeTimestamp;

    this.root = root ?? document.getElementById('debug') ?? document.createElement('div');
    this.createdRoot = !root && !document.getElementById('debug');
    this.root.classList.add('debug-console-overlay');
    this.root.classList.remove('hidden');

    this.root.setAttribute('role', 'region');
    this.root.setAttribute('aria-label', 'Debug console output');

    this.root.innerHTML = '';

    this.headerEl = document.createElement('div');
    this.headerEl.className = 'debug-console-overlay__header';

    const title = document.createElement('span');
    title.className = 'debug-console-overlay__title';
    title.textContent = 'Debug Console';

    const controls = document.createElement('div');
    controls.className = 'debug-console-overlay__controls';

    this.toggleButton = document.createElement('button');
    this.toggleButton.type = 'button';
    this.toggleButton.className = 'debug-console-overlay__button';
    this.toggleButton.textContent = 'Hide';
    this.toggleButton.setAttribute('aria-expanded', 'true');
    this.onToggleClick = () => this.toggleCollapsed();
    this.toggleButton.addEventListener('click', this.onToggleClick);

    this.clearButton = document.createElement('button');
    this.clearButton.type = 'button';
    this.clearButton.className = 'debug-console-overlay__button';
    this.clearButton.textContent = 'Clear';
    this.onClearClick = () => this.clear();
    this.clearButton.addEventListener('click', this.onClearClick);

    controls.append(this.toggleButton, this.clearButton);
    this.headerEl.append(title, controls);

    this.messagesEl = document.createElement('div');
    this.messagesEl.className = 'debug-console-overlay__messages';
    this.messagesEl.setAttribute('role', 'log');
    this.messagesEl.setAttribute('aria-live', 'polite');
    this.messagesEl.setAttribute('aria-relevant', 'additions');

    this.root.append(this.headerEl, this.messagesEl);

    if (this.createdRoot) {
      document.body.appendChild(this.root);
    }

    this.originalConsole = {};
    this.isHooked = false;

    this.install();
  }

  /**
   * Hooks into `console.*` methods so every invocation is mirrored into the
   * overlay. Each method is wrapped lazily and restored during `destroy()`.
   */
  install() {
    if (this.isHooked) {
      return;
    }

    const methods = ['log', 'debug', 'info', 'warn', 'error'];

    methods.forEach((method) => {
      const original = console[method]?.bind(console) ?? (() => {});
      this.originalConsole[method] = original;

      console[method] = (...args) => {
        try {
          this.appendEntry(method, args);
        } catch (overlayError) {
          original('[DebugConsoleOverlay] Failed to render log entry:', overlayError);
        }
        return original(...args);
      };
    });

    const originalClear = console.clear?.bind(console);
    this.originalConsole.clear = originalClear;
    console.clear = () => {
      this.clear();
      if (originalClear) {
        originalClear();
      }
    };

    this.isHooked = true;
    this.appendEntry('info', ['Debug console overlay active.']);
  }

  /**
   * Restores the original console methods and detaches DOM event listeners.
   * Useful when tearing the game down or when the overlay should no longer
   * intercept console messages.
   */
  destroy() {
    if (!this.isHooked) {
      return;
    }

    ['log', 'debug', 'info', 'warn', 'error', 'clear'].forEach((method) => {
      if (this.originalConsole[method]) {
        console[method] = this.originalConsole[method];
      }
    });

    this.toggleButton?.removeEventListener('click', this.onToggleClick);
    this.clearButton?.removeEventListener('click', this.onClearClick);

    this.isHooked = false;
  }

  /**
   * Removes every log entry from the visible overlay while leaving the console
   * method hooks in place.
   */
  clear() {
    if (!this.messagesEl) {
      return;
    }
    this.messagesEl.innerHTML = '';
  }

  /**
   * Collapses or expands the overlay container and updates the accessible
   * state exposed to assistive technology.
   */
  toggleCollapsed() {
    const collapsed = this.root.classList.toggle('debug-console-overlay--collapsed');
    this.toggleButton.textContent = collapsed ? 'Show' : 'Hide';
    this.toggleButton.setAttribute('aria-expanded', String(!collapsed));
  }

  /**
   * Appends a formatted log entry to the overlay while enforcing the
   * configured maximum number of entries.
   *
   * @param {string} level  Console method name (log, warn, error, ...)
   * @param {any[]} args    Arguments originally passed to the console call.
   */
  appendEntry(level, args) {
    if (!this.messagesEl) {
      return;
    }

    const entry = document.createElement('div');
    entry.className = `debug-console-overlay__entry debug-console-overlay__entry--${level}`;

    if (this.includeTimestamp) {
      const time = document.createElement('span');
      time.className = 'debug-console-overlay__timestamp';
      time.textContent = this.formatTimestamp(new Date());
      entry.appendChild(time);
    }

    const message = document.createElement('span');
    message.className = 'debug-console-overlay__message';
    message.textContent = this.formatArgs(args);
    entry.appendChild(message);

    this.messagesEl.appendChild(entry);
    this.trimEntries();

    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  /**
   * Trims old entries when the overlay exceeds the configured capacity.
   */
  trimEntries() {
    if (!this.messagesEl) {
      return;
    }

    while (this.messagesEl.children.length > this.maxEntries) {
      this.messagesEl.removeChild(this.messagesEl.firstChild);
    }
  }

  /**
   * Formats a Date into a simple HH:MM:SS string for timestamp prefixes.
   */
  formatTimestamp(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  /**
   * Formats each argument passed to a console call into a readable string.
   */
  formatArgs(args) {
    return args
      .map((arg) => this.formatArg(arg))
      .join(' ')
      .trim();
  }

  /**
   * Handles formatting logic for individual console arguments, falling back to
   * JSON serialization for rich objects and preserving error stack traces when
   * available.
   */
  formatArg(arg) {
    if (typeof arg === 'string') {
      return arg;
    }

    if (arg instanceof Error) {
      return arg.stack || `${arg.name}: ${arg.message}`;
    }

    if (typeof arg === 'object' && arg !== null) {
      try {
        return JSON.stringify(arg, null, 2);
      } catch (error) {
        return `[object ${(arg.constructor && arg.constructor.name) || 'Object'}]`;
      }
    }

    return String(arg);
  }
}
