/* ========================= src/systems/Physics.js ========================= */
import { CONFIG } from '../config.js';
import { wrap } from '../utils/math.js';

/**
 * Handles the screen wrap-around logic for moving entities.
 *
 * In classic Asteroids-style games, objects that exit one side of the screen
 * reappear on the opposite side (instead of stopping or bouncing).
 * 
 * This function is typically called after an entity's position has already
 * been updated (integrated) in its own `update()` method. It simply checks
 * whether the entity has moved beyond the canvas bounds, and if so, wraps
 * its position back around to the opposite edge.
 *
 * @param {Object} entity - Any game object with `x` and `y` coordinates
 *                          (e.g., Ship, Asteroid, Bullet).
 */
export function integrateAndWrap(entity) {
  // Entity position is already updated elsewhere; here we only apply wrapping.

  // Wrap the X coordinate around the canvas width.
  // If x < 0, it reappears on the right side.
  // If x > canvas width, it reappears on the left side.
  entity.x = wrap(entity.x, CONFIG.CANVAS.W);

  // Wrap the Y coordinate around the canvas height.
  // If y < 0, it reappears at the bottom.
  // If y > canvas height, it reappears at the top.
  entity.y = wrap(entity.y, CONFIG.CANVAS.H);
}
