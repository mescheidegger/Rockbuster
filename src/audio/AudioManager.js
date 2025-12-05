/**
 * Lightweight Web Audio manager used throughout the game.
 *
 * The project used to rely on Howler.js but now talks to the Web Audio API
 * directly.  This helper keeps the public surface small (`playShoot`,
 * `startMusic`, `setEnabled`, etc.) while handling all of the platform quirks
 * like iOS' "unlock" requirement and Safari's callback-based
 * `decodeAudioData` implementation.
 */
const ACtx = window.AudioContext || window.webkitAudioContext;

const DEFAULT_SFX_VOLUMES = {
  shoot: 1.0,
  shieldUp: 1.0,
  shieldDown: 1.0,
  asteroidHit: 0.5,
  ufoLaser: 1.0,
};

/**
 * Safely read a volume value from a config object, supporting multiple key
 * variants (camelCase, SCREAMING_SNAKE_CASE, etc.).
 *
 * @param {Record<string, unknown>|undefined} source
 * @param {string[]} keys
 * @param {number} fallback
 * @returns {number}
 */
function readVolume(source, keys, fallback) {
  if (!source) return fallback;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.max(0, value);
    }
  }
  return fallback;
}

/**
 * Handles all SFX + music playback.
 */
export class AudioManager {
  /**
   * @param {{ musicUrl?: string }} [opts]
   */
  constructor(opts = {}) {
    /** @type {boolean} Whether sound output is currently enabled. */
    this.enabled = true;
    /** @type {boolean} True once the AudioContext has been unlocked by a gesture. */
    this.isUnlocked = false;

    const volumeConfig = opts.volumes ?? {};
    const sfxConfig = volumeConfig.sfx ?? volumeConfig.SFX ?? {};

    /** @type {number} */
    this.masterVolume = readVolume(volumeConfig, ['master', 'MASTER'], 1.0);
    /** @type {number} */
    this.musicVolume = readVolume(volumeConfig, ['music', 'MUSIC'], 1.0);
    /** @type {{[key: string]: number}} */
    this.sfxVolume = {
      shoot: readVolume(sfxConfig, ['shoot', 'SHOOT'], DEFAULT_SFX_VOLUMES.shoot),
      shieldUp: readVolume(sfxConfig, ['shieldUp', 'SHIELD_UP', 'powerup', 'POWERUP'], DEFAULT_SFX_VOLUMES.shieldUp),
      shieldDown: readVolume(sfxConfig, ['shieldDown', 'SHIELD_DOWN', 'playerHit', 'PLAYER_HIT'], DEFAULT_SFX_VOLUMES.shieldDown),
      asteroidHit: readVolume(sfxConfig, ['asteroidHit', 'ASTEROID_HIT'], DEFAULT_SFX_VOLUMES.asteroidHit),
      ufoLaser: readVolume(sfxConfig, ['ufoLaser', 'UFO_LASER', 'ufo', 'UFO'], DEFAULT_SFX_VOLUMES.ufoLaser),
    };

    /**
     * Per-SFX throttling: last play time + minimum spacing (in seconds).
     * This prevents spammy sounds from firing every single frame.
     */
    this._sfxLastPlayTime = {}; // { [key: string]: number }
    this._sfxMinInterval = {
      // Tune these values to taste:
      shoot: 0.03,        // 30ms between shots
      asteroidHit: 0.2,  // 200ms between explosion sounds
      shieldUp: 0,
      shieldDown: 0,
      ufoLaser: 0.03,
    };

    /** @type {AudioContext|null} */
    this.ctx = null;
    /** @type {GainNode|null} */
    this.masterGain = null;

    /**
     * Cached audio buffers (per-SFX). Extend this map with more keys if new
     * sounds are added.
     * @type {{ [key: string]: AudioBuffer|null }}
     */
    this.buffers = {
      shoot: null,
      shieldUp: null,
      shieldDown: null,
      asteroidHit: null,
      ufoLaser: null,
    };

    /**
     * Track any in-flight buffer loads so we do not duplicate fetch/decode work
     * when multiple play requests arrive before the first finishes.
     * @type {{ [key: string]: Promise<void> | undefined }}
     */
    this._loadingSfx = {};

    /** Optional background music configuration. */
    this.musicUrl = opts.musicUrl ?? null;
    /** @type {AudioBuffer|null} */
    this.musicBuffer = null;
    /** @type {AudioBufferSourceNode|null} */
    this.musicSource = null;
    /** @type {GainNode|null} */
    this.musicGain = null;
    /** @type {Promise<void>|null} */
    this._loadingMusic = null;

    /**
     * Work scheduled while the context is still locked.  Functions stored in
     * here will run the moment `unlock()` succeeds.
     * @type {Array<() => void>}
     */
    this._afterUnlock = [];

    // Audio assets
    this.urls = {
      shoot: 'assets/audio/laserSmall_001.mp3', // mp3 works on iOS; ogg won't
      shieldUp: 'assets/audio/sfx_shieldUp.mp3',
      shieldDown: 'assets/audio/sfx_shieldDown.mp3',
      asteroidHit: 'assets/audio/explosionCrunch_000.mp3',
      ufoLaser: 'assets/audio/laserRetro_001.mp3',
    };
  }

