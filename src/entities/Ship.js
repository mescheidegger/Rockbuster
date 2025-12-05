/* ========================= src/entities/Ship.js ========================= */
import { Entity } from './Entity.js';
import { CONFIG } from '../config.js';
import { Bullet } from '../entities/Bullet.js';
import { angleToVec, clamp } from '../utils/math.js';

/**
 * Player-controlled ship.
 *
 * Responsibilities:
 * - Reads high-level input (left/right/forward) and turns/thrusts the ship.
 * - Handles basic movement integration, friction, and max-speed clamping.
 * - Manages firing cooldown + spawns bullets (single or triple, depending on weapon mode).
 * - Tracks temporary invulnerability (e.g., after respawn or shield hit) + optional blink.
 * - Tracks power-up state for speed and shields; exposes helpers to change levels.
 *
 * Extends Entity, which provides:
 *   x, y : position
 *   r    : collision radius
 *   vx, vy : velocity
 *   dead : kill flag
 */
export class Ship extends Entity {
  /**
   * @param {number} x - spawn x
   * @param {number} y - spawn y
   * @param {{invulnBlink?: boolean}} [options]
   *   invulnBlink: if true, start with a respawn invulnerability timer and blink
   */
  constructor(x, y, options = {}) {
    // Initialize position + collision radius via Entity constructor
    super(x, y, CONFIG.SHIP.RADIUS);

    const { invulnBlink = true } = options;

    // Face "up" initially (our 0 rad points right; -90° makes the nose up)
    this.angle = -Math.PI / 2;

    // Seconds until the ship can fire again (counts down each frame)
    this.cooldown = 0;

    // --- Invulnerability + blink state ---
    // If enabled, grant a spawn/respawn invulnerability window.
    this.invuln = invulnBlink ? CONFIG.SHIP.RESPAWN_INVULN : 0;
    this.resetInvulnBlink(); // sets blink accumulator + visible flag

    // --- Weapons ---
    // Start in single-shot; weapon power-up upgrades increase the volley size.
    this.weaponMode = CONFIG.WEAPON.MODE_SINGLE;

    // --- Speed power-up baseline + per-level bonuses ---
    this.baseAccel = CONFIG.SHIP.ACCEL;
    this.baseMaxSpeed = CONFIG.SHIP.MAX_SPEED;
    const speedCfg = CONFIG.SHIP.SPEED_POWERUP ?? {};
    this.speedLevel = 0;
    this.maxSpeedLevel = Math.max(0, speedCfg.MAX_LEVEL ?? 0);
    this.accelBonusPerLevel = speedCfg.ACCEL_BONUS_PER_LEVEL ?? 0;
    this.maxSpeedBonusPerLevel = speedCfg.MAX_SPEED_BONUS_PER_LEVEL ?? 0;
    this.recalculateSpeedStats(); // computes currentAccel/currentMaxSpeed

    // --- Shield state ---
    // Levels map to visual tiers; renderer can swap sprites by tier.
    this.shieldLevel = 0;
    this.spriteTier = 0;
    this.setShieldLevel(0);
  }

  /**
   * Per-tick update: rotate, thrust, apply friction, clamp speed, integrate position,
   * tick firing cooldown, and tick/animate invulnerability blink state.
   * @param {number} dt    - delta time (seconds)
   * @param {Input}  input - input abstraction (keyboard/virtual)
   */
  update(dt, input) {
    const S = CONFIG.SHIP;

    // Use live stats (may be modified by speed power-ups)
    const accel = this.currentAccel ?? this.baseAccel ?? S.ACCEL;
    const maxSpeed = this.currentMaxSpeed ?? this.baseMaxSpeed ?? S.MAX_SPEED;

    /* ---------- Rotation (Left/Right) ---------- */
    if (input.isDown('ArrowLeft') || input.isDown('KeyA')) {
      this.angle -= S.TURN_SPEED * dt;           // CCW
    }
    if (input.isDown('ArrowRight') || input.isDown('KeyD')) {
      this.angle += S.TURN_SPEED * dt;           // CW
    }

    /* ---------- Thrust (Forward) ---------- */
    if (input.isDown('ArrowUp') || input.isDown('KeyW')) {
      const dir = angleToVec(this.angle);        // unit vector of facing
      this.vx += dir.x * accel * dt;
      this.vy += dir.y * accel * dt;
    }

    /* ---------- Friction + Speed Clamp ---------- */
    // Gentle drag to keep motion controllable
    this.vx *= S.FRICTION;
    this.vy *= S.FRICTION;

    // Cap speed so the ship doesn’t accelerate forever
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > maxSpeed) {
      const k = maxSpeed / speed;
      this.vx *= k;
      this.vy *= k;
    }

    /* ---------- Integrate Position ---------- */
    // Wrapping is handled centrally in the Physics system.
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    /* ---------- Firing Cooldown ---------- */
    this.cooldown = Math.max(0, this.cooldown - dt);

    /* ---------- Invulnerability (timer + blink) ---------- */
    const prevInvuln = this.invuln;
    this.invuln = Math.max(0, this.invuln - dt);

