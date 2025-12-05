/* ========================= src/entities/Entity.js ========================= */

/**
 * Base class for all in-game objects that have a position and size.
 *
 * In this project, nearly everything that moves or collides
 * (Ship, Asteroid, Bullet, etc.) extends from this base class.
 *
 * It defines the minimal set of properties that all entities share:
 * - Position (x, y)
 * - Radius (r) for collision detection
 * - Velocity (vx, vy)
 * - Alive/dead flag for lifecycle management
 *
 * This keeps the code consistent and allows systems like Physics
 * and Collision to work generically across all entity types.
 */
export class Entity {
  /**
   * @param {number} x - Initial X position (in pixels)
   * @param {number} y - Initial Y position (in pixels)
   * @param {number} r - Collision radius (used for circle-based hit detection)
   */
  constructor(x, y, r) {
    // --- Core physical properties ---

    // Current position of the entity in world (canvas) space
    this.x = x;
    this.y = y;

    // Collision radius — used by the circle-vs-circle collision system
    this.r = r;

    // Velocity components (pixels per second)
    // These determine how the entity moves each frame (x += vx * dt, etc.)
    this.vx = 0;
    this.vy = 0;

    // Lifecycle flag.
    // When set to true, the entity will be removed by the game loop.
    this.dead = false;
  }
}
