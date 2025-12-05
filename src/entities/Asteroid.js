/* ========================= src/entities/Asteroid.js ========================= */
import { Entity } from './Entity.js';
import { CONFIG } from '../config.js';
import { randRange, randSign } from '../utils/math.js';

export class Asteroid extends Entity {
  // sizeIndex: 0=large, 1=medium, 2=small
  // options: { colorVariant?: 'brown' | 'grey', speedMultiplier?: number }
  constructor(x, y, sizeIndex = 0, options = {}) {
    const {
      colorVariant = null,
      speedMultiplier = 1
    } = options;
    const r = CONFIG.ASTEROID.SIZES[sizeIndex];
    super(x, y, r);

    this.sizeIndex = sizeIndex;

    // ✅ Decide color ONCE at creation (not in Renderer)
    // This ensures the asteroid keeps its color through its lifetime and splits.
    this.colorVariant = colorVariant ?? (Math.random() < 0.5 ? 'brown' : 'grey');
    this.speedMultiplier = speedMultiplier;

    // Velocity and spin
    const baseSpeed = randRange(CONFIG.ASTEROID.SPEED_MIN, CONFIG.ASTEROID.SPEED_MAX);
    const speed = baseSpeed * this.speedMultiplier;
    this.vx = randSign() * speed * Math.random();
    this.vy = randSign() * speed * Math.random();
    this.spin = randRange(-1, 1); // for visual flair
    this.angle = Math.random() * Math.PI * 2;
  }

  split() {
    if (this.sizeIndex + 1 >= CONFIG.ASTEROID.SIZES.length) return [];
    const next = this.sizeIndex + 1;
    const parts = [];
    for (let i = 0; i < CONFIG.ASTEROID.SPLIT_COUNT; i++) {
      // ✅ Inherit the parent's colorVariant so children stay the same color
      const child = new Asteroid(this.x, this.y, next, {
        colorVariant: this.colorVariant,
        speedMultiplier: this.speedMultiplier
      });
      parts.push(child);
    }
    return parts;
  }

  update(dt) {
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.angle += this.spin * dt;
  }
}