    if (this.invuln > 0) {
      // Blink at a fixed interval while invulnerable (if configured)
      const interval = CONFIG.SHIP.INVULN_BLINK_INTERVAL || 0;
      if (interval > 0) {
        this.invulnElapsed += dt;
        while (this.invulnElapsed >= interval) {
          this.invulnElapsed -= interval;
          this.isInvulnVisible = !this.isInvulnVisible;
        }
      } else {
        // No blink timing → always visible during invuln
        this.invulnElapsed = 0;
        this.isInvulnVisible = true;
      }
    } else if (prevInvuln > 0) {
      // Just ended invuln window → reset blink state
      this.resetInvulnBlink();
    }
  }

  /** Reset blink timers/flags used during invulnerability. */
  resetInvulnBlink() {
    this.invulnElapsed = 0;
    this.isInvulnVisible = true;
  }

  /** @returns {boolean} true if firing is allowed this frame (cooldown elapsed). */
  canFire() {
    return this.cooldown <= 0;
  }

  /** Start the post-shot cooldown. */
  didFire() {
    this.cooldown = CONFIG.SHIP.FIRE_COOLDOWN;
  }

  /**
   * Set shields (and sync sprite tier) within a fixed range.
   * Renderer can use spriteTier to select a visual.
   * @param {number} level - desired shield level
   * @returns {number} the clamped shield level
   */
  setShieldLevel(level) {
    const clampedLevel = clamp(level, 0, 2);
    this.shieldLevel = clampedLevel;
    this.spriteTier = clampedLevel;
    return this.shieldLevel;
  }

  /**
   * Spawn one, three, or five bullets depending on weapon mode.
   * NOTE: the caller is responsible for pushing these into state.
   * @returns {Bullet[]} bullets to add to the world
   */
  fire() {
    const bullets = [];
    const baseAngle = this.angle;

    // Spawn bullets slightly ahead of the ship's nose so they don't collide immediately.
    const noseX = this.x + Math.cos(baseAngle) * (this.r + 2);
    const noseY = this.y + Math.sin(baseAngle) * (this.r + 2);

    const spread = CONFIG.WEAPON.SPREAD_RAD;

    if (this.weaponMode === CONFIG.WEAPON.MODE_FIVE) {
      bullets.push(new Bullet(noseX, noseY, baseAngle - spread * 2));
      bullets.push(new Bullet(noseX, noseY, baseAngle - spread));
      bullets.push(new Bullet(noseX, noseY, baseAngle));
      bullets.push(new Bullet(noseX, noseY, baseAngle + spread));
      bullets.push(new Bullet(noseX, noseY, baseAngle + spread * 2));
    } else if (this.weaponMode === CONFIG.WEAPON.MODE_TRIPLE) {
      bullets.push(new Bullet(noseX, noseY, baseAngle - spread));
      bullets.push(new Bullet(noseX, noseY, baseAngle));
      bullets.push(new Bullet(noseX, noseY, baseAngle + spread));
    } else {
      bullets.push(new Bullet(noseX, noseY, baseAngle));
    }

    // Trigger cooldown after generating projectiles
    this.didFire();
    return bullets;
  }

  /**
   * Recompute currentAccel/currentMaxSpeed based on speedLevel and per-level bonuses.
   * Called after any change to speedLevel or baseline speed stats.
   */
  recalculateSpeedStats() {
    const baseAccel = this.baseAccel ?? CONFIG.SHIP.ACCEL ?? 0;
    const baseMaxSpeed = this.baseMaxSpeed ?? CONFIG.SHIP.MAX_SPEED ?? 0;
    const level = Math.max(0, this.speedLevel ?? 0);
    const accelBonus = this.accelBonusPerLevel ?? 0;
    const maxSpeedBonus = this.maxSpeedBonusPerLevel ?? 0;

    this.currentAccel = baseAccel + level * accelBonus;
    this.currentMaxSpeed = baseMaxSpeed + level * maxSpeedBonus;
  }

  /**
   * Increase speedLevel by 1 up to maxSpeedLevel and refresh derived stats.
   * @returns {boolean} true if level increased; false if already at max
   */
  increaseSpeedLevel() {
    if (this.speedLevel >= this.maxSpeedLevel) return false;
    this.speedLevel += 1;
    this.recalculateSpeedStats();
    return true;
  }

  /** Reset speed power-up to baseline and refresh derived stats. */
  resetSpeedLevel() {
    this.speedLevel = 0;
    this.recalculateSpeedStats();
  }

  /**
   * Try to increase shields by 1 up to SHIELD_MAX_LEVEL.
   * @returns {boolean} true if shield increased; false if already at cap
   */
  increaseShieldLevel() {
    const max = CONFIG.SHIP.SHIELD_MAX_LEVEL ?? 0;
    if (this.shieldLevel >= max) return false;
    this.shieldLevel = Math.min(max, this.shieldLevel + 1);
    return true;
  }

  /**
   * Decrease shields by 1 down to 0.
   * @returns {boolean} true if shield decreased; false if already at 0
   */
  decreaseShieldLevel() {
    if (this.shieldLevel <= 0) return false;
    this.shieldLevel = Math.max(0, this.shieldLevel - 1);
    return true;
  }
}
