/* ========================= src/main.js ========================= */
import { Game } from './core/Game.js';
import { CONFIG } from './config.js';
import { MenuOverlay } from './ui/MenuOverlay.js';
import { GameOverOverlay } from './ui/GameOverOverlay.js';
import { DebugConsoleOverlay } from './ui/DebugConsoleOverlay.js';
import { AtlasCache } from './systems/AtlasCache.js';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}

const ATLAS_BASE_PATHS = [
  './assets/sprites/shipsandufos',
  './assets/sprites/Damage/damage',
  './assets/sprites/Effects/effects',
  './assets/sprites/Enemies/enemies',
  './assets/sprites/Lasers/lasers',
  './assets/sprites/Meteors/meteors',
  './assets/sprites/Parts/parts',
  './assets/sprites/Power-ups/power-ups',
  './assets/sprites/UI/ui',
];

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Tunables:
// - MAX_DISPLAY_SCALE: cap how large the canvas appears on screen (relative to 960×540)
// - MAX_RENDER_SCALE:  cap how much extra internal resolution we render at on big screens
const MAX_DISPLAY_SCALE = 2.0;   // e.g., on a huge monitor don't exceed 1920×1080 visual size
const MAX_RENDER_SCALE  = 2.0;   // render up to 2× internal resolution for sharpness

function computeDisplayScale() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const W = CONFIG.CANVAS.W;
  const H = CONFIG.CANVAS.H;

  // Scale to fit viewport while preserving aspect ratio
  const fitScale = Math.min(vw / W, vh / H);

  // Optional: cap how big it gets on desktop
  const displayScale = Math.min(fitScale, MAX_DISPLAY_SCALE);

  return displayScale;
}

function setupCanvasSizes() {
  const W = CONFIG.CANVAS.W;
  const H = CONFIG.CANVAS.H;

  // How big we show the canvas (CSS pixels)
  const displayScale = computeDisplayScale();
  const cssW = Math.floor(W * displayScale);
  const cssH = Math.floor(H * displayScale);
  canvas.style.width  = cssW + 'px';
  canvas.style.height = cssH + 'px';

  // Backing store: render sharper on large canvases
  // - DPR: device pixel ratio (retina)
  // - renderScale: grow with displayScale, but cap for perf
  const DPR = window.devicePixelRatio || 1;
  const renderScale = Math.min(displayScale, MAX_RENDER_SCALE);

  // Physical pixel buffer
  canvas.width  = Math.round(W * DPR * renderScale);
  canvas.height = Math.round(H * DPR * renderScale);

  // Map logical units → pixels:
  // We scale drawing ops by (DPR * renderScale), so all your game math
  // continues to use logical W×H coordinates (960×540).
  ctx.setTransform(DPR * renderScale, 0, 0, DPR * renderScale, 0, 0);
}

function handleResize() {
  setupCanvasSizes();
}

const debugOverlayConfig = CONFIG.DEBUG?.CONSOLE_OVERLAY;
if (debugOverlayConfig?.ENABLED) {
  new DebugConsoleOverlay({
    maxEntries: debugOverlayConfig.MAX_ENTRIES,
    includeTimestamp: debugOverlayConfig.INCLUDE_TIMESTAMP
  });
}

setupCanvasSizes();
window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', handleResize);

async function start() {
  const atlasCache = new AtlasCache(ATLAS_BASE_PATHS);
  await atlasCache.loadAll();

  const game = new Game(canvas, ctx, { atlasCache });
  const menuOverlay = new MenuOverlay(game);
  new GameOverOverlay(game, {
    onReturnToMenu: () => {
      menuOverlay?.show?.('start');
    }
  });

  game.start();
}

start().catch((err) => {
  console.error('Failed to start game:', err);
});
