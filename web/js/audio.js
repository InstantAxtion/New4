// Gentle generative music, nature ambience and soft UI sounds via WebAudio.
import { S } from './game.js';

let weatherBus = null;
let ac = null, master, musicBus, sfxBus, natureBus, reverb, started = false;
const PENTA = [0, 2, 4, 7, 9];
const CHORDS = [[0, 4, 7, 11], [5, 9, 12, 16], [-3, 0, 4, 7], [2, 5, 9, 12], [7, 11, 14, 17], [-5, -1, 2, 7]];
const PROG = [0, 1, 2, 3, 0, 1, 4, 5];
const BASE = 57; // A3 midi
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function makeReverb() {
  const len = ac.sampleRate * 3.2, buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  const conv = ac.createConvolver(); conv.buffer = buf; return conv;
}

export function initAudio() {
  if (started) return;
  try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  started = true;
  master = ac.createGain(); master.gain.value = 0.8; master.connect(ac.destination);
  reverb = makeReverb(); const rv = ac.createGain(); rv.gain.value = 0.55; reverb.connect(rv); rv.connect(master);
  musicBus = ac.createGain(); musicBus.connect(master); musicBus.connect(reverb);
  natureBus = ac.createGain(); natureBus.connect(master);
  weatherBus = ac.createGain(); weatherBus.connect(master);
  sfxBus = ac.createGain(); sfxBus.connect(master); sfxBus.connect(reverb);
  applySettings();
  scheduleMusic();
  startNature();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) ac.suspend(); else ac.resume();
  });
}
export function resumeAudio() { if (ac && ac.state === 'suspended') ac.resume(); }
// Volume channels (0..1 each), adjustable with sliders in Settings.
export const VOLUMES = [['master', 'Master volume'], ['music', 'Music'], ['nature', 'Nature & town sounds'], ['rain', 'Rain & storms'], ['sfx', 'Sound effects']];
export function vol(k) {
  const v = S.settings.vol || {};
  if (v[k] !== undefined) return v[k];
  return { master: 0.8, music: S.settings.music === false ? 0 : 0.8, nature: S.settings.music === false ? 0 : 0.8, rain: 0.4, sfx: S.settings.sfx === false ? 0 : 0.8 }[k];
}
export function applySettings() {
  if (!ac) return;
  const t = ac.currentTime;
  master.gain.setTargetAtTime(vol('master'), t, 0.1);
  musicBus.gain.setTargetAtTime(0.28 * vol('music'), t, 0.3);
  natureBus.gain.setTargetAtTime(0.62 * vol('nature'), t, 0.3);
  weatherBus.gain.setTargetAtTime(vol('rain'), t, 0.3);
  sfxBus.gain.setTargetAtTime(0.62 * vol('sfx'), t, 0.05);
}

function pad(freq, t, dur, vol = 0.08) {
  for (const det of [-6, 6]) {
    const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = freq; o.detune.value = det;
    f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 0.3;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.35); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(f); f.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur + 0.1);
  }
}
function pluck(freq, t, vol = 0.12, bus = musicBus, len = 2.2) {
  const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain();
  o.type = 'sine'; o.frequency.value = freq; o2.type = 'sine'; o2.frequency.value = freq * 2.005;
  const g2 = ac.createGain(); g2.gain.value = 0.25;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, t + len);
  o.connect(g); o2.connect(g2); g2.connect(g); g.connect(bus);
  o.start(t); o2.start(t); o.stop(t + len + 0.2); o2.stop(t + len + 0.2);
}

let bar = 0, nextBar = 0;
function scheduleMusic() {
  const BAR = 6.5;
  const loop = () => {
    if (!ac) return;
    const now = ac.currentTime;
    if (nextBar < now + 0.5) {
      const t = Math.max(nextBar, now + 0.05);
      const chord = CHORDS[PROG[bar % PROG.length]];
      chord.slice(0, 3).forEach((n, k) => pad(mtof(BASE + n - 12 + (k === 0 ? 0 : 0)), t, BAR + 1.5, 0.05));
      pad(mtof(BASE + chord[0] - 24), t, BAR + 1.5, 0.05);
      // melody: a few pentatonic notes, sparse and unhurried
      const notes = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < notes; i++) {
        if (Math.random() < 0.3) continue;
        const deg = PENTA[Math.floor(Math.random() * PENTA.length)];
        const oct = Math.random() < 0.3 ? 24 : 12;
        pluck(mtof(BASE + chord[0] % 12 + deg + oct), t + (i * BAR) / notes + Math.random() * 0.3, 0.07);
      }
      nextBar = t + BAR; bar++;
    }
    setTimeout(loop, 400);
  };
  loop();
}

