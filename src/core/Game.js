/* ========================= src/core/Game.js ========================= */
import { Ship } from '../entities/Ship.js';
import { Ufo } from '../entities/Ufo.js';
import { VirtualControls } from '../ui/VirtualControls.js';
import { Input } from './Input.js';
import { Renderer } from '../systems/Renderer.js';
import { HudRenderer } from '../systems/HudRenderer.js';
import { drawHUD } from '../systems/HUD.js';
import {
  circleHit,
  findShipAsteroidHit,
  forEachBulletAsteroidHit
} from '../systems/Collision.js';
import { integrateAndWrap } from '../systems/Physics.js';
import { spawnWave, maybeSpawnPowerUp } from '../systems/Spawner.js';
import { CONFIG } from '../config.js';
import { AudioManager } from '../audio/AudioManager.js';
import { loadHighScore, saveHighScore } from '../utils/highScoreStorage.js';

export class Game {
  constructor(canvas, ctx, { atlasCache } = {}) {
    this.canvas = canvas;
    this.ctx = ctx;

    this._initRendererAndHud(atlasCache);
    this._initInputAndAudio();
    this._setupAudioUnlockListeners();
    this._setupMuteButtonBounds();
    this._initStateAndShip();
    this._loadHighScoreAsync();
    this._setupVirtualControls();
    this._attachCanvasListeners();

    // --- Game loop timing (fixed-step simulation) ---
    this.lastTime = 0;       // previous frame timestamp (seconds)
    this.accum = 0;          // leftover time accumulation
    this.fixedDt = 1 / 120;  // run physics at 120 FPS for consistency

    this._loop = this.loop.bind(this);
  }

  _initRendererAndHud(atlasCache) {
    this.renderer = new Renderer(this.ctx, atlasCache, {
      canvasWidth: CONFIG.CANVAS.W,
      canvasHeight: CONFIG.CANVAS.H,
      defaultUfoRadius: CONFIG.UFO.RADIUS,
    });
    this.hudRenderer = new HudRenderer(this.renderer);
  }


  _initInputAndAudio() {
    this.input = new Input();
    this.audio = new AudioManager({ volumes: CONFIG.AUDIO });

    this._firstGestureCleanup = [];
    this._tryUnlockAudio = (force = false) => {
      const unlocked = this.audio?.unlock?.(force);
      if (unlocked || this.audio?.ctx?.state === 'running') {
        this._detachFirstGestureListeners();
      }
      return unlocked;
    };

    this._firstGestureHandler = () => {
      if (!this.audio?.isUnlocked) {
        this.requestAudioUnlock();
      } else {
        this._detachFirstGestureListeners();
      }
    };
  }


  _setupAudioUnlockListeners() {
    const registerFirstGestureListener = (target, type) => {
      if (!target?.addEventListener) return;
      target.addEventListener(type, this._firstGestureHandler, true);
      this._firstGestureCleanup.push(() => {
        target.removeEventListener(type, this._firstGestureHandler, true);
      });
    };

    // Global "first gesture" unlockers (desktop + mobile)
    registerFirstGestureListener(window, 'keydown');
    registerFirstGestureListener(document, 'pointerdown');
    registerFirstGestureListener(document, 'touchend');
    registerFirstGestureListener(document, 'touchstart');
    registerFirstGestureListener(document, 'click');
  }


  _setupMuteButtonBounds() {
    const muteButtonWidth = 68;
    const muteButtonHeight = 48;
    const muteButtonPadding = 16;
    this.muteButtonBounds = {
      x: CONFIG.CANVAS.W - muteButtonPadding - muteButtonWidth,
      y: muteButtonPadding,
      width: muteButtonWidth,
      height: muteButtonHeight
    };
  }


  _initStateAndShip() {
    this.highScore = 0;
    this._lastPersistedHighScore = 0;
    this.state = this.createInitialState();
    this.renderer.setShipSpriteForShieldLevel(this.state.ship.shieldLevel);
  }


  _loadHighScoreAsync() {
    loadHighScore()
      .then((storedScore) => {
        if (typeof storedScore === 'number' && storedScore >= 0) {
          this.highScore = storedScore;
          this._lastPersistedHighScore = storedScore;
          this.state.highScore = storedScore;
        }
      })
      .catch((err) => {
        console.warn('Failed to load high score:', err);
      });
  }


