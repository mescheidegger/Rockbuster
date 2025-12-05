/* ========================= src/systems/Collision.js ========================= */

/**
 * Basic circle-vs-circle collision detection.
 *
 * Used to check whether two circular entities (e.g., bullets, asteroids, ship)
 * are overlapping based on their positions and radii.
 *
 * This approach is extremely fast — perfect for arcade-style games —
 * because it avoids expensive square root operations.
 *
 * @param {Object} a - First entity with { x, y, r }
 * @param {Object} b - Second entity with { x, y, r }
 * @returns {boolean} True if the two circles overlap or touch, false otherwise.
 */
export function circleHit(a, b) {
  // Compute the difference between the entity centers.
  const dx = a.x - b.x;
  const dy = a.y - b.y;

  // Compute the squared sum of their radii.
  // (a.r + b.r) is the maximum distance at which they touch.
  const rr = (a.r + b.r) * (a.r + b.r);

  // Compare squared distances instead of calling Math.sqrt.
  // This is faster and avoids unnecessary floating-point operations.
  // If the squared distance between centers ≤ squared radius sum → collision.
  return dx * dx + dy * dy <= rr;
}

/**
 * Iterate bullets vs asteroids and invoke a callback when a collision occurs.
 * The callback decides how to resolve the collision (mark dead, score, etc.).
 *
 * @param {Array} bullets
 * @param {Array} asteroids
 * @param {(bullet: any, asteroid: any) => void} onHit
 */
export function forEachBulletAsteroidHit(bullets, asteroids, onHit) {
  for (const b of bullets) {
    if (b.dead) continue;
    for (const a of asteroids) {
      if (a.dead) continue;
      if (!circleHit(b, a)) continue;
      onHit(b, a);
      break; // mirror current "one asteroid per bullet" behavior
    }
  }
}

/**
 * Find the first asteroid that collides with the ship.
 *
 * @param {Object} ship
 * @param {Array} asteroids
 * @returns {Object|null}
 */
export function findShipAsteroidHit(ship, asteroids) {
  for (const a of asteroids) {
    if (a.dead) continue;
    if (circleHit(ship, a)) return a;
  }
  return null;
}
