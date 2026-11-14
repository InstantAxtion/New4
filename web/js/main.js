// Boot sequence and main loop.
import { generateWorld } from './world.js';
import { buildSprites } from './sprites.js';
import { S, update, save, loadSettings, recomputeTowns } from './game.js';
import { initRender, frame, cam, clampCam, markDirty } from './render.js';
import { initInput } from './input.js';
import { initUI, showTitle } from './ui.js';

const $ = (s) => document.querySelector(s);
const progress = (p, msg) => { $('#loadfill').style.width = `${Math.round(p * 100)}%`; if (msg) $('#loadmsg').textContent = msg; };

async function boot() {
  loadSettings();
  progress(0.01, 'Sharpening quills…');
  await new Promise((r) => setTimeout(r, 30));
  buildSprites();
  await generateWorld(progress);
  const canvas = $('#map');
  initRender(canvas);
  const keyPan = initInput(canvas);
  initUI();
  showTitle();

  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.25, (now - last) / 1000); last = now;
    keyPan(dt);
    if (!S.started && !document.querySelector('#title').classList.contains('hidden')) { cam.x += dt * 3 / Math.max(1, cam.tw); clampCam(); markDirty(); }
    update(dt);
    frame(now);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  setInterval(() => { if (S.started) save(); }, 15000);
  document.addEventListener('visibilitychange', () => { if (document.hidden && S.started) save(); });
  window.addEventListener('pagehide', () => { if (S.started) save(); });
}

boot().catch((e) => {
  console.error(e);
  progress(1, 'Something went wrong while drawing the world: ' + e.message);
});
