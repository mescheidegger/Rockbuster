/* ========================= src/entities/UfoLaser.js ========================= */
import { Entity } from './Entity.js';
import { CONFIG } from '../config.js';

/**
 * Laser projectile fired by the UFO.
 *
 * The saucer deliberately breaks the "everything wraps" rule from asteroids to
 * make the projectile feel more threatening. To achieve that, the laser keeps a
 * short lifetime and also self-destructs as soon as it leaves a small bounding
 * box around the play area. This prevents stray lasers from lingering for too
 * long when the UFO is off-screen.
 */
export class UfoLaser extends Entity {
  constructor(x, y, angle) {
    super(x, y, 6);

    this.angle = angle;

    const speed = CONFIG.UFO.LASER_SPEED;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;

    this.lifetime = CONFIG.UFO.LASER_LIFETIME;
  }

  update(dt) {
    // Straight-line motion; the UFO laser does not wrap like other entities.
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.lifetime -= dt;
    if (this.lifetime <= 0) {
      this.dead = true;
      return;
    }

    const margin = CONFIG.UFO.OFFSCREEN_MARGIN;
    const { W, H } = CONFIG.CANVAS;

    if (
      this.x < -margin ||
      this.x > W + margin ||
      this.y < -margin ||
      this.y > H + margin
    ) {
      this.dead = true;
    }
  }
}

