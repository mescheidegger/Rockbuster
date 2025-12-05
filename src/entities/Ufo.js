/* ========================= src/entities/Ufo.js ========================= */
import { Entity } from './Entity.js';
import { CONFIG } from '../config.js';
import { UfoLaser } from './UfoLaser.js';

/**
 * Enemy UFO that patrols the playfield and periodically fires at the player ship.
 *
 * The UFO is intentionally simple: it travels with a constant velocity, wraps
 * around the screen edges, and shoots towards the ship at a fixed cadence. The
 * behaviour mirrors the classic Asteroids saucer, giving players a temporary
 * high-value target that breaks up the regular asteroid clearing loop.
 */
export class Ufo extends Entity {
  constructor({ x, y, vx, vy, spriteKey }) {
    super(x, y, CONFIG.UFO.RADIUS);

    this.vx = vx;
    this.vy = vy;
    this.spriteKey = spriteKey;

    this.health = CONFIG.UFO.HITS_TO_DESTROY;
    this.fireCooldown = CONFIG.UFO.FIRE_INTERVAL;
  }

  /**
   * Advance the UFO and possibly fire at the ship.
   * @param {number} dt
   * @param {{x:number,y:number}} target
   * @returns {UfoLaser[]} lasers fired this tick
   */
  update(dt, target) {
    if (this.dead) return [];

    // Advance the UFO with a simple Euler integration.
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const margin = CONFIG.UFO.OFFSCREEN_MARGIN ?? 0;
    const { W, H } = CONFIG.CANVAS;

    // Wrap around the playfield edges so the UFO feels omnipresent and keeps
    // pressure on the player regardless of spawn side.
    if (this.vx !== 0) {
      if (this.x < -margin) this.x = W + margin;
      else if (this.x > W + margin) this.x = -margin;
    }

    if (this.vy !== 0) {
      if (this.y < -margin) this.y = H + margin;
      else if (this.y > H + margin) this.y = -margin;
    }

    const lasers = [];
    this.fireCooldown -= dt;
    // Fire directly at the player's ship once the cooldown elapses. Accuracy is
    // perfect by default; any intentional inaccuracy should be applied by the
    // caller before instantiating the UFO.
    if (this.fireCooldown <= 0 && target) {
      const angle = Math.atan2(target.y - this.y, target.x - this.x);
      lasers.push(new UfoLaser(this.x, this.y, angle));
      this.fireCooldown = CONFIG.UFO.FIRE_INTERVAL;
    }

    return lasers;
  }

  /**
   * Register a player hit. Returns `true` when the UFO is destroyed so the game
   * loop can trigger scoring, explosions, or audio cues in a single location.
   */
  takeHit() {
    if (this.dead) return false;
    this.health -= 1;
    if (this.health <= 0) {
      this.dead = true;
      return true;
    }
    return false;
  }
}

