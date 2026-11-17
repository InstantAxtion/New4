// Touch / mouse / keyboard camera control and map interaction.
import { cam, clampCam, markDirty, toWorld, pickTile, setHover, cancelFlight, screenSize } from './render.js';
import { M } from './game.js';
import { handleTap, paintAt, endPaint } from './ui.js';

const pointers = new Map();
let dragging = false, downPos = null, pinch = null, painting = false, erasing = false; let lastPt = null;
// Once an S Pen (or any stylus) is used, the pen draws and fingers only move the map.
let penSeen = false;
const penErase = (e) => (e.buttons & 2) !== 0 || (e.buttons & 32) !== 0 || e.button === 2 || e.button === 5;
const TAP_SLOP = 8;

function zoomAt(px, py, factor) {
  const before = toWorld(px, py);
  cam.tw *= factor; clampCam();
  const after = toWorld(px, py);
  cam.x += before.X - after.X; cam.y += before.Y - after.Y;
  clampCam(); markDirty();
}

export function initInput(canvas) {
  canvas.addEventListener('pointerdown', (e) => {
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic or already released */ }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    cancelFlight();
    if (pointers.size === 1) {
      downPos = { x: e.clientX, y: e.clientY, t: performance.now() };
      dragging = false;
      const pen = e.pointerType === 'pen';
      if (pen) penSeen = true;
      const zoneMode = M.mode && M.mode.kind === 'zone';
      erasing = pen && penErase(e);
      painting = zoneMode && (pen || e.pointerType === 'mouse' || !penSeen) && (e.button !== 2 || pen);
      if (painting) { paintAt(pickTile(e.clientX, e.clientY), erasing); lastPt = { x: e.clientX, y: e.clientY }; }
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      painting = false; dragging = true; endPaint();
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) {
      if (e.pointerType === 'mouse' || e.pointerType === 'pen') { if (e.pointerType === 'pen') penSeen = true; setHover(pickTile(e.clientX, e.clientY)); }
      return;
    }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      cam.x -= (mx - pinch.mx) / cam.tw; cam.y -= (my - pinch.my) / cam.tw;
      if (pinch.d > 10) zoomAt(mx, my, d / pinch.d);
      pinch = { d, mx, my };
      return;
    }
    if (!dragging && downPos && Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > TAP_SLOP) dragging = true;
    if (painting) {
      const t = pickTile(e.clientX, e.clientY);
      if (e.pointerType !== 'touch') setHover(t);
      if (e.pointerType === 'pen') erasing = erasing || penErase(e);
      // fill in every tile under a fast stroke, not just where the move events land
      if (lastPt) {
        const dist = Math.hypot(e.clientX - lastPt.x, e.clientY - lastPt.y), n = Math.min(60, Math.ceil(dist / Math.max(4, cam.tw * 0.18)));
        for (let k = 1; k < n; k++) paintAt(pickTile(lastPt.x + (e.clientX - lastPt.x) * k / n, lastPt.y + (e.clientY - lastPt.y) * k / n), erasing);
      }
      paintAt(t, erasing); lastPt = { x: e.clientX, y: e.clientY };
      return;
    }
    if (dragging) {
      cam.x -= dx / cam.tw; cam.y -= dy / cam.tw; clampCam(); markDirty();
    }
    if (e.pointerType !== 'touch') setHover(pickTile(e.clientX, e.clientY));
  });
  const up = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) {
      if (!dragging && downPos && !painting && e.type === 'pointerup') handleTap(e.clientX, e.clientY);
      dragging = false; downPos = null; painting = false; erasing = false; lastPt = null; endPaint();
      if (e.pointerType === 'touch') setHover(null);
    }
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', () => { if (!pointers.size) setHover(null); });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault(); cancelFlight();
    zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
  }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  const keys = new Set();
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    keys.add(e.key.toLowerCase());
    if (e.key === '+' || e.key === '=') { const { cw, ch } = screenSize(); zoomAt(cw / 2, ch / 2, 1.25); }
    if (e.key === '-' || e.key === '_') { const { cw, ch } = screenSize(); zoomAt(cw / 2, ch / 2, 0.8); }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());
  return (dt) => {
    let vx = 0, vy = 0;
    if (keys.has('a') || keys.has('arrowleft')) vx -= 1;
    if (keys.has('d') || keys.has('arrowright')) vx += 1;
    if (keys.has('w') || keys.has('arrowup')) vy -= 1;
    if (keys.has('s') || keys.has('arrowdown')) vy += 1;
    if (vx || vy) { cam.x += (vx * 600 * dt) / cam.tw; cam.y += (vy * 600 * dt) / cam.tw; clampCam(); markDirty(); }
  };
}
