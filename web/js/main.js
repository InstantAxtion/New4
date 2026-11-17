// Boot sequence and main loop.
import { generateWorld } from './world.js';
import { buildSprites } from './sprites.js';
import { S, update, save, loadSettings, townStyleOf, on, count } from './game.js';
import { initRender, frame, cam, clampCam, markDirty } from './render.js';
import { initInput } from './input.js';
import { initUI, showTitle, setMode, applyVisuals } from './ui.js';
import { initTutorial, updateTutorial } from './tutorial.js';
import './folk.js';
import './explore.js';
import './stories.js';
import './war.js';
import './city.js';
import './records.js';
import { sfx, setAmbience, setScene, thunder, setMusicMood, bells } from './audio.js';
import { seasonIndex, CYCLE } from './seasons.js';
import { tileLat } from './world.js';
import { onScene } from './render.js';
import { onThunder } from './alive.js';
import { buildSnowMasks, daylight, weather } from './life.js';

const $ = (s) => document.querySelector(s);
const progress = (p, msg) => { $('#loadfill').style.width = `${Math.round(p * 100)}%`; if (msg) $('#loadmsg').textContent = msg; };

async function boot() {
  loadSettings(); applyVisuals();
  const cap = window.Capacitor;
  if (cap && cap.isNativePlatform && cap.isNativePlatform()) document.body.classList.add('native');
  progress(0.01, 'Sharpening quills…');
  await new Promise((r) => setTimeout(r, 30));
  buildSprites();
  await generateWorld(progress);
  buildSnowMasks();
  const canvas = $('#map');
  initRender(canvas);
  const keyPan = initInput(canvas);
  initUI();
  initTutorial(sfx, setMode);
  onScene(setScene); onThunder(thunder);
  showTitle();

  let last = performance.now(), lastMood = 0, lastNoon = -1;
  const loop = (now) => {
    const dt = Math.min(0.25, (now - last) / 1000); last = now;
    keyPan(dt);
    if (!S.started && !document.querySelector('#title').classList.contains('hidden')) { cam.x += dt * 3 / Math.max(1, cam.tw); clampCam(); markDirty(); }
    update(dt);
    frame(now);
    updateTutorial();
    if (S.started) setAmbience(daylight().n, weather.rain);
    if (S.started && now - lastMood > 5000) { // the music follows the capital's region and season; bells ring at noon
      lastMood = now;
      const cap = S.towns.find((t) => t.capital) || S.towns[0];
      if (cap) setMusicMood(townStyleOf(cap), seasonIndex(S.day, tileLat(cap.y)));
    }
    if (S.started) {
      const noon = Math.floor(S.day / CYCLE + 0.65);
      if (lastNoon >= 0 && noon !== lastNoon && (count('chapel') || count('cathedral') || count('monastery')) && !S.settings.nonight) bells(3);
      lastNoon = noon;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  on('festival', ({ f }) => { if (f && f.key === 'wedding') bells(5); });
  on('folk', (txt) => { if (/married/.test(txt)) bells(4); });

  setInterval(() => { if (S.started) save(); }, 15000);
  document.addEventListener('visibilitychange', () => { if (document.hidden && S.started) save(); });
  window.addEventListener('pagehide', () => { if (S.started) save(); });
}

boot().catch((e) => {
  console.error(e);
  progress(1, 'Something went wrong while drawing the world: ' + e.message);
});