  _setupVirtualControls() {
    const smallScreen = window.matchMedia('(max-width: 1024px)');

    const ensureControls = (enabled) => {
      if (enabled && !this.virtualControls) {
        this.virtualControls = new VirtualControls(this.canvas, this.input, {
          getShipAngle: () => this.state.ship.angle,
          onUserGesture: () => {
            this.requestAudioUnlock();
          }
        });
      } else if (!enabled && this.virtualControls) {
        this.virtualControls.destroy();
        this.virtualControls = null;
      }
    };

    ensureControls(smallScreen.matches);

    smallScreen.addEventListener?.('change', (e) => {
      ensureControls(e.matches);
    });
  }


  _attachCanvasListeners() {
    this.canvas.style.touchAction = 'none';

    this._onPointerDown = (event) => {
      if (event.isPrimary === false) return;

      // IMPORTANT: non-passive listener + direct call in the gesture
      this.requestAudioUnlock();

      const point = this.translatePointerToCanvas(event);
      if (point && this.isPointInMuteButton(point)) {
        this.toggleAudio();
      }
    };

    //this.canvas.addEventListener('pointerdown', this._onPointerDown, { passive: true });
    this.canvas.addEventListener('pointerdown', this._onPointerDown);
  }


  requestAudioUnlock(force = false) {
    return this._tryUnlockAudio?.(force);
  }


  _detachFirstGestureListeners() {
    if (!this._firstGestureCleanup || this._firstGestureCleanup.length === 0) {
      this._firstGestureCleanup = [];
      return;
    }
    while (this._firstGestureCleanup.length) {
      const off = this._firstGestureCleanup.pop();
      try {
        off?.();
      } catch (err) {
        console.warn('Failed to detach first gesture listener', err);
      }
    }
    this._firstGestureCleanup = [];
  }


  // Build a fresh state object (used at boot + reset)
  createInitialState() {
    // Ship accepts an options bag; here we disable respawn blink initially.
    const ship = new Ship(CONFIG.CANVAS.W / 2, CONFIG.CANVAS.H / 2, { invulnBlink: false });
    ship.resetSpeedLevel?.(); // optional helper: reset any speed power-up state

    return {
      mode: 'MENU',              // MENU | PLAY | GAME_OVER
      wave: 0,
      score: 0,
      lives: CONFIG.SHIP.LIVES,
      highScore: this.highScore ?? 0,
      didBeatHighScore: false,

      ship,                      // player entity
      bullets: [],               // active projectiles
      asteroids: [],             // active asteroids
      powerups: [],              // active power-ups
      powerupsCollected: 0,      // stat/telemetry (not required for gameplay)

      ufo: null,
      ufoBullets: [],
      ufoSpawnTimer: null,
      ufoSpawnedThisWave: false
    };
  }

  getUfoSpawnDelayForWave(wave) {
    const timer = CONFIG.UFO?.SPAWN_TIMER;
    if (!timer) return null;
    const start = timer.START ?? 0;
    const decrement = timer.DECREMENT_PER_WAVE ?? 0;
    const min = timer.MIN ?? 0;
    const delay = start - wave * decrement;
    return Math.max(min, delay);
  }

  resetUfoStateForWave() {
    const S = this.state;
    S.ufo = null;
    S.ufoBullets = [];
    S.ufoSpawnedThisWave = false;
    const delay = this.getUfoSpawnDelayForWave(S.wave);
    S.ufoSpawnTimer = typeof delay === 'number' ? delay : null;
  }

  spawnUfoForCurrentWave() {
    const S = this.state;
    const sprites = CONFIG.UFO?.SPRITES ?? [];
    const spriteKey = sprites.length
      ? sprites[Math.floor(Math.random() * sprites.length)]
      : null;

    const margin = CONFIG.UFO?.OFFSCREEN_MARGIN ?? 0;
    const speed = CONFIG.UFO?.SPEED ?? 0;
    const { W, H } = CONFIG.CANVAS;

    const horizontal = Math.random() < 0.5;
    let x = 0;
    let y = 0;
    let vx = 0;
    let vy = 0;

    if (horizontal) {
      y = Math.random() * H;
      const fromLeft = Math.random() < 0.5;
      x = fromLeft ? -margin : W + margin;
      vx = fromLeft ? speed : -speed;
    } else {
      x = Math.random() * W;
      const fromTop = Math.random() < 0.5;
      y = fromTop ? -margin : H + margin;
      vy = fromTop ? speed : -speed;
    }

    S.ufo = new Ufo({ x, y, vx, vy, spriteKey });
    S.ufoSpawnedThisWave = true;
    S.ufoSpawnTimer = null;
  }

