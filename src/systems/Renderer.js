/* ========================= src/systems/Renderer.js ========================= */
/**
 * Renderer
 * -------
 * Responsible for ALL canvas drawing:
 *  - Consumes frames from an AtlasCache (injected) so it remains asset-agnostic
 *  - Knows how to draw each entity type at its world position with rotation/scale
 *  - Provides simple text drawing for HUD
 *
 * Coordinate expectations:
 *  - World units are pixels in a 2D plane matching the provided canvas size
 *  - 0 radians points to the +X axis ("right"); positive rotation is CCW
 *  - Kenney sprites typically face "up" (+Y), so we rotate by +90° when needed
 */

/**
 * @typedef {Object} ShipDrawable
 * @property {number} x
 * @property {number} y
 * @property {number} angle - radians; 0 = +X
 * @property {number} [shieldLevel]
 * @property {number} [invuln]
 * @property {boolean} [isInvulnVisible]
 */

/**
 * @typedef {Object} BulletDrawable
 * @property {number} x
 * @property {number} y
 * @property {number} vx
 * @property {number} vy
 * @property {number} [angle] - if present, used directly; otherwise inferred from (vx, vy)
 */

/**
 * @typedef {Object} AsteroidDrawable
 * @property {number} x
 * @property {number} y
 * @property {number} r
 * @property {number} angle
 * @property {string} colorVariant
 * @property {number} sizeIndex
 */

/**
 * @typedef {Object} UfoDrawable
 * @property {number} x
 * @property {number} y
 * @property {number} [r]
 * @property {string} [spriteKey]
 */

/**
 * @typedef {Object} PowerUpDrawable
 * @property {number} x
 * @property {number} y
 * @property {number} r
 * @property {number} angle
 * @property {string} type
 */

export class Renderer {
  constructor(
    ctx,
    atlasCache,
    {
      shipSpriteKeys,
      ufoSpriteKeys,
      playerLaserKey,
      ufoLaserKey,
      powerupKeys,
      asteroidSetKeys,
      canvasWidth,
      canvasHeight,
      defaultUfoRadius,
    } = {},
  ) {
    this.ctx = ctx;
    this.atlas = atlasCache;

    // Canvas / world dimensions
    this.canvasWidth = canvasWidth ?? 960;
    this.canvasHeight = canvasHeight ?? 540;

    // Default sizing for UFOs when radius is not supplied
    this.defaultUfoRadius = defaultUfoRadius ?? 20;

    // Ship + UFO sprites share an atlas.
    this.shipSpriteKeys = shipSpriteKeys ?? [
      'playerShip1_blue.png',
      'playerShip2_blue.png',
      'playerShip3_blue.png',
    ];
    this.ufoSpriteKeys = (ufoSpriteKeys ?? ['ufoBlue'])
      .map((name) => `${name}.png`);

    // Other frequently used sprites.
    this.playerLaserKey = playerLaserKey ?? 'laserBlue01.png';
    this.ufoLaserKey = ufoLaserKey ?? 'laserRed01.png';
    this.powerupKeys = powerupKeys ?? {
      tripleShot: 'things_silver.png',
      extraLife: 'pill_green.png',
      shield: 'shield_silver.png',
      speed: 'star_gold.png',
    };
    this.asteroidSetKeys = asteroidSetKeys ?? {
      brown: ['meteorBrown_big1.png', 'meteorBrown_med1.png', 'meteorBrown_small1.png'],
      grey: ['meteorGrey_big1.png', 'meteorGrey_med1.png', 'meteorGrey_small1.png'],
    };
  }

  /**
   * Clear the full canvas backbuffer before drawing a new frame.
   * Uses logical canvas size (not CSS size).
   */
  clear() {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
  }

