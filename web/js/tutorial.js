// First-time guide: Pip the messenger bird flies to each button you need.
import { S, M } from './game.js';
import { tileWX, tileWY } from './world.js';
import { sx, sy, screenSize } from './render.js';

const $ = (s) => document.querySelector(s);

const zoneOrBuilt = (zone, type) => {
  let n = 0;
  for (const z of S.zones.values()) if (z === zone) n++;
  for (const b of S.buildings.values()) if (b.t === type) n++;
  return n;
};
const has = (type) => { for (const b of S.buildings.values()) if (b.t === type) return true; return false; };
const sheetHas = (sel) => !$('#sheet').classList.contains('hidden') && !!$('#sheetbody ' + sel);

const STEPS = [
  { text: "Hello! I'm <b>Pip</b>, the realm's messenger. Let's plant your first fields. Tap <b>Zones</b>.",
    target: '#bottombar [data-tab=zones]', done: () => M.mode && M.mode.kind === 'zone' },
  { text: 'Pick <b>Farmland</b>.', target: '#modebar [data-arg=farmland]',
    done: () => M.mode && M.mode.kind === 'zone' && M.mode.zone === 'farmland' },
  { text: 'Now paint three or four tiles near your hall. Tap or drag on the land.', target: 'hall',
    done: () => zoneOrBuilt('farmland', 'farm') >= 3 },
  { text: 'Lovely! Families need homes too. Pick <b>Housing</b> and paint a couple of tiles.', target: '#modebar [data-arg=housing]',
    done: () => zoneOrBuilt('housing', 'house') >= 2 },
  { text: "Tap <b>Done</b> when you're happy.", target: '#modebar [data-act=cancelmode]', done: () => !M.mode },
  { text: 'Villagers build what you zone, in their own time. They will need wood, so tap <b>Build</b>.',
    target: '#bottombar [data-tab=build]', done: () => sheetHas('[data-arg=lumber]') || has('lumber') },
  { text: 'Choose the <b>Lumber Camp</b>.', target: '#sheetbody [data-act=pick][data-arg=lumber]',
    done: () => (M.mode && M.mode.kind === 'build') || has('lumber') },
  { text: 'Tap a glowing tile beside the woods.', target: 'hall', done: () => has('lumber') || !M.mode },
  { text: "Your goals live in this scroll, whenever you want them. There's no rush here. Enjoy your realm!",
    target: '#quests .qbtn', button: 'Thanks, Pip!' },
];
export const tutorialActive = () => S.started && S.tutorial < STEPS.length;

const BIRD = `<svg viewBox="0 0 64 56" width="58" height="51" aria-hidden="true">
  <ellipse cx="32" cy="52" rx="13" ry="3" fill="rgba(0,0,0,0.15)"/>
  <g class="pip-wing pip-wing-back"><path d="M30 26 C18 14 6 18 4 26 C14 26 22 30 30 32Z" fill="#8a5a3a"/></g>
  <path d="M46 34 L60 28 L58 38 Z" fill="#7a4a2e"/>
  <ellipse cx="32" cy="32" rx="18" ry="16" fill="#b0784e"/>
  <ellipse cx="29" cy="37" rx="11" ry="10" fill="#f3e2c4"/>
  <circle cx="22" cy="24" r="10" fill="#b0784e"/>
  <circle cx="19" cy="22" r="2.6" fill="#2a1d14"/><circle cx="18.2" cy="21.2" r="0.9" fill="#fff"/>
  <path d="M10 25 L4 27.5 L10 29 Z" fill="#e8a040"/>
  <circle cx="15" cy="27" r="2.2" fill="#e8907a" opacity="0.6"/>
  <path d="M30 44 l-2 7 M34 44 l2 7" stroke="#e8a040" stroke-width="2" stroke-linecap="round"/>
  <g transform="rotate(-18 40 40)"><rect x="34" y="38" width="14" height="5" rx="2.5" fill="#f5e6c4" stroke="#b08a52" stroke-width="0.8"/><rect x="39.5" y="37" width="3" height="7" fill="#c0503e"/></g>
  <g class="pip-wing"><path d="M34 28 C44 16 58 18 60 26 C50 28 42 32 36 36Z" fill="#9a6440"/></g>
</svg>`;

