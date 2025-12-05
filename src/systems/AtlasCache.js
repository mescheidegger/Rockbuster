/* ========================= src/systems/AtlasCache.js ========================= */
/**
 * AtlasCache
 * ---------
 * Loads and caches sprite atlases (JSON + PNG pairs) so rendering code can
 * simply look up frames by name without worrying about fetch/image lifecycles.
 */
export class AtlasCache {
  constructor(basePaths = []) {
    this.frames = new Map();
    this._atlasLoads = [];
    this._basePaths = basePaths;
  }

  /** Load all atlases configured for this cache. */
  loadAll() {
    this._basePaths.forEach((path) => this.loadAtlas(path));
    return Promise.all(this._atlasLoads).then(() => {});
  }

  /** Load a single atlas given a base path (without extension). */
  loadAtlas(basePath) {
    const jsonUrl = `${basePath}.json`;
    const imageUrl = `${basePath}.png`;

    const image = new Image();
    const imagePromise = new Promise((resolve, reject) => {
      image.onload = () => resolve(image);
      image.onerror = (err) => reject(err);
      image.src = imageUrl;
    });

    const atlasPromise = Promise.all([
      fetch(jsonUrl).then((resp) => {
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.json();
      }),
      imagePromise,
    ]).then(([data, loadedImage]) => {
      const frames = data?.frames ?? {};
      Object.entries(frames).forEach(([name, frame]) => {
        if (!frame?.frame) return;
        this.frames.set(name, { image: loadedImage, frame: frame.frame });
      });
      console.log(`✅ Atlas loaded: ${jsonUrl}`);
    }).catch((err) => {
      console.error(`❌ Failed to load atlas ${jsonUrl}:`, err);
    });

    this._atlasLoads.push(atlasPromise);
    return atlasPromise;
  }

  /** Retrieve a frame entry if it has been loaded. */
  getFrame(name) {
    return this.frames.get(name) ?? null;
  }
}