  /**
   * Create & play a silent one-shot to force iOS to fully "open" the graph.
   * Without this the context frequently remains suspended after a gesture.
   *
   * @private
   */
  _silentClick() {
    if (!this.ctx || !this.masterGain) return;
    const buf = this.ctx.createBuffer(1, 1, this.ctx.sampleRate); // 1 frame of silence
    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const g = this.ctx.createGain();
    g.gain.value = 0; // zero gain → inaudible but still "plays"

    src.connect(g);
    g.connect(this.masterGain);

    try { src.start(); } catch {}
    src.onended = () => { try { src.disconnect(); g.disconnect(); } catch {} };
  }

  /**
   * Promise-loading for SFX (idempotent).
   *
   * @private
   * @param {string} key
   * @returns {Promise<void>|undefined}
   */
  _ensureBufferLoaded(key) {
    if (this.buffers[key]) return Promise.resolve();
    if (!this.ctx) return undefined;
    if (this._loadingSfx[key]) return this._loadingSfx[key];

    const url = this.urls[key];
    if (!url) return Promise.resolve();

    const pending = this._loadBuffer(url)
      .then(buf => {
        this.buffers[key] = buf;
      })
      .catch(() => {})
      .finally(() => {
        delete this._loadingSfx[key];
      });

    this._loadingSfx[key] = pending;
    return pending;
  }

  /* --------------------------- Core: Unlock --------------------------- */
  /**
   * Complete the unlock sequence once the AudioContext reports `running`.
   *
   * @private
   * @returns {boolean}
   */
  _finalizeUnlockIfReady() {
    if (!this.ctx || this.ctx.state !== 'running') {
      return false;
    }
    if (this.isUnlocked) {
      return true;
    }

    this.isUnlocked = true;

    // Kick asset loads (don’t await here)
    for (const key of Object.keys(this.urls)) {
      this._ensureBufferLoaded(key);
    }
    if (this.musicUrl) {
      this._ensureMusicLoaded();
    }

    // Flush any queued work (e.g., startMusic requested pre-unlock).
    const tasks = this._afterUnlock.splice(0);
    for (const fn of tasks) {
      try {
        fn();
      } catch (err) {
        console.warn('AudioManager: queued task failed', err);
      }
    }

    return true;
  }