  /**
   * Enter the animation loop. We don't spawn a wave here; the user starts from MENU.
   */
  start() {
    requestAnimationFrame(this._loop);
  }

  /**
   * MENU → PLAY transition: reset run state, spawn first wave, start music.
   */
  startGame() {
    if (this.state.mode !== 'MENU') return;

    // Reset run progress
    this.state.mode = 'PLAY';
    this.state.wave = 0;
    this.state.score = 0;
    this.state.lives = CONFIG.SHIP.LIVES;
    this.state.highScore = this.highScore;
    this.state.didBeatHighScore = false;

    // New ship centered, with clean speed state
    this.state.ship = new Ship(CONFIG.CANVAS.W / 2, CONFIG.CANVAS.H / 2, { invulnBlink: false });
    this.state.ship.resetSpeedLevel?.();

    // Clear any previous entities
    this.state.bullets.length = 0;
    this.state.asteroids.length = 0;

    // Match ship sprite to shield level (e.g., color/overlay)
    this.renderer.setShipSpriteForShieldLevel(this.state.ship.shieldLevel);

    // First wave + optional power-up + music
    spawnWave(this.state);
    maybeSpawnPowerUp(this.state);
    this.resetUfoStateForWave();
    this.audio.startMusic?.();

    this.canvas?.dispatchEvent?.(new CustomEvent('game-started'));
  }

  /**
   * Frame callback -> accumulate time, run fixed updates, then render.
   */
  loop(t) {
    const time = t * 0.001;                         // ms → s
    const dt = Math.min(0.1, time - (this.lastTime || time)); // clamp to avoid spiral if tab slept
    this.lastTime = time;

    // Fixed-step simulation: run update() in consistent slices (fixedDt)
    this.accum += dt;
    while (this.accum >= this.fixedDt) {
      this.update(this.fixedDt);
      this.accum -= this.fixedDt;
      this.input.postUpdate(); // clear pressed/released edges after each fixed tick
    }

    // Draw the current state snapshot
    this.render();

    // Schedule next frame
    requestAnimationFrame(this._loop);
  }

