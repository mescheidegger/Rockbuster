/* ========================= src/config.js ========================= */
/**
 * Centralized gameplay configuration.
 * 
 * All tunable values live here so gameplay can be balanced or tweaked
 * without digging through the logic code. This includes ship handling,
 * asteroid behavior, bullet properties, score values, power-up rules, etc.
 */
export const CONFIG = {

  /* Canvas (game world) dimensions in pixels */
  CANVAS: {
    W: 960,   // width
    H: 540    // height
  },

  /* Player Ship Settings */
  SHIP: {
    RADIUS: 14,           // collision circle radius
    ACCEL: 180,           // forward thrust in pixels/s^2
    TURN_SPEED: Math.PI,  // rotation speed in radians/s (≈180°/s)
    FRICTION: 0.985,      // movement damping per frame (~1.0 = floaty/space-like)
    MAX_SPEED: 340,       // clamp for ship velocity before speed power-up bonuses
    FIRE_COOLDOWN: 0.18,  // seconds between shots
    RESPAWN_INVULN: 3,    // seconds of invulnerability granted on spawn/respawn
    INVULN_BLINK_INTERVAL: 0.15, // seconds between blink toggles while invulnerable
    LIVES: 3,             // number of lives before GAME OVER
    MAX_LIVES: 5,         // max number of lives
    SHIELD_MAX_LEVEL: 2,  // number of shield hits that can be stored
    SHIELD_HIT_INVULN: 1, // short invulnerability after a shield absorbs a hit (seconds)

    SPEED_POWERUP: {
      MAX_LEVEL: 5,                // how many stacks of the speed boost are allowed
      ACCEL_BONUS_PER_LEVEL: 45,   // additive acceleration (pixels/s^2) granted per level
      MAX_SPEED_BONUS_PER_LEVEL: 55 // additive max speed bonus (pixels/s) per level
    }
  },

  /* Weapon Settings */
  WEAPON: {
    MODE_SINGLE: 'single',
    MODE_TRIPLE: 'triple',
    MODE_FIVE: 'five',
    SPREAD_RAD: Math.PI / 12, // 15 degrees in radians
  },

  /* Bullet Settings */
  BULLET: {
    SPEED: 520,   // initial bullet speed in pixels/s
    LIFETIME: 1.2, // seconds before bullet auto-despawns
    RADIUS: 2     // collision radius
  },

  /* Asteroid Settings */
  ASTEROID: {
    SPEED_MIN: 30,            // minimum drifting speed
    SPEED_MAX: 120,           // maximum drifting speed
    SIZES: [42, 28, 18],      // asteroid radii for large, medium, small
    SPLIT_COUNT: 2,           // number of smaller asteroids spawned upon destruction
    SPEED_GROWTH_PER_WAVE: 0.1 // additive multiplier growth applied each wave
  },

  /* UFO Enemy Settings */
  UFO: {
    RADIUS: 22,                 // collision radius for the UFO body
    SPEED: 180,                 // travel speed while crossing the playfield (pixels/s)
    SPRITES: ['ufoBlue', 'ufoGreen', 'ufoRed', 'ufoYellow'],
    HITS_TO_DESTROY: 3,         // number of player bullets required to destroy the UFO
    SCORE_VALUE: 750,           // score awarded for destroying the UFO
    FIRE_INTERVAL: 1.5,         // seconds between laser shots
    LASER_SPEED: 360,           // speed of the UFO laser projectiles (pixels/s)
    LASER_LIFETIME: 2.5,        // seconds before a UFO laser despawns automatically
    OFFSCREEN_MARGIN: 36,       // spawn/despawn margin outside the playfield
    SPAWN_TIMER: {
      START: 30,                // seconds before the first UFO of the run spawns
      DECREMENT_PER_WAVE: 1.2,  // reduce spawn timer each wave
      MIN: 6                    // lower bound for spawn timer as waves increase
    }
  },

  /* Wave System */
  WAVES: {
    START_COUNT: 4,   // number of asteroids in wave 0
    GROWTH: 1         // increase asteroid count by this each new wave
  },

  /* Scoring for destroying different asteroid sizes */
  SCORE: {
    SMALL: 100,       // points for destroying smallest asteroid
    MED: 50,          // medium asteroid
    LARGE: 20         // largest asteroid
  },

  /* Enable or disable debug output/overlays */
  DEBUG: {
    CONSOLE_OVERLAY: {
      ENABLED: false,          // Set to true to surface console logs in-game
      MAX_ENTRIES: 200,        // How many log lines to retain in the overlay
      INCLUDE_TIMESTAMP: true  // Prefix each log with a HH:MM:SS timestamp
    }
  },

  /* Audio Settings */
  AUDIO: {
    MASTER: 1.0,       // overall multiplier applied to all audio output
    MUSIC: 1.0,        // volume multiplier applied to background music
    SFX: {
      SHOOT: 0.5,      // player laser shots
      POWERUP: 1.0,    // collecting a power-up
      PLAYER_HIT: 1.0, // ship taking damage / shield down
      UFO_LASER: 1.0,  // UFO laser firing volume
      ASTEROID_HIT: 0.25 // asteroid explosion volume (half of other effects)
    }
  },

  /* Power-Up Spawn Settings */
  POWERUP: {
    // Power-up physics properties
    RADIUS: 14,        // collision radius
    SPEED_MIN: 20,     // minimum drift speed
    SPEED_MAX: 60,     // maximum drift speed

    // How far offscreen to spawn (just like asteroids)
    OFFSCREEN_MARGIN: 40,

    // Per-type configuration (spawn model + duplicate score rewards)
    types: {
      tripleShot: {
        /**
         * Choose a spawn model:
         *  - 'chance': roll probability once per wave to spawn this power-up
         *  - 'interval': spawn once every N waves (deterministic)
         */
        model: 'chance',

        // If using 'chance' model: probability (0–1) of spawning per wave
        chancePerWave: 0.35,

        // If using 'interval' model: guaranteed spawn every Nth wave (0, N, 2N...)
        everyNWaves: 3,

        // Score awarded when picking up a duplicate while already empowered
        duplicateScore: 5000
      },

      extraLife: {
        model: 'chance',
        chancePerWave: 0.35,
        everyNWaves: 5,
        duplicateScore: 2000
      },

      shield: {
        model: 'chance',
        chancePerWave: 0.35,
        everyNWaves: 4,
        duplicateScore: 4000
      },

      speed: {
        model: 'chance',
        chancePerWave: 0.3,
        everyNWaves: 3,
        duplicateScore: 2500,
        sprite: './assets/sprites/Power-ups/star_gold.png'
      }
    }
  }
};
