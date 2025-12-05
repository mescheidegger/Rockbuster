/* ========================= src/ui/MenuOverlay.js ========================= */

/**
 * MenuOverlay
 * ------------
 * Handles the main menu overlay UI that appears before the game starts.
 * - Allows navigation between "Start", "How to Play", and "About" sections.
 * - Shows/hides the menu overlay.
 * - Starts gameplay when the user presses the Start button.
 */
export class MenuOverlay {
  constructor(game) {
    this.game = game;
    // Root container for the menu overlay (must exist in index.html)
    this.root = document.getElementById('menu-overlay');
    if (!this.root) {
      // If no menu overlay exists, do nothing and exit early
      return;
    }

    this.currentView = 'start'; // Default active panel is "Start"

    // Map of available sections (e.g. start, howto, about), keyed by data-menu-section
    this.sections = new Map();
    const sectionNodes = this.root.querySelectorAll('[data-menu-section]');
    sectionNodes.forEach((section) => {
      const key = section.dataset.menuSection;
      if (key) {
        this.sections.set(key, section);
      }
    });

    // All navigation buttons that change between sections (data-menu-view)
    this.navButtons = Array.from(this.root.querySelectorAll('[data-menu-view]'));

    // Handle clicking on navigation buttons (Start / How to Play / About)
    this.onNavClick = (event) => {
      const target = event.currentTarget;
      const view = target?.dataset?.menuView;
      if (!view) return;

      // Activate the requested view
      this.setView(view);

      // If we navigated back to the start view, focus the Start button for accessibility
      if (view === 'start' && this.startButton && !this.root.classList.contains('is-hidden')) {
        this.startButton.focus?.();
      }
    };

    // Attach click listeners to each navigation button
    this.navButtons.forEach((button) => {
      button.addEventListener('click', this.onNavClick);
    });

    // Find the Start Game button (data-action="start-game")
    this.startButton = this.root.querySelector('[data-action="start-game"]');
    if (this.startButton) {
      this.startButton.addEventListener('click', (event) => {
        event.preventDefault();
        this.game?.requestAudioUnlock?.();
        this.startGame(); // Trigger game start
      });
    }

    // When the game notifies that gameplay has officially begun, hide the menu
    this.handleGameStarted = () => {
      this.hide();
    };

    // Optional: listen for a custom 'game-started' event on the canvas
    this.game?.canvas?.addEventListener?.('game-started', this.handleGameStarted);

    // Show the menu initially with the default view
    this.show(this.currentView);
  }

  /**
   * Public method to begin gameplay and hide the menu.
   */
  startGame() {
    this.hide();
    this.game?.startGame?.();
  }

  /**
   * Switches which panel (start / howto / about) is visible.
   */
  setView(view) {
    if (!this.sections.has(view)) {
      return; // Ignore unknown view keys
    }

    this.currentView = view;

    // Show the selected section, hide others
    this.sections.forEach((section, key) => {
      section.classList.toggle('is-active', key === view);
    });

    // Update nav button "active" styling
    this.navButtons.forEach((button) => {
      const target = button.dataset.menuView;
      button.classList.toggle('is-active', target === view);
    });
  }

  /**
   * Show the entire menu overlay and set a specific view (defaults to 'start').
   */
  show(view = 'start') {
    this.setView(view);
    this.root.classList.remove('is-hidden');
    this.root.setAttribute('aria-hidden', 'false');
  }

  /**
   * Hide the menu overlay entirely (e.g., when the game starts).
   */
  hide() {
    this.root.classList.add('is-hidden');
    this.root.setAttribute('aria-hidden', 'true');
    // Reset to start screen so when user returns, it defaults to main panel
    this.setView('start');
  }

  /**
   * Clean up event listeners when destroying the menu overlay instance.
   */
  destroy() {
    this.navButtons.forEach((button) => {
      button.removeEventListener('click', this.onNavClick);
    });
    this.game?.canvas?.removeEventListener?.('game-started', this.handleGameStarted);
  }
}
