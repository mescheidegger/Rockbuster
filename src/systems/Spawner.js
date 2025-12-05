/* ========================= src/systems/Spawner.js ========================= */
import { Asteroid } from '../entities/Asteroid.js';
import { PowerUp } from '../entities/PowerUp.js';
import { CONFIG } from '../config.js';

export function spawnWave(state) {
  const count = CONFIG.WAVES.START_COUNT + state.wave * CONFIG.WAVES.GROWTH;
  const speedMultiplier = 1 + state.wave * CONFIG.ASTEROID.SPEED_GROWTH_PER_WAVE;
  for (let i = 0; i < count; i++) {
    const { x, y } = randomEdgeSpawn(CONFIG.CANVAS.W, CONFIG.CANVAS.H, CONFIG.POWERUP.OFFSCREEN_MARGIN);
    const colorVariant = Math.random() < 0.5 ? 'brown' : 'grey';
    state.asteroids.push(new Asteroid(x, y, 0, {
      colorVariant,
      speedMultiplier
    }));
  }
}

/**
 * Possibly spawns power-ups for this wave based on CONFIG.POWERUP rules.
 * Each configured type rolls independently, so multiple pickups can appear in one wave.
 * Call once when a new wave starts (after spawnWave).
 */
export function maybeSpawnPowerUp(state) {
  const types = CONFIG.POWERUP.types ?? {};

  for (const [type, rules] of Object.entries(types)) {
    if (!shouldSpawnType(rules, state.wave)) continue;

    const { x, y } = randomEdgeSpawn(
      CONFIG.CANVAS.W,
      CONFIG.CANVAS.H,
      CONFIG.POWERUP.OFFSCREEN_MARGIN
    );
    state.powerups.push(new PowerUp(x, y, type));
  }
}

function shouldSpawnType(rules, wave) {
  const model = rules?.model ?? 'chance';

  if (model === 'chance') {
    const chance = Math.max(0, Math.min(1, rules?.chancePerWave ?? 0));
    return Math.random() < chance;
  }

  if (model === 'interval') {
    const n = rules?.everyNWaves ?? Infinity;
    if (!Number.isFinite(n) || n <= 0) return false;
    return (wave % n) === 0;
  }

  return false;
}

/* utility used by both asteroid & power-up spawns */
function randomEdgeSpawn(W, H, margin) {
  const edge = Math.floor(Math.random() * 4);
  let x = 0, y = 0;
  if (edge === 0) { x = -margin;    y = Math.random() * H; }
  if (edge === 1) { x = W + margin; y = Math.random() * H; }
  if (edge === 2) { x = Math.random() * W; y = -margin; }
  if (edge === 3) { x = Math.random() * W; y = H + margin; }
  return { x, y };
}