let el = null, bubble = null, ring = null, lastTarget = null, lastStep = -1, sfxFn = null, setModeFn = null;
export function initTutorial(playSfx, setMode) { sfxFn = playSfx; setModeFn = setMode; }

function ensureDom() {
  if (el) return;
  el = document.createElement('div'); el.id = 'pip'; el.innerHTML = BIRD;
  bubble = document.createElement('div'); bubble.id = 'pipsay';
  ring = document.createElement('div'); ring.id = 'pipring';
  document.body.append(ring, el, bubble);
  bubble.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.pip === 'skip') { finish(); return; }
    if (b.dataset.pip === 'next') advance();
  });
}
function finish() {
  S.tutorial = 99;
  for (const n of [el, bubble, ring]) if (n) n.remove();
  el = bubble = ring = null;
  document.querySelectorAll('.tut-target').forEach((n) => n.classList.remove('tut-target'));
}
function advance() {
  S.tutorial++;
  // The last step points at the goals scroll, which is hidden while placing buildings.
  if (STEPS[S.tutorial] && STEPS[S.tutorial].target === '#quests .qbtn' && M.mode && setModeFn) setModeFn(null);
  if (sfxFn) sfxFn('quest');
  if (S.tutorial >= STEPS.length) finish();
}

// Called every frame.
export function updateTutorial() {
  if (!tutorialActive() || $('#hud').classList.contains('hidden')) { if (el && !tutorialActive()) finish(); return; }
  ensureDom();
  const step = STEPS[S.tutorial];
  if (!step.button && step.done()) { advance(); return; }

  if (lastStep !== S.tutorial) {
    lastStep = S.tutorial;
    bubble.innerHTML = `<div>${step.text}</div><div class="pipbtns"><button data-pip="skip">Skip guide</button>${step.button ? `<button data-pip="next" class="primary">${step.button}</button>` : ''}</div>`;
    el.classList.add('flying'); setTimeout(() => el && el.classList.remove('flying'), 900);
  }
  // Locate the target on screen.
  const { cw, ch } = screenSize();
  let rect = null;
  document.querySelectorAll('.tut-target').forEach((n) => { if (n !== lastTarget) n.classList.remove('tut-target'); });
  if (step.target === 'hall') {
    const t = S.towns.find((q) => q.capital) || S.towns[0];
    if (t) {
      const x = sx(tileWX(t.x, t.y)), y = sy(tileWY(t.y));
      rect = { left: x - 60, top: y - 30, width: 120, height: 60 };
      ring.style.cssText = `display:block;left:${x - 70}px;top:${y - 35}px;width:140px;height:70px;border-radius:50%`;
    }
  } else {
    ring.style.display = 'none';
    const tgt = $(step.target);
    if (tgt && tgt.offsetParent !== null) {
      const r = tgt.getBoundingClientRect();
      if (r.width) rect = r;
      if (lastTarget !== tgt) { if (lastTarget) lastTarget.classList.remove('tut-target'); tgt.classList.add('tut-target'); lastTarget = tgt; }
    }
  }
  if (!rect) rect = { left: cw / 2 - 20, top: ch * 0.55, width: 40, height: 40 };

  // Perch the bird just beside the target, and the speech bubble on the roomier side.
  // For map steps Pip waits near the top so the land stays clear for tapping.
  let below = rect.top + rect.height / 2 < ch / 2;
  let bx = rect.left + rect.width / 2 - 29 + (rect.left + rect.width / 2 > cw / 2 ? -40 : 40);
  let by = below ? rect.top + rect.height + 6 : rect.top - 58;
  if (step.target === 'hall') {
    const hud = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hud-bottom')) || 110;
    below = true; bx = 12; by = hud + 4;
  }
  bx = Math.max(6, Math.min(cw - 64, bx)); by = Math.max(6, Math.min(ch - 60, by));
  el.style.transform = `translate(${bx}px, ${by}px)`;
  el.classList.toggle('face-right', rect.left + rect.width / 2 > bx + 29);
  const bw = Math.min(290, cw - 24);
  const bxx = Math.max(12, Math.min(cw - bw - 12, bx + 29 - bw / 2));
  bubble.style.width = bw + 'px';
  bubble.style.transform = below ? `translate(${bxx}px, ${by + 60}px)` : `translate(${bxx}px, ${by - 8}px) translateY(-100%)`;
}

