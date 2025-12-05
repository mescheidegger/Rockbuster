/* ========================= src/entities/PowerUp.js ========================= */
import { Entity } from './Entity.js';
import { CONFIG } from '../config.js';
import { randRange, randSign } from '../utils/math.js';

/**
 * A collectible floating item. For now, it has no gameplay effect:
 * - It spawns occasionally based on CONFIG.POWERUP rules.
 * - The ship can collide with it to “pick up” (we remove it and increment a counter).
 */
export class PowerUp extends Entity {
  constructor(x, y, type = 'tripleShot') {
    super(x, y, CONFIG.POWERUP.RADIUS);

    this.type = type;

    // Simple drift velocity and a gentle spin for fun (if you want to rotate sprite)
    const speed = randRange(CONFIG.POWERUP.SPEED_MIN, CONFIG.POWERUP.SPEED_MAX);
    this.vx = randSign() * speed * Math.random();
    this.vy = randSign() * speed * Math.random();
    this.angle = Math.random() * Math.PI * 2; // for rendering rotation if desired
    this.spin = randRange(-0.8, 0.8);
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.angle += this.spin * dt;
  }
}