function startNature() {
  // soft wind from filtered noise
  const len = ac.sampleRate * 4, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  let last = 0; for (let i = 0; i < len; i++) { last = (last + (Math.random() * 2 - 1) * 0.02) * 0.995; d[i] = last * 3; }
  const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
  const g = ac.createGain(); g.gain.value = 0.35;
  const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 0.2; lfo.connect(lg); lg.connect(g.gain); lfo.start();
  src.connect(f); f.connect(g); g.connect(natureBus); src.start();
  const birds = () => {
    if (!ac) return;
    // birdsong by day (quieter in the rain), crickets at night
    if (!document.hidden) {
      if (amb.night > 0.6) { if (Math.random() < 0.8) crickets(); if (Math.random() < 0.08) owl(); }
      else if (Math.random() < (0.45 + (amb.forest || 0) * 0.5) * (1 - amb.rain * 0.7)) { chirp(); if ((amb.forest || 0) > 0.5 && Math.random() < 0.5) setTimeout(chirp, 500); }
      if (amb.night < 0.6 && (amb.town || 0) > 0.3 && Math.random() < amb.town * 0.7) { tap(); setTimeout(tap, 380); }
    }
    setTimeout(birds, (amb.night > 0.6 ? 1500 : 2500) + Math.random() * 6000);
  };
  birds();
  // soft rain: brighter filtered noise whose volume follows the weather
  const rlen = ac.sampleRate * 3, rbuf = ac.createBuffer(1, rlen, ac.sampleRate), rd = rbuf.getChannelData(0);
  for (let i = 0; i < rlen; i++) rd[i] = Math.random() * 2 - 1;
  const rsrc = ac.createBufferSource(); rsrc.buffer = rbuf; rsrc.loop = true;
  const rf = ac.createBiquadFilter(); rf.type = 'bandpass'; rf.frequency.value = 1400; rf.Q.value = 0.4;
  rainGain = ac.createGain(); rainGain.gain.value = 0;
  rsrc.connect(rf); rf.connect(rainGain); rainGain.connect(weatherBus); rsrc.start();
}
const amb = { night: 0, rain: 0, forest: 0 };
// ---- soundscape that follows what is on screen ----
const scene = {};
function loopNoise(seconds, shape) {
  const len = ac.sampleRate * seconds, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = shape === 'brown' ? (last + w * 0.02) * 0.995 : w; d[i] = shape === 'brown' ? last * 3 : w; }
  const src = ac.createBufferSource(); src.buffer = buf; src.loop = true; return src;
}
function buildScene() {
  if (scene.ready || !ac) return; scene.ready = true;
  const mk = (src, type, freq, q) => { const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = ac.createGain(); g.gain.value = 0; src.connect(f); f.connect(g); g.connect(natureBus); src.start(); return { g, f }; };
  scene.sea = mk(loopNoise(5, 'white'), 'lowpass', 700, 0.5);
  const swell = ac.createOscillator(), sg = ac.createGain(); swell.frequency.value = 0.12; sg.gain.value = 300; swell.connect(sg); sg.connect(scene.sea.f.frequency); swell.start();
  scene.river = mk(loopNoise(3, 'white'), 'bandpass', 2200, 1.6);
  const bub = ac.createOscillator(), bg = ac.createGain(); bub.frequency.value = 3.3; bg.gain.value = 700; bub.connect(bg); bg.connect(scene.river.f.frequency); bub.start();
  scene.town = mk(loopNoise(4, 'brown'), 'bandpass', 420, 0.9);
}
export function setScene(sea, river, town, forest) {
  if (!ac) return; buildScene();
  const t = ac.currentTime, on = 1;
  scene.sea.g.gain.setTargetAtTime(sea * 0.22 * on, t, 1.2);
  scene.river.g.gain.setTargetAtTime(river * 0.06 * on, t, 1.2);
  scene.town.g.gain.setTargetAtTime(town * 0.18 * on * (1 - amb.night * 0.7), t, 1.2);
  amb.forest = forest; amb.town = town;
}
function tap() { // a distant hammer in town
  const t = ac.currentTime + 0.02, o = ac.createOscillator(), g = ac.createGain();
  o.type = 'triangle'; o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(300, t + 0.05);
  g.gain.setValueAtTime(0.025, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.09);
  o.connect(g); g.connect(natureBus); o.start(t); o.stop(t + 0.1);
}
function owl() {
  const t = ac.currentTime + 0.05;
  [0, 0.45, 0.62].forEach((d, k) => {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(k ? 420 : 380, t + d); o.frequency.linearRampToValueAtTime(k ? 360 : 340, t + d + 0.3);
    g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(0.05, t + d + 0.06); g.gain.exponentialRampToValueAtTime(0.0005, t + d + (k === 2 ? 0.7 : 0.35));
    o.connect(g); g.connect(natureBus); o.start(t + d); o.stop(t + d + 0.8);
  });
}
export function thunder() {
  if (!ac || vol('rain') <= 0) return;
  const src = loopNoise(3, 'brown'), f = ac.createBiquadFilter(), g = ac.createGain(), t = ac.currentTime;
  f.type = 'lowpass'; f.frequency.value = 160; src.connect(f); f.connect(g); g.connect(weatherBus);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.9, t + 0.15); g.gain.exponentialRampToValueAtTime(0.001, t + 2.8);
  src.start(t); src.stop(t + 3);
}
let rainGain = null;
// Called from the game loop with the current darkness (0..1) and rain (0..1).
export function setAmbience(night, rain) {
  amb.night = night; amb.rain = rain;
  if (rainGain && ac) rainGain.gain.setTargetAtTime(rain * 0.22, ac.currentTime, 1.5);
}
function crickets() {
  const t = ac.currentTime + 0.05, f = 4200 + Math.random() * 600, pan = Math.random() * 1.4 - 0.7;
  for (let r = 0; r < 3; r++) for (let i = 0; i < 3; i++) {
    const o = ac.createOscillator(), g = ac.createGain(), st = t + r * 0.32 + i * 0.045;
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(0.012, st + 0.008); g.gain.exponentialRampToValueAtTime(0.0003, st + 0.035);
    const p = ac.createStereoPanner ? ac.createStereoPanner() : null;
    if (p) { p.pan.value = pan; o.connect(g); g.connect(p); p.connect(natureBus); } else { o.connect(g); g.connect(natureBus); }
    o.start(st); o.stop(st + 0.05);
  }
}
function chirp() {
  const t = ac.currentTime + 0.05, n = 2 + Math.floor(Math.random() * 4), base = 2600 + Math.random() * 1600;
  for (let i = 0; i < n; i++) {
    const o = ac.createOscillator(), g = ac.createGain(), st = t + i * (0.09 + Math.random() * 0.05);
    o.type = 'sine';
    o.frequency.setValueAtTime(base, st); o.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.4), st + 0.05);
    o.frequency.exponentialRampToValueAtTime(base * 0.9, st + 0.08);
    g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(0.025, st + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, st + 0.09);
    const p = ac.createStereoPanner ? ac.createStereoPanner() : null;
    if (p) { p.pan.value = Math.random() * 1.6 - 0.8; o.connect(g); g.connect(p); p.connect(natureBus); } else { o.connect(g); g.connect(natureBus); }
    o.start(st); o.stop(st + 0.12);
  }
}