  /**
   * Advance game state by dt (fixed time slice).
   * Handles per-mode logic (MENU/PLAY/GAME_OVER), input, AI, collisions, and progression.
   */
  update(dt) {
    const S = this.state;

    // --- MENU: wait for explicit user start (keyboard or pointer) ---
    if (S.mode === 'MENU') {
      if (this.input.pressed('Enter') || this.input.pressed('Space')) {
        this.startGame();
      }
      return; // do not run world updates behind the menu
    }

    // --- GAME_OVER: allow restart (Enter) ---
    if (S.mode === 'GAME_OVER') {
      if (this.input.pressed('Enter')) this.reset(); // immediate new run
      return;
    }

    // --- PLAY: core real-time simulation below ---

    const damageShip = ({ onShieldAbsorb, scoreBonus = 0 } = {}) => {
      this.audio.playPlayerHit?.();

      if (S.ship.shieldLevel > 0) {
        onShieldAbsorb?.();
        if (scoreBonus) {
          S.score += scoreBonus;
          this.updateHighScore(S.score);
        }

        if (S.ship.decreaseShieldLevel()) {
          this.renderer.setShipSpriteForShieldLevel(S.ship.shieldLevel);
        }

        const shieldInvuln = CONFIG.SHIP.SHIELD_HIT_INVULN ?? 0;
        S.ship.invuln = shieldInvuln;
        S.ship.resetInvulnBlink?.();
        return true;
      }

      S.lives -= 1;
      if (S.lives <= 0) {
        S.mode = 'GAME_OVER';
        this.audio.stopMusic?.();
        this.updateHighScore(S.score);
        this.canvas?.dispatchEvent?.(
          new CustomEvent('game-over', {
            detail: {
              score: S.score,
              wave: S.wave,
              highScore: this.highScore,
              newHighScore: !!S.didBeatHighScore
            }
          })
        );
        return false;
      }

      S.ship = new Ship(CONFIG.CANVAS.W / 2, CONFIG.CANVAS.H / 2);
      S.ship.resetSpeedLevel?.();
      this.renderer.setShipSpriteForShieldLevel(S.ship.shieldLevel);
      return true;
    };

    // Ship controls + movement (reads Input internally)
    S.ship.update(dt, this.input);

    // Shooting: if fire is held or tapped and cooldown permits, create bullets via Ship.fire()
    if ((this.input.isDown('Space') || this.input.pressed('KeyJ')) && S.ship.canFire()) {
      const bullets = S.ship.fire();   // may return 1 or multiple (e.g., triple-shot)
      S.bullets.push(...bullets);
      this.audio.playShoot?.();
    }

    // Integrate entity-local updates (movement, spin, timers)
    for (const b of S.bullets)  b.update(dt);
    for (const a of S.asteroids) a.update(dt);
    for (const pu of S.powerups) pu.update(dt);

    // UFO timer + behavior
    if (!S.ufo && !S.ufoSpawnedThisWave && typeof S.ufoSpawnTimer === 'number') {
      S.ufoSpawnTimer = Math.max(0, S.ufoSpawnTimer - dt);
      if (S.ufoSpawnTimer <= 0) {
        this.spawnUfoForCurrentWave();
      }
    }

    if (S.ufo) {
      const lasers = S.ufo.update(dt, S.ship);
      if (lasers && lasers.length) {
        S.ufoBullets.push(...lasers);
        this.audio.playUfoLaser?.();
      }
      if (S.ufo?.dead) {
        S.ufo = null;
      }
    }

    // UFO lasers do not wrap across the screen; they self-destroy when off-screen or timed out.
    for (const laser of S.ufoBullets) {
      laser.update(dt);
    }

    // Wrap all entities across screen edges (toroidal space)
    integrateAndWrap(S.ship);
    for (const b of S.bullets)  integrateAndWrap(b);
    for (const a of S.asteroids) integrateAndWrap(a);
    for (const pu of S.powerups) integrateAndWrap(pu);

    this._handleBulletCollisions();
    if (S.mode === 'GAME_OVER') return;

    if (S.ship.invuln <= 0) {
      const shipSurvived = this._handleShipHazardCollisions(damageShip);
      if (!shipSurvived || S.mode === 'GAME_OVER') {
        return;
      }
    }

    this._handlePowerupCollisions();
    this.updateHighScore(S.score);

    // --- Cleanup: remove dead entities from arrays (cheap compaction) ---
    S.bullets    = S.bullets.filter(b => !b.dead);
    S.asteroids  = S.asteroids.filter(a => !a.dead);
    S.powerups   = S.powerups.filter(p => !p.dead);
    S.ufoBullets = S.ufoBullets.filter(l => !l.dead);

    // --- Progression: next wave once all asteroids are cleared ---
    if (S.asteroids.length === 0 && S.mode === 'PLAY') {
      S.wave += 1;
      spawnWave(S);
      maybeSpawnPowerUp(this.state);
      this.resetUfoStateForWave();
    }
  }


  _handleBulletCollisions() {
    const S = this.state;

    forEachBulletAsteroidHit(S.bullets, S.asteroids, (b, a) => {
      b.dead = true;
      a.dead = true;

      const idx = a.sizeIndex;
      if (idx === 2) S.score += CONFIG.SCORE.SMALL;
      else if (idx === 1) S.score += CONFIG.SCORE.MED;
      else                S.score += CONFIG.SCORE.LARGE;
      this.updateHighScore(S.score);

      S.asteroids.push(...a.split());
      this.audio.playAsteroidHit?.();
    });

    for (const b of S.bullets) {
      if (b.dead) continue;

      if (S.ufo && !S.ufo.dead && circleHit(b, S.ufo)) {
        b.dead = true;
        const destroyed = S.ufo.takeHit();
        if (destroyed) {
          S.score += CONFIG.UFO?.SCORE_VALUE ?? 0;
          this.updateHighScore(S.score);
          S.ufo = null;
        }
      }
    }
  }


