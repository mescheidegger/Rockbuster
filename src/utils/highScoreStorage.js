/* ========================= src/utils/highScoreStorage.js ========================= */
/**
 * High score persistence helpers backed by IndexedDB with a localStorage fallback.
 *
 * The IndexedDB entry stores a single record keyed by `HIGH_SCORE_KEY` so we can
 * keep the player's best run indefinitely. If IndexedDB is unavailable (older
 * browsers, privacy modes), we fall back to localStorage so the player still
 * retains progress during the current browsing profile.
 */
// Database configuration used when storing scores in IndexedDB.
const DB_NAME = 'asteroids-lite';
const DB_VERSION = 1;
const STORE_NAME = 'progress';
const HIGH_SCORE_KEY = 'highScore';
// A unique key for localStorage so that different builds don't collide.
const FALLBACK_STORAGE_KEY = 'asteroids-lite/high-score';

// Lazily-initialized promise for the IndexedDB connection so we only open it once.
let dbPromise = null;

// Detects whether the current environment exposes IndexedDB without throwing.
function hasIndexedDB() {
  try {
    return typeof window !== 'undefined' && !!window.indexedDB;
  } catch (err) {
    return false;
  }
}

// Opens the IndexedDB database (creating it if necessary) and memoizes the promise.
function openDatabase() {
  if (!hasIndexedDB()) {
    return Promise.resolve(null);
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = () => {
          reject(request.error || new Error('Failed to open high score database'));
        };

        request.onblocked = () => {
          console.warn('High score database upgrade is blocked by an open connection.');
        };
      } catch (err) {
        reject(err);
      }
    }).catch((err) => {
      console.warn('Unable to open IndexedDB for high score persistence:', err);
      return null;
    });
  }

  return dbPromise;
}

// Reads the high score record from the IndexedDB object store.
function readFromStore(db) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(HIGH_SCORE_KEY);

      request.onsuccess = () => {
        resolve(request.result ?? null);
      };

      request.onerror = () => {
        console.warn('Failed to read high score from IndexedDB:', request.error);
        resolve(null);
      };
    } catch (err) {
      console.warn('High score read transaction failed:', err);
      resolve(null);
    }
  });
}

// Writes the current high score into the IndexedDB object store.
function writeToStore(db, score) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const value = { value: score, updatedAt: Date.now() };
      const request = store.put(value, HIGH_SCORE_KEY);

      request.onsuccess = () => resolve(true);
      request.onerror = () => {
        console.warn('Failed to persist high score to IndexedDB:', request.error);
        resolve(false);
      };
    } catch (err) {
      console.warn('High score write transaction failed:', err);
      resolve(false);
    }
  });
}

// Retrieves a high score from the localStorage fallback.
function readFallback() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    const value = window.localStorage.getItem(FALLBACK_STORAGE_KEY);
    if (value == null) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  } catch (err) {
    console.warn('Failed to read high score from localStorage:', err);
    return null;
  }
}

// Persists a high score using localStorage as a safety net when IndexedDB is unavailable.
function writeFallback(score) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    window.localStorage.setItem(FALLBACK_STORAGE_KEY, String(score));
    return true;
  } catch (err) {
    console.warn('Failed to write high score to localStorage:', err);
    return false;
  }
}

// Accepts either legacy objects or raw numbers and normalizes them into a numeric score.
function normalizeStoredValue(value) {
  if (value == null) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'object') {
    const extracted = value.value ?? value.score ?? null;
    if (typeof extracted === 'number' && Number.isFinite(extracted)) {
      return extracted;
    }
  }
  return null;
}

/**
 * Retrieve the stored high score. Resolves with `null` if nothing has been saved.
 */
export async function loadHighScore() {
  const db = await openDatabase();
  if (db) {
    const value = await readFromStore(db);
    const normalized = normalizeStoredValue(value);
    if (typeof normalized === 'number') {
      return normalized;
    }
  }
  return readFallback();
}

/**
 * Persist a new high score. Resolves once both IndexedDB (if available) and the
 * fallback store have been updated.
 */
export async function saveHighScore(score) {
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    return false;
  }

  const db = await openDatabase();
  if (db) {
    await writeToStore(db, score);
  }

  writeFallback(score);
  return true;
}

/**
 * Clear cached IndexedDB promise (useful in tests). Not used in runtime logic,
 * but exported for completeness.
 */
export function _resetHighScoreDatabaseCache() {
  dbPromise = null;
}