  /**
   * Draw the player's ship at (ship.x, ship.y) with rotation ship.angle.
   * - Picks a ship sprite by shield level (0..2).
   * - Applies a blink/alpha effect while the ship is invulnerable.
   * @param {ShipDrawable} ship
   */
  ship(ship) {
    const { ctx } = this;

    // Choose sprite tier based on shield level; fall back safely.
    const tier = typeof ship.shieldLevel === 'number'
      ? Math.max(0, Math.min(ship.shieldLevel, this.shipSpriteKeys.length - 1))
      : 0;

    // If a sprite was explicitly selected via setShipSpriteForShieldLevel(), prefer that,
    // otherwise derive by current shield tier.
    const spriteKey = this.currentShipSpriteKey
      ?? this.shipSpriteKeys?.[tier]
      ?? this.shipSpriteKeys?.[0];

    const frame = this._getFrame(spriteKey);
    if (!frame) return; // skip until loaded

    const { frame: src } = frame;
    const w = src.w;
    const h = src.h;
    const scale = 0.6; // size tuning for on-screen balance

    // Blink/alpha while invulnerable
    const isInvulnerable = ship.invuln > 0;
    const blinkVisible = ship.isInvulnVisible ?? true;

    ctx.save();
    if (isInvulnerable) {
      // Dim while blinking; renderer leaves timing to the Ship.
      ctx.globalAlpha = blinkVisible ? 1 : 0.2;
    }

    // Position + rotate (Kenney ships face "up", so add +90°)
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.angle + Math.PI / 2);