  /**
   * iOS/Safari require that an AudioContext is created in direct response to a
   * user gesture (tap/click).  `unlock()` should be called from those gesture
   * handlers.  When `force` is true the previous context is destroyed before a
   * new one is spun up.
   *
   * @param {boolean} [force=false]
   * @returns {boolean} True if the context is unlocked and ready.
   */
  unlock(force = false) {
    if (!ACtx) return false;

    if (force && this.ctx) {
      this.destroy();
    }

    if (this.isUnlocked && this.ctx && this.ctx.state === 'running') {
      return true;
    }

    try {
      if (!this.ctx) {
        // Create in the gesture callstack
        this.ctx = new ACtx();

        // Build graph
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.enabled ? this.masterVolume : 0;
        this.masterGain.connect(this.ctx.destination);

        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = this.musicVolume;
        this.musicGain.connect(this.masterGain);
      }

      // Try to run immediately (gesture)
      let resumeResult;
      try {
        resumeResult = this.ctx.resume?.();
      } catch {}

      // **Critical for iOS:** start an inaudible, synchronous one-shot
      this._silentClick();

      const unlocked = this._finalizeUnlockIfReady();
      if (unlocked) {
        return true;
      }

      if (resumeResult && typeof resumeResult.then === 'function') {
        resumeResult
          .then(() => {
            this._silentClick();
            this._finalizeUnlockIfReady();
          })
          .catch(() => {});
      }

      return this.isUnlocked && this.ctx?.state === 'running';
    } catch (err) {
      this.isUnlocked = false;
      this.ctx = null;
      this.masterGain = null;
      console.warn('AudioManager: failed to unlock context', err);
      return false;
    }
  }


  /* --------------------------- Public API ---------------------------- */
  /**
   * Enable or disable all audio output.
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this.enabled = !!enabled;
    if (this.masterGain) {
      this.masterGain.gain.value = this.enabled ? this.masterVolume : 0;
    }
  }
  /**
   * Convenience helper used by UI toggles.
   * @returns {boolean} The new enabled state.
   */
  toggleEnabled() {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }
  /**
   * @returns {boolean} Whether audio is enabled.
   */
  isEnabled() { return !!this.enabled; }

  /**
   * Play the laser "shoot" sound effect.  The buffer is lazy-loaded on first
   * request and replayed once decoding completes.
   */
  playShoot() {
    this._playSfx('shoot');
  }

  /**
   * Play the "power-up collected" sound effect.
   */
  playPowerup() {
    this._playSfx('shieldUp');
  }

  /**
   * Play the "player hit / shield down" sound effect.
   */
  playPlayerHit() {
    this._playSfx('shieldDown');
  }

  /** Play the asteroid hit/explosion sound effect. */
  playAsteroidHit() {
    this._playSfx('asteroidHit');
  }

  /** Play the UFO laser firing sound effect. */
  playUfoLaser() {
    this._playSfx('ufoLaser');
  }


  /**
   * Begin looping background music (if a `musicUrl` was supplied).
   * Safe to call repeatedly; it will restart the loop when invoked.
   */
  startMusic() {
    if (!this.musicUrl) return; // no-op if you don’t provide a track
    if (!this.enabled) return;
    if (!this.isUnlocked || !this.ctx) {
      this.unlock();
      this._afterUnlock.push(() => this.startMusic());
      this._ensureMusicLoaded();
      return;
    }
    if (!this.musicBuffer) {
      const pending = this._ensureMusicLoaded();
      pending?.then(() => {
        if (this.enabled && this.ctx && this.isUnlocked) {
          this.startMusic();
        }
      });
      return;
    }
    if (!this.musicGain) return;
    this.musicGain.gain.value = this.musicVolume;
    // Stop any existing loop
    this.stopMusic();

    const src = this.ctx.createBufferSource();
    src.buffer = this.musicBuffer;
    src.loop = true;
    src.connect(this.musicGain);
    src.start();
    this.musicSource = src;
  }

  /** Stop currently playing background music (if any). */
  stopMusic() {
    try { this.musicSource?.stop?.(); } catch {}
    this.musicSource = null;
  }

  /**
   * Tear down the AudioContext.  Useful when navigating away from the game.
   */
  destroy() {
    this.stopMusic();
    try { this.ctx?.close?.(); } catch {}
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.musicBuffer = null;
    this.musicSource = null;
    for (const key of Object.keys(this.buffers)) {
      this.buffers[key] = null;
    }
    this._loadingSfx = {};
    this._loadingMusic = null;
    this.isUnlocked = false;
    this._afterUnlock.length = 0;
  }

