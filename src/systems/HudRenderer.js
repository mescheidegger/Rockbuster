/* ========================= src/systems/HudRenderer.js ========================= */
/**
 * HudRenderer
 * -----------
 * Renders HUD-specific widgets using the core Renderer primitives.
 */
export class HudRenderer {
  /**
   * @param {Renderer} renderer - The core Renderer instance to draw with.
   */
  constructor(renderer) {
    this.renderer = renderer;
    this.ctx = renderer?.ctx;
  }

  /**
   * Draw the HUD mute button.
   * Uses a rounded rectangle background with a simple speaker glyph that toggles between
   * "sound on" (waves) and "muted" (crossed-out speaker).
   */
  muteButton({ x, y, width = 64, height = 44, muted = false } = {}) {
    const { ctx } = this;
    if (!ctx) return;
    ctx.save();

    const radius = Math.min(10, width / 2, height / 2);
    const fillColor = 'rgba(8, 15, 35, 0.7)';
    const borderColor = muted ? 'rgba(252, 165, 165, 0.9)' : 'rgba(217, 226, 255, 0.7)';

    ctx.fillStyle = fillColor;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const centerY = y + height / 2;
    const speakerCenterX = x + width / 2 - 6;

    ctx.fillStyle = '#d9e2ff';
    ctx.beginPath();
    ctx.moveTo(speakerCenterX - 16, centerY - 10);
    ctx.lineTo(speakerCenterX - 6, centerY - 10);
    ctx.lineTo(speakerCenterX + 4, centerY - 18);
    ctx.lineTo(speakerCenterX + 4, centerY + 18);
    ctx.lineTo(speakerCenterX - 6, centerY + 10);
    ctx.lineTo(speakerCenterX - 16, centerY + 10);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = muted ? 'rgba(252, 165, 165, 0.95)' : '#d9e2ff';
    ctx.lineWidth = muted ? 2.4 : 2;

    if (muted) {
      ctx.beginPath();
      ctx.moveTo(speakerCenterX + 10, centerY - 12);
      ctx.lineTo(speakerCenterX + 24, centerY + 12);
      ctx.moveTo(speakerCenterX + 24, centerY - 12);
      ctx.lineTo(speakerCenterX + 10, centerY + 12);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(speakerCenterX + 12, centerY, 10, -Math.PI / 3, Math.PI / 3);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(speakerCenterX + 12, centerY, 18, -Math.PI / 3, Math.PI / 3);
      ctx.stroke();
    }

    ctx.restore();
  }
}
