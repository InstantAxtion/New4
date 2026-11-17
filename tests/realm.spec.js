import { test, expect } from '@playwright/test';
import { zoneTownSrc, openGame, startRealm, closePanels } from './helpers.js';

test('a realm grows, builds roads and survives save and load', async ({ page }) => {
  const errors = await openGame(page);
  await startRealm(page, { tier: 1 });
  const r = await page.evaluate(async (src) => {
    const g = await import('./js/game.js'); const L = await import('./js/life.js');
    await (0, eval)(src)(3, 7);
    g.pickResearch('rotation');
    for (let i = 0; i < 1200; i++) g.update(g.DAY_SECONDS / 4);
    L.updateRoads();
    const before = { pop: Math.round(g.totalPop()), buildings: g.S.buildings.size, research: g.S.research.done.length };
    g.save(); g.load(1);
    const after = { pop: Math.round(g.totalPop()), buildings: g.S.buildings.size, research: g.S.research.done.length };
    let under = 0; for (const [i] of L.roads) { const b = g.S.buildings.get(i); if (b && b.t !== 'townhall' && !g.CROSSINGS.has(b.t)) under++; }
    return { before, after, roads: L.roads.size, under };
  }, zoneTownSrc);
  expect(r.before.pop).toBeGreaterThan(20);
  expect(r.after).toEqual(r.before);
  expect(r.roads).toBeGreaterThan(5);
  expect(r.under).toBe(0);
  await closePanels(page);
  expect(errors).toEqual([]);
});

test('an old version-1 save still loads', async ({ page }) => {
  await openGame(page);
  await startRealm(page);
  const ok = await page.evaluate(async () => {
    const g = await import('./js/game.js');
    g.save();
    const d = JSON.parse(localStorage.getItem('hearthlands-slot-1'));
    d.v = 1; delete d.research; delete d.talents; delete d.contracts; delete d.raids;
    localStorage.setItem('hearthlands-slot-1', JSON.stringify(d));
    return g.load(1) && !!g.S.research && Array.isArray(g.S.talents);
  });
  expect(ok).toBe(true);
});

test('a version-2 save with retired zones and town mood loads cleanly', async ({ page }) => {
  const errors = await openGame(page);
  await startRealm(page);
  const r = await page.evaluate(async () => {
    const g = await import('./js/game.js');
    const c = g.S.towns[0], i = (c.y + 4) * 2000 + c.x, j = (c.y + 6) * 2000 + c.x, k = (c.y + 8) * 2000 + c.x;
    g.save();
    const d = JSON.parse(localStorage.getItem('hearthlands-slot-1'));
    d.v = 2; d.zones = [[i, 'pasture'], [j, 'park'], [k, 'shops']]; d.towns[0].mood = { score: 3, level: 1 };
    localStorage.setItem('hearthlands-slot-1', JSON.stringify(d));
    const ok = g.load(1);
    for (let n = 0; n < 40; n++) g.update(g.DAY_SECONDS / 4);
    return { ok, zones: [...g.S.zones.values()].sort(), mood: 'mood' in g.S.towns[0] };
  });
  expect(r.ok).toBe(true);
  expect(r.zones.every((z) => ['housing', 'farmland', 'workshop'].includes(z))).toBe(true);
  expect(r.mood).toBe(false);
  expect(errors).toEqual([]);
});
