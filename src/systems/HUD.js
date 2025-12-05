/* ========================= src/systems/HUD.js ========================= */
/**
 * Heads-Up Display (HUD)
 * Renders score, lives, and the current wave number.
 * Also shows GAME OVER messaging when appropriate.
 *
 * NOTE ON WAVE DISPLAY:
 * - Internal state.wave starts at 0 for the first wave.
 * - We present waves to the player as 1-based (Wave 1, Wave 2, ...).
 */
export function drawHUD(renderer, hudRenderer, state, options = {}) {
  // --- Primary HUD (top-left) ---
  const baseX = 16;
  let lineY = 28;

  const scoreValue = typeof state.score === 'number' ? state.score : 0;
  const highScoreValue = typeof state.highScore === 'number' ? state.highScore : 0;

  renderer.text(baseX, lineY, `Score: ${scoreValue.toLocaleString()}`);

  lineY += 24;
  renderer.text(baseX, lineY, `High Score: ${highScoreValue.toLocaleString()}`);

  if (state.lives !== undefined) {
    lineY += 24;
    renderer.text(baseX, lineY, `Lives: ${state.lives}`);
  }

  lineY += 24;
  const waveLabel = `Wave: ${(state.wave + 1).toLocaleString()}`;
  renderer.text(baseX, lineY, waveLabel);

  // --- Game Over Overlay ---
  if (state.mode === 'GAME_OVER') {
    // Centered messages
    renderer.text(480, 240, 'GAME OVER', 48, 'center');
    renderer.text(480, 284, `Final Score: ${state.score}`, 24, 'center');
    renderer.text(480, 320, 'Press Enter to Play Again', 18, 'center');
  }

  if (options.ufoLabel) {
    lineY += 24;
    renderer.text(baseX, lineY, options.ufoLabel);
  }

  const { muteButton } = options;
  if (muteButton && typeof hudRenderer?.muteButton === 'function') {
    hudRenderer.muteButton(muteButton);
  }
}
