/* ========================= src/core/Input.js ========================= */

/**
 * Simple keyboard input handler.
 *
 * Tracks:
 *  - Keys that are currently held down.
 *  - Keys that were *just pressed* this frame.
 *  - Keys that were *just released* this frame.
 *
 * This allows you to detect:
 *  - Continuous input: "Is the key still held?"       → isDown()
 *  - Single key taps:  "Did the user press this now?" → pressed()
 *  - Key releases:     "Did the key go up this frame?"→ released()
 */
export class Input {
  constructor() {
    // Keys currently being held down.
    this.keys = new Set();

    // Keys pressed down *during this frame only*.
    this.justPressed = new Set();

    // Keys released *during this frame only*.
    this.justReleased = new Set();

    // --- Listen for keydown events globally ---
    addEventListener('keydown', e => {
      // If this is the first frame the key was pressed, mark it as justPressed.
      if (!this.keys.has(e.code)) {
        this.justPressed.add(e.code);
      }
      // Add to keys held down.
      this.keys.add(e.code);
    });

    // --- Listen for keyup events globally ---
    addEventListener('keyup', e => {
      // Remove the key from the "held" set.
      this.keys.delete(e.code);
      // Mark it as released this frame.
      this.justReleased.add(e.code);
    });
  }

  /**
   * Must be called once at the end of each frame (after update logic).
   * Clears the "edge" events, so pressed/released only last for 1 frame.
   */
  postUpdate() {
    this.justPressed.clear();
    this.justReleased.clear();
  }

  /**
   * Returns true if key is *currently held down*.
   * Example: hold "ArrowUp" to keep thrusting.
   */
  isDown(code) {
    return this.keys.has(code);
  }

  /**
   * Returns true only on the *first frame* the key is pressed.
   * Example: fire bullet once when pressing Space.
   */
  pressed(code) {
    return this.justPressed.has(code);
  }

  /**
   * Returns true only on the frame the key is released.
   * Useful for toggles or menu actions.
   */
  released(code) {
    return this.justReleased.has(code);
  }
}