  _handleShipHazardCollisions(damageShip) {
    const S = this.state;

    const hitAsteroid = findShipAsteroidHit(S.ship, S.asteroids);
    if (hitAsteroid) {
      const idx = hitAsteroid.sizeIndex;
      const scoreBonus = idx === 2
        ? CONFIG.SCORE.SMALL
        : idx === 1
          ? CONFIG.SCORE.MED
          : CONFIG.SCORE.LARGE;

      const survived = damageShip({
        scoreBonus,
        onShieldAbsorb: () => {
          hitAsteroid.dead = true;
          this.audio.playAsteroidHit?.();
        }
      });

      if (!survived || S.mode === 'GAME_OVER') {
        return false;
      }
    }

    if (S.mode === 'GAME_OVER') {
      return false;
    }

    if (S.ship.invuln <= 0) {
      if (S.ufo && !S.ufo.dead && circleHit(S.ship, S.ufo)) {
        const survived = damageShip();
        if (!survived || S.mode === 'GAME_OVER') {
          return false;
        }
      }

      if (S.ship.invuln <= 0) {
        for (const laser of S.ufoBullets) {
          if (laser.dead) continue;
          if (!circleHit(S.ship, laser)) continue;

          if (S.ship.invuln > 0) {
            continue;
          }

          laser.dead = true;
          const survived = damageShip();
          if (!survived || S.mode === 'GAME_OVER') {
            return false;
          }
          break;
        }
      }
    }

    return true;
  }


  _handlePowerupCollisions() {
    const S = this.state;

    for (const pu of S.powerups) {
      if (!pu.dead && circleHit(S.ship, pu)) {
        pu.dead = true;
        S.powerupsCollected += 1; // telemetry/stat only

        this.audio.playPowerup?.();

        if (pu.type === 'tripleShot') {
          const weaponModes = CONFIG.WEAPON;
          if (S.ship.weaponMode === weaponModes.MODE_FIVE) {
            const bonus = CONFIG.POWERUP?.types?.tripleShot?.duplicateScore ?? 0;
            S.score += bonus;
            this.updateHighScore(S.score);
          } else if (S.ship.weaponMode === weaponModes.MODE_TRIPLE) {
            S.ship.weaponMode = weaponModes.MODE_FIVE;
          } else {
            S.ship.weaponMode = weaponModes.MODE_TRIPLE;
          }

        } else if (pu.type === 'extraLife') {
          const maxLives = CONFIG.SHIP.MAX_LIVES ?? Infinity;
          if (S.lives < maxLives) {
            S.lives = Math.min(maxLives, S.lives + 1);
          } else {
            const bonus = CONFIG.POWERUP?.types?.extraLife?.duplicateScore ?? 0;
            S.score += bonus;
            this.updateHighScore(S.score);
          }

        } else if (pu.type === 'shield') {
          const maxShield = CONFIG.SHIP.SHIELD_MAX_LEVEL ?? 2;
          if (S.ship.shieldLevel < maxShield && S.ship.increaseShieldLevel()) {
            this.renderer.setShipSpriteForShieldLevel(S.ship.shieldLevel);
          } else {
            const bonus = CONFIG.POWERUP?.types?.shield?.duplicateScore ?? 0;
            S.score += bonus;
            this.updateHighScore(S.score);
          }

        } else if (pu.type === 'speed') {
          if (!S.ship.increaseSpeedLevel()) {
            const bonus = CONFIG.POWERUP?.types?.speed?.duplicateScore ?? 0;
            S.score += bonus;
            this.updateHighScore(S.score);
          }
        }
      }
    }
  }

  /**
   * Draw current frame. Early-out for MENU to avoid drawing the playfield underneath.
   */
  render() {
    const R = this.renderer; const S = this.state;
    R.clear();

    if (S.mode === 'MENU') {
      return;
    }

    // World
    for (const a of S.asteroids) R.asteroid(a);
    for (const pu of S.powerups) R.powerUp(pu);
    if (S.ufo) R.ufo(S.ufo);
    for (const laser of S.ufoBullets) R.ufoLaser(laser);
    for (const b of S.bullets) R.bullet(b);
    R.ship(S.ship);

    const audioEnabled = typeof this.audio?.isEnabled === 'function'
      ? this.audio.isEnabled()
      : !!this.audio?.enabled;

    const muteButton = this.muteButtonBounds
      ? {
          x: this.muteButtonBounds.x,
          y: this.muteButtonBounds.y,
          width: this.muteButtonBounds.width,
          height: this.muteButtonBounds.height,
          muted: !audioEnabled
        }
      : undefined;

    // HUD (score/lives/wave; shows GAME OVER overlay when appropriate)
    let ufoLabel = null;
    if (S.mode === 'PLAY') {
      if (S.ufo) {
        ufoLabel = 'UFO: ACTIVE';
      } else if (!S.ufoSpawnedThisWave && typeof S.ufoSpawnTimer === 'number') {
        ufoLabel = `UFO: ${Math.max(0, S.ufoSpawnTimer).toFixed(1)}s`;
      } else if (S.ufoSpawnedThisWave) {
        ufoLabel = 'UFO: CLEARED';
      }
    }

    drawHUD(R, this.hudRenderer, S, {
      audioEnabled,
      muteButton,
      ufoLabel
    });
  }