  /**
   * Shared implementation used by the public SFX helpers.
   *
   * @private
   * @param {string} key
   * @param {number} gain
   */
  _playSfx(key, gain = 1.0) {
    if (!this.enabled) return;

    try { this.ctx?.resume?.(); } catch {}

    if (!this.isUnlocked || !this.ctx) {
      this.unlock();
    }

    const volume = this.sfxVolume[key] ?? 1.0;
    const finalGain = gain * volume;
    if (finalGain <= 0) {
      return;
    }

    // Core throttling logic lives here so it works for both already-loaded
    // and async-loaded buffers.
    const tryPlay = (buffer) => {
      if (!buffer || !this.ctx || !this.masterGain) return;

      const ctxTime = this.ctx.currentTime || 0;
      const now = ctxTime || performance.now() / 1000;
      const minInterval = this._sfxMinInterval[key] ?? 0;
      const last = this._sfxLastPlayTime[key] ?? 0;

      if (minInterval > 0 && (now - last) < minInterval) {
        // Too soon since last play → drop this request.
        return;
      }

      this._sfxLastPlayTime[key] = now;
      this._playBuffer(buffer, finalGain);
    };

    const buffer = this.buffers[key];
    if (!buffer) {
      const pending = this._ensureBufferLoaded(key);
      pending?.then(() => {
        if (this.enabled && this.ctx && this.buffers[key]) {
          try { this.ctx.resume?.(); } catch {}
          tryPlay(this.buffers[key]);
        }
      });
      return;
    }

    tryPlay(buffer);
  }

  /* --------------------------- Internals ----------------------------- */
  /**
   * Ensure the music track is loaded.  The returned promise resolves when the
   * buffer is ready (or rejects silently on failure).
   *
   * @private
   * @returns {Promise<void>|undefined}
   */
  _ensureMusicLoaded() {
    if (!this.musicUrl || this.musicBuffer || !this.ctx) return;
    if (this._loadingMusic) return this._loadingMusic;
    this._loadingMusic = this._loadBuffer(this.musicUrl)
      .then(buf => {
        this.musicBuffer = buf;
      })
      .catch(() => {})
      .finally(() => {
        this._loadingMusic = null;
      });
    return this._loadingMusic;
  }

  /**
   * Fetch and decode an audio buffer using the active AudioContext.
   *
   * @private
   * @param {string} url
   * @returns {Promise<AudioBuffer>}
   */
  async _loadBuffer(url) {
    if (!this.ctx) throw new Error('AudioManager: cannot load buffer without an AudioContext');
    // Important on iOS/Safari: decode with the same AudioContext created in a gesture
    const res = await fetch(url, { cache: 'force-cache' });
    const data = await res.arrayBuffer();
    // decodeAudioData: use promise form when available
    if (this.ctx.decodeAudioData.length === 1) {
      // Newer promise signature
      return this.ctx.decodeAudioData(data);
    }
    // Older callback signature (Safari)
    return new Promise((resolve, reject) => {
      this.ctx.decodeAudioData(data, resolve, reject);
    });
  }

  /**
   * Wire up a BufferSource → Gain → master gain and start playback.
   *
   * @private
   * @param {AudioBuffer} buffer
   * @param {number} [gainValue=1]
   * @param {number} [when=0]
   */
  _playBuffer(buffer, gainValue = 1.0, when = 0) {
    if (!this.ctx || !this.masterGain) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = gainValue;

    src.connect(gain);
    gain.connect(this.masterGain);

    // Start immediately (or at `when` relative to currentTime)
    src.start(this.ctx.currentTime + when);
    // Let GC collect after it finishes
    src.onended = () => {
      try { src.disconnect(); gain.disconnect(); } catch {}
    };
  }
}
