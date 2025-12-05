/* ========================= src/ui/VirtualControls.js ========================= */
/**
 * VirtualControls (joystick + fire button)
 *
 * Behavior:
 *  - Joystick: STEER-TO-ANGLE. The ship turns toward the joystick's absolute angle.
 *              When the stick is deflected beyond a small threshold, we:
 *                • Compute stickAngle = atan2(-dy, dx)   (screen Y down → invert)
 *                • Compare to getShipAngle()             (supplied by Game)
 *                • Press ArrowLeft/ArrowRight based on shortest angular difference
 *                • Hold ArrowUp (thrust) while deflected
 *  - Fire button: on press, send a one-frame justPressed('Space') and then hold 'Space'
 *
 * Requirements in index.html:
 *   <div id="ui-controls">
 *     <div id="stick"><div id="stick-nub"></div></div>
 *     <button id="fire-btn" aria-label="Fire"></button>
 *   </div>
 *
 * CSS positions them on small screens; hidden on desktop via media query.
 */
export class VirtualControls {
  constructor(canvas, input, opts = {}) {
    this.canvas = canvas;
    this.input = input;

    // Optional: provided by Game so we can steer toward current ship angle
    this.getShipAngle = typeof opts.getShipAngle === 'function' ? opts.getShipAngle : null;
    this.onUserGesture = typeof opts.onUserGesture === 'function' ? opts.onUserGesture : null;

    // UI elements
    this.ui = document.getElementById('ui-controls');
    this.stick = document.getElementById('stick');
    this.nub = document.getElementById('stick-nub');
    this.fireBtn = document.getElementById('fire-btn');

    // If overlay not present, no-op
    if (!this.ui || !this.stick || !this.nub || !this.fireBtn) {
      console.warn('[VirtualControls] Controls overlay not found; skipping.');
      this._active = false;
      return;
    }
    this._active = true;

    // Tunables
    this.maxRadius = opts.maxRadius ?? 56;                // px max deflection from stick center
    this.thrustThreshold = opts.thrustThreshold ?? 0.22;  // normalized magnitude to engage thrust
    this.turnThreshold   = opts.turnThreshold   ?? 0.12;  // normalized magnitude to start steering
    this.turnDeadzoneRad = opts.turnDeadzoneRad ?? 0.08;  // ~5° deadzone around target angle

    // Internal joystick state
    this.activeStickId = null;
    this.stickCenter = { x: 0, y: 0 };

    // Bind handlers
    this.onStickDown = this.onStickDown.bind(this);
    this.onStickMove = this.onStickMove.bind(this);
    this.onStickUp   = this.onStickUp.bind(this);
    this.onFireDown  = this.onFireDown.bind(this);
    this.onFireUp    = this.onFireUp.bind(this);

    // Wire events
    this.stick.addEventListener('pointerdown',  this.onStickDown,  { passive: true });
    this.stick.addEventListener('pointermove',  this.onStickMove,  { passive: true });
    this.stick.addEventListener('pointerup',    this.onStickUp,    { passive: true });
    this.stick.addEventListener('pointercancel',this.onStickUp,    { passive: true });

    this.fireBtn.addEventListener('pointerdown', this.onFireDown,  { passive: true });
    this.fireBtn.addEventListener('pointerup',   this.onFireUp,    { passive: true });
    this.fireBtn.addEventListener('pointercancel', this.onFireUp,  { passive: true });
  }

  destroy() {
    if (!this._active) return;
    this.stick.removeEventListener('pointerdown',  this.onStickDown);
    this.stick.removeEventListener('pointermove',  this.onStickMove);
    this.stick.removeEventListener('pointerup',    this.onStickUp);
    this.stick.removeEventListener('pointercancel',this.onStickUp);
    this.fireBtn.removeEventListener('pointerdown', this.onFireDown);
    this.fireBtn.removeEventListener('pointerup',   this.onFireUp);
    this.fireBtn.removeEventListener('pointercancel', this.onFireUp);
  }