  updateHighScore(score) {
    if (typeof score !== 'number') return;
    if (score <= this.highScore) {
      return;
    }

    this.highScore = score;
    this.state.highScore = score;
    this.state.didBeatHighScore = true;

    if (score > this._lastPersistedHighScore) {
      this._lastPersistedHighScore = score;
      saveHighScore(score).catch((err) => {
        console.warn('Failed to save high score:', err);
      });
    }
  }

  translatePointerToCanvas(event) {
    const rect = this.canvas?.getBoundingClientRect?.();
    if (!rect || rect.width === 0 || rect.height === 0) return null;

    const scaleX = CONFIG.CANVAS.W / rect.width;
    const scaleY = CONFIG.CANVAS.H / rect.height;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  }

  isPointInMuteButton(point) {
    if (!point || !this.muteButtonBounds) return false;
    const { x, y, width, height } = this.muteButtonBounds;
    return (
      point.x >= x &&
      point.x <= x + width &&
      point.y >= y &&
      point.y <= y + height
    );
  }

  toggleAudio(forceEnabled) {
    if (!this.audio) return;

    // Decide target state before changing anything
    const currentlyEnabled = (typeof this.audio.isEnabled === 'function')
      ? this.audio.isEnabled()
      : !!this.audio.enabled;

    const willEnable = (typeof forceEnabled === 'boolean')
      ? forceEnabled
      : !currentlyEnabled;

    // *** iOS: unlock in the SAME gesture that unmutes ***
    if (willEnable) {
      this.requestAudioUnlock(true);
    }

    // Proceed with your existing enable/disable logic
    let enabled;
    if (typeof forceEnabled === 'boolean' && typeof this.audio.setEnabled === 'function') {
      this.audio.setEnabled(forceEnabled);
      enabled = forceEnabled;
    } else if (typeof this.audio.toggleEnabled === 'function') {
      enabled = this.audio.toggleEnabled();
    } else if (typeof forceEnabled === 'boolean') {
      this.audio.enabled = forceEnabled;
      enabled = forceEnabled;
    } else {
      this.audio.enabled = !this.audio.enabled;
      enabled = this.audio.enabled;
    }

    if (enabled) {
      if (this.state.mode === 'PLAY') this.audio.startMusic?.();
    } else {
      this.audio.stopMusic?.();
    }
  }


  /**
   * Reset into a fresh PLAY session (classic arcade flow).
   * If you want to return to MENU instead, call returnToMenu().
   */
  reset() {
    this.state = this.createInitialState();
    this.renderer.setShipSpriteForShieldLevel(this.state.ship.shieldLevel);

    // Jump straight back into gameplay
    this.state.mode = 'PLAY';
    spawnWave(this.state);
    maybeSpawnPowerUp(this.state);
    this.resetUfoStateForWave();
    this.audio.startMusic?.();

    this.canvas?.dispatchEvent?.(new CustomEvent('game-started'));
  }

  /**
   * Return to the start menu state without immediately launching gameplay.
   */
  returnToMenu() {
    this.state = this.createInitialState();
    this.renderer.setShipSpriteForShieldLevel(this.state.ship.shieldLevel);
    this.audio.stopMusic?.();
    this.canvas?.dispatchEvent?.(new CustomEvent('game-returned-to-menu'));
  }

  /**
   * Cleanup for teardown (remove listeners added by Game).
   */
  destroy() {
    this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    if (this.virtualControls) this.virtualControls.destroy();
  }
}