    // Center the sprite around the ship’s origin
    this._drawFrame(frame, -w / 2 * scale, -h / 2 * scale, w * scale, h * scale);
    ctx.restore();
  }

  /**
   * Helper to explicitly choose a ship sprite by shield level.
   * Call this whenever the level changes to keep visuals in sync.
   */
  setShipSpriteForShieldLevel(level = 0) {
    const shipSprites = this.shipSpriteKeys ?? [];
    if (!shipSprites.length) {
      this.currentShipSpriteKey = undefined;
      return;
    }
    const idx = Math.max(0, Math.min(level, shipSprites.length - 1));
    this.currentShipSpriteKey = shipSprites[idx];
  }

  /**
   * Draw a bullet using the laser sprite, rotated to its flight direction.
   * - Uses b.angle if present (preferred), otherwise infers from velocity (vx, vy).
   * - Rotates by +90° to align sprite "up" with our angle=0→right convention.
   * @param {BulletDrawable} b
   */
  bullet(b) {
    const { ctx } = this;
    const frame = this._getFrame(this.playerLaserKey);
    if (!frame) return;

    const ang = (typeof b.angle === 'number')
      ? b.angle
      : Math.atan2(b.vy, b.vx); // fallback to motion vector

    const w = frame.frame.w;
    const h = frame.frame.h;
    const scale = 0.5; // visual tuning

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(ang + Math.PI / 2); // sprite faces +Y; game 0 rad = +X

    // Draw centered for clean rotation
    this._drawFrame(frame, -w / 2 * scale, -h / 2 * scale, w * scale, h * scale);
    ctx.restore();
  }

  /** Draw the UFO enemy using its selected sprite.
   * @param {UfoDrawable} ufo
   */
  ufo(ufo) {
    const { ctx } = this;
    const fallbackKey = this.ufoSpriteKeys?.[0] ?? 'ufoBlue.png';
    const key = ufo.spriteKey && this.ufoSpriteKeys.includes(`${ufo.spriteKey}.png`)
      ? `${ufo.spriteKey}.png`
      : fallbackKey;
    const frame = this._getFrame(key);
    if (!frame) return;

    const diameter = (ufo.r ?? this.defaultUfoRadius) * 2;
    const scale = diameter / Math.max(frame.frame.w, frame.frame.h);

    ctx.save();
    ctx.translate(ufo.x, ufo.y);
    this._drawFrame(frame, -frame.frame.w / 2 * scale, -frame.frame.h / 2 * scale, frame.frame.w * scale, frame.frame.h * scale);
    ctx.restore();
  }

  /** Draw a laser fired by the UFO. */
  ufoLaser(laser) {
    const { ctx } = this;
    const frame = this._getFrame(this.ufoLaserKey);
    if (!frame) return;

    const angle = typeof laser.angle === 'number'
      ? laser.angle
      : Math.atan2(laser.vy, laser.vx);

    const diameter = (laser.r ?? 6) * 2;
    const scale = diameter / Math.max(frame.frame.w, frame.frame.h);

    ctx.save();
    ctx.translate(laser.x, laser.y);
    ctx.rotate(angle + Math.PI / 2);
    this._drawFrame(frame, -frame.frame.w / 2 * scale, -frame.frame.h / 2 * scale, frame.frame.w * scale, frame.frame.h * scale);
    ctx.restore();
  }

  /**
   * Draw an asteroid:
   * - Picks the color set (brown/grey) from a.colorVariant
   * - Picks size sprite by a.sizeIndex (0=large,1=med,2=small)
   * - Scales sprite to match collision radius "a.r"
   * @param {AsteroidDrawable} a
   */
  asteroid(a) {
    const { ctx } = this;

    // Choose sprite set + size; fall back to brown large if missing.
    const set = this.asteroidSetKeys[a.colorVariant] || this.asteroidSetKeys.brown;
    const frameKey = set[a.sizeIndex] || set[0];
    const frame = this._getFrame(frameKey);
    if (!frame) return;

    // Compute uniform scale so that sprite diameter ~= 2*a.r
    const radius = a.r;
    const scale = (radius * 2) / frame.frame.w;

    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.angle);
    this._drawFrame(frame, -frame.frame.w / 2 * scale, -frame.frame.h / 2 * scale, frame.frame.w * scale, frame.frame.h * scale);
    ctx.restore();
  }

  /**
   * Draw a power-up by its type (must match keys in this.powerupKeys).
   * Falls back to a simple vector icon if the sprite isn't ready yet.
   * Power-up sprites are scaled so their visual diameter matches 2 * p.r.
   * @param {PowerUpDrawable} p
   */
  powerUp(p) {
    const { ctx } = this;
    const frameKey = this.powerupKeys[p.type] || this.powerupKeys.tripleShot;
    const frame = this._getFrame(frameKey);

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);

    if (frame) {
      const { w, h } = frame.frame;
      const diameter = p.r * 2;
      const scale = diameter / Math.max(w, h);
      this._drawFrame(frame, -w / 2 * scale, -h / 2 * scale, w * scale, h * scale);
    } else {
      // Simple fallback: cyan disk with a "+" cross
      ctx.beginPath();
      ctx.arc(0, 0, p.r, 0, Math.PI * 2);
      ctx.fillStyle = '#66e3ff';
      ctx.fill();

      ctx.lineWidth = 2;
      ctx.strokeStyle = '#004d66';
      ctx.moveTo(-p.r * 0.6, 0); ctx.lineTo(p.r * 0.6, 0);
      ctx.moveTo(0, -p.r * 0.6); ctx.lineTo(0, p.r * 0.6);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Draw HUD text (score, lives, wave, etc.).
   * Keep the font list generic and readable; color matches the game's UI palette.
   */
  text(x, y, msg, size = 18, align = 'left') {
    const { ctx } = this;
    ctx.font = `${size}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    ctx.textAlign = align;
    ctx.fillStyle = '#d9e2ff';
    ctx.fillText(msg, x, y);
  }

  /**
   * High-level frame renderer that clears the canvas and draws entities from a snapshot.
   *
   * @param {Object} snapshot
   * @param {ShipDrawable} [snapshot.ship]
   * @param {BulletDrawable[]} [snapshot.bullets]
   * @param {AsteroidDrawable[]} [snapshot.asteroids]
   * @param {UfoDrawable[]} [snapshot.ufos]
   * @param {PowerUpDrawable[]} [snapshot.powerUps]
   */
  renderFrame(snapshot = {}) {
    const { ship, bullets, asteroids, ufos, powerUps } = snapshot;

    this.clear();

    if (ship) this.ship(ship);
    for (const b of bullets ?? []) this.bullet(b);
    for (const a of asteroids ?? []) this.asteroid(a);
    for (const u of ufos ?? []) this.ufo(u);
    for (const p of powerUps ?? []) this.powerUp(p);
  }

  /** Retrieve a frame entry if it has been loaded. */
  _getFrame(name) {
    return this.atlas?.getFrame(name) ?? null;
  }

  /** Draw a sprite frame from an atlas. */
  _drawFrame(frame, dx, dy, dw, dh) {
    const { image, frame: src } = frame;
    if (!image || !image.complete || !src) return;

    this.ctx.drawImage(
      image,
      src.x,
      src.y,
      src.w,
      src.h,
      dx,
      dy,
      dw,
      dh,
    );
  }
}
