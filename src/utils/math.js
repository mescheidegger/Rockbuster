/* ========================= src/utils/math.js ========================= */
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const wrap = (v, max) => (v < 0 ? v + max : v >= max ? v - max : v);
export const randRange = (a, b) => a + Math.random() * (b - a);
export const randSign = () => (Math.random() < 0.5 ? -1 : 1);
export const len2 = (x, y) => Math.hypot(x, y);
export const angleToVec = a => ({ x: Math.cos(a), y: Math.sin(a) });