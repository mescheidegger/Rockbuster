/* ========================= src/ui/GameOverOverlay.js ========================= */

/**
 * GameOverOverlay
 * ---------------
 * Displays a post-run menu when the player loses all lives.
 * Presents the final score, wave reached, and options to restart or return to the
 * main menu. The overlay listens for `game-over` and `game-started` events that
 * the Game instance dispatches on the canvas element.
 */
export class GameOverOverlay {
  constructor(game, options = {}) {
    this.game = game;
    this.onReturnToMenu = options.onReturnToMenu;

    this.root = document.getElementById('gameover-overlay');
    if (!this.root) {
      return;
    }

    // Cache references to DOM nodes we need to populate and interact with.
    this.scoreValue = this.root.querySelector('[data-score-value]');
    this.waveValue = this.root.querySelector('[data-wave-value]');
    this.highScoreValue = this.root.querySelector('[data-highscore-value]');
    this.highScoreMessage = this.root.querySelector('[data-highscore-message]');
    this.playAgainButton = this.root.querySelector('[data-action="play-again"]');
    this.returnMenuButton = this.root.querySelector('[data-action="return-menu"]');

    // Event handler fired when the Game dispatches a `game-over` CustomEvent.
    // The canvas event detail contains the final score and wave index.
    this.handleGameOver = (event) => {
      const detail = event?.detail ?? {};
      this.updateDetails(detail.score, detail.wave, detail.highScore, detail.newHighScore);
      this.show();
    };

    // When a fresh game run begins, hide the overlay so the player can see playfield.
    this.handleGameStarted = () => {
      this.hide();
    };

    // The menu state also implies the overlay should not be visible.
    this.handleReturnedToMenu = () => {
      this.hide();
    };

    // Restart the current Game instance and return focus to the play button.
    this.handlePlayAgainClick = () => {
      this.hide();
      this.game?.reset?.();
    };

    // Return to the title menu via Game helper, then trigger optional callback.
    this.handleReturnMenuClick = () => {
      this.hide();
      this.game?.returnToMenu?.();
      if (typeof this.onReturnToMenu === 'function') {
        this.onReturnToMenu();
      }
    };

    // Wire up button click listeners.
    this.playAgainButton?.addEventListener('click', this.handlePlayAgainClick);
    this.returnMenuButton?.addEventListener('click', this.handleReturnMenuClick);

    // Subscribe to lifecycle events emitted by the Game via the canvas element.
    this.game?.canvas?.addEventListener?.('game-over', this.handleGameOver);
    this.game?.canvas?.addEventListener?.('game-started', this.handleGameStarted);
    this.game?.canvas?.addEventListener?.('game-returned-to-menu', this.handleReturnedToMenu);
  }

  show() {
    // Reveal the overlay and focus the "Play Again" button for accessibility.
    this.root.classList.remove('is-hidden');
    this.root.setAttribute('aria-hidden', 'false');
    this.playAgainButton?.focus?.();
  }

  hide() {
    // Hide overlay visually and for assistive technologies.
    this.root.classList.add('is-hidden');
    this.root.setAttribute('aria-hidden', 'true');
  }

  updateDetails(score, wave, highScore, isNewHighScore) {
    // Defensive defaulting keeps the overlay stable even if detail is missing.
    if (this.scoreValue) {
      const safeScore = typeof score === 'number' ? score : 0;
      this.scoreValue.textContent = safeScore.toLocaleString();
    }

    if (this.waveValue) {
      const waveIndex = typeof wave === 'number' ? wave : 0;
      this.waveValue.textContent = (waveIndex + 1).toLocaleString();
    }

    if (this.highScoreValue) {
      const bestScore = typeof highScore === 'number' ? highScore : 0;
      this.highScoreValue.textContent = bestScore.toLocaleString();
    }

    if (this.highScoreMessage) {
      this.highScoreMessage.hidden = !isNewHighScore;
    }
  }

  destroy() {
    // Remove DOM and canvas listeners so the instance can be garbage-collected.
    this.game?.canvas?.removeEventListener?.('game-over', this.handleGameOver);
    this.game?.canvas?.removeEventListener?.('game-started', this.handleGameStarted);
    this.game?.canvas?.removeEventListener?.('game-returned-to-menu', this.handleReturnedToMenu);

    this.playAgainButton?.removeEventListener('click', this.handlePlayAgainClick);
    this.returnMenuButton?.removeEventListener('click', this.handleReturnMenuClick);
  }
}