  rect(el) { return el.getBoundingClientRect(); }

  /* ----------------------------- Joystick ----------------------------- */
  onStickDown(e) {
    if (this.activeStickId !== null) return;
    this.onUserGesture?.(e);
    this.activeStickId = e.pointerId;

    const r = this.rect(this.stick);
    this.stickCenter.x = r.left + r.width / 2;
    this.stickCenter.y = r.top + r.height / 2;

    this.stick.setPointerCapture?.(e.pointerId);
    this.onStickMove(e); // update immediately
  }

  onStickMove(e) {
    if (e.pointerId !== this.activeStickId) return;

    // Displacement from center
    const dx = e.clientX - this.stickCenter.x;
    const dy = e.clientY - this.stickCenter.y;

    // Clamp to max radius
    const dist = Math.hypot(dx, dy);
    const clamp = dist > this.maxRadius ? (this.maxRadius / dist) : 1;
    const cdx = dx * clamp;
    const cdy = dy * clamp;

    // Visual feedback
    this.nub.style.transform = `translate(${cdx}px, ${cdy}px)`;

    // Normalize to [-1..1] range; up should be positive y
    const nx = cdx / this.maxRadius;
    const ny = -cdy / this.maxRadius; // invert so up is +1
    const mag = Math.min(1, Math.hypot(nx, ny)); // 0..1

    // ---- Thrust: always on while deflected beyond threshold ----
    if (mag > this.thrustThreshold) {
      this.input.keys.add('ArrowUp');
    } else {
      this.input.keys.delete('ArrowUp');
    }

    // ---- Steering: turn toward the stick's absolute angle ----
    // Only steer if we have a ship angle provider AND the stick is pushed enough.
    const canSteer = typeof this.getShipAngle === 'function' && mag > this.turnThreshold;
    if (canSteer) {
      // Stick angle in radians: note screen Y is downward, so we use -cdy
      //const stickAngle = Math.atan2(-cdy, cdx); // [-PI, PI] - inverted controls
      const stickAngle = Math.atan2(cdy, cdx);  // [-PI, PI]  
      const shipAngle  = this.getShipAngle();

      // Shortest signed angular difference into [-PI, PI]
      let d = stickAngle - shipAngle;
      while (d >  Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;

      // Decide which key to press based on sign of difference
      if (d > this.turnDeadzoneRad) {
        this.input.keys.add('ArrowRight');
        this.input.keys.delete('ArrowLeft');
      } else if (d < -this.turnDeadzoneRad) {
        this.input.keys.add('ArrowLeft');
        this.input.keys.delete('ArrowRight');
      } else {
        // Close enough: stop turning
        this.input.keys.delete('ArrowLeft');
        this.input.keys.delete('ArrowRight');
      }
    } else {
      // Not enough deflection or no ship angle provider -> no steering
      this.input.keys.delete('ArrowLeft');
      this.input.keys.delete('ArrowRight');
    }
  }

  onStickUp(e) {
    this.onUserGesture?.(e);
    if (e.pointerId !== this.activeStickId) return;
    this.activeStickId = null;

    // Reset nub + clear keys
    this.nub.style.transform = 'translate(0px, 0px)';
    this.input.keys.delete('ArrowLeft');
    this.input.keys.delete('ArrowRight');
    this.input.keys.delete('ArrowUp');

    this.stick.releasePointerCapture?.(e.pointerId);
  }

  /* ------------------------------ Fire -------------------------------- */
  onFireDown(e) {
    this.onUserGesture?.(e);
    // Trigger an immediate shot if not already held
    if (!this.input.keys.has('Space')) {
      this.input.justPressed.add('Space'); // one-frame edge
    }
    this.input.keys.add('Space');          // hold for auto-fire (cooldown gates rate)
    this.fireBtn.setPointerCapture?.(e.pointerId);
  }

  onFireUp(e) {
    this.onUserGesture?.(e);
    this.input.keys.delete('Space');
    this.fireBtn.releasePointerCapture?.(e.pointerId);
  }
}
