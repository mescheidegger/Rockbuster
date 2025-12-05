/* ========================= src/entities/Bullet.js ========================= */
import { Entity } from './Entity.js';
import { CONFIG } from '../config.js';

export class Bullet extends Entity {
  constructor(x, y, angle) {
    super(x, y, CONFIG.BULLET.RADIUS);

    // ✅ Keep the firing angle so the renderer can rotate the sprite correctly.
    // (Game passes in ship.angle at the moment of firing.)
    this.angle = angle;

    // Set initial velocity based on that angle.
    this.vx = Math.cos(angle) * CONFIG.BULLET.SPEED;
    this.vy = Math.sin(angle) * CONFIG.BULLET.SPEED;

    // Lifetime (seconds) before auto-despawn
    this.lifetime = CONFIG.BULLET.LIFETIME;
  }

  update(dt) {
    // Integrate position
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Count down lifetime
    this.lifetime -= dt;
    if (this.lifetime <= 0) this.dead = true;

    // (Optional safety) In case anything ever mutates vx/vy,
    // recompute angle from velocity so rendering stays aligned.
    // Comment this out if you don't want it to drift with velocity changes.
    if (this.vx !== 0 || this.vy !== 0) {
      this.angle = Math.atan2(this.vy, this.vx);
    }
  }
}