// ---- sound effects ----
export function sfx(kind) {
  if (!ac || vol('sfx') <= 0) return;
  resumeAudio();
  const t = ac.currentTime + 0.01;
  if (kind === 'tap') { pluck(mtof(BASE + 24 + 7), t, 0.016, sfxBus, 0.35); }
  else if (kind === 'place') {
    // soft wooden "tok"
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(320, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.12);
    g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.2);
    pluck(mtof(BASE + 19), t + 0.02, 0.06, sfxBus);
  } else if (kind === 'built') { pluck(mtof(BASE + 24), t, 0.06, sfxBus); pluck(mtof(BASE + 28), t + 0.08, 0.05, sfxBus); }
  else if (kind === 'quest') { [0, 4, 7, 12].forEach((n, i) => pluck(mtof(BASE + 12 + n), t + i * 0.09, 0.08, sfxBus)); }
  else if (kind === 'tier') { [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => pluck(mtof(BASE + n), t + i * 0.11, 0.09, sfxBus)); }
  else if (kind === 'coin') { pluck(mtof(BASE + 31), t, 0.06, sfxBus); pluck(mtof(BASE + 36), t + 0.07, 0.05, sfxBus); }
  else if (kind === 'error') { pluck(mtof(BASE + 2), t, 0.06, sfxBus); pluck(mtof(BASE + 1), t + 0.1, 0.05, sfxBus); }
}

// ---- haptics ----
export function haptic(strength = 'light') {
  if (!S.settings.haptics) return;
  const cap = window.Capacitor;
  const H = cap && cap.Plugins && cap.Plugins.Haptics;
  if (H && cap.isNativePlatform && cap.isNativePlatform()) {
    H.impact({ style: strength === 'medium' ? 'MEDIUM' : 'LIGHT' }).catch(() => {});
  } else if (navigator.vibrate) {
    try { navigator.vibrate(strength === 'medium' ? 25 : 12); } catch (e) { /* ignore */ }
  }
}
