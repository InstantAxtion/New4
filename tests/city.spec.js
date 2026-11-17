import { test, expect } from '@playwright/test';
import { zoneTownSrc, openGame, startRealm, closePanels } from './helpers.js';

test('roads first, demand, abandonment, walls, fires and the budget', async ({ page }) => {
  const errors = await openGame(page);
  await startRealm(page, { tier: 1 });
  const r = await page.evaluate(async (src) => {
    const g = await import('./js/game.js'); const L = await import('./js/life.js'); const C = await import('./js/city.js');
    const c = g.S.towns[0];
    // a tile with no road beside it can't be zoned
    let lonely = null;
    for (let dy = -6; dy <= 6 && !lonely; dy++) for (let dx = -6; dx <= 6 && !lonely; dx++) {
      const x = c.x + dx, y = c.y + dy, i = y * 2000 + x;
      if (g.ownerOf(x, y) && !C.hasRoadNear(x, y) && !L.roads.has(i) && !g.S.buildings.has(i) && !g.S.occupied.has(i)) lonely = [x, y];
    }
    const zonedLonely = lonely ? g.setZone('housing', ...lonely) : false;
    const zoned = await (0, eval)(src)(3, 5);
    const dm = C.demand();
    // taxes: higher rate means more gold and less wish to move in
    const b9 = C.budget(); C.setTax(0.18); const b18 = C.budget(); const dm18 = C.demand(); C.setTax(0.09);
    // walls: paint a short run, and it must cost stone
    const stone = g.S.res.stone; let walls = 0;
    for (let dx = -8; dx <= 8; dx++) if (g.setZone('wall', c.x + dx, c.y + 6)) walls++;
    const stoneUsed = stone - g.S.res.stone;
    // let the town grow, then cut a house off from every road and wait
    // no raids while we watch (a raid could burn the house we are testing)
    const calm = () => { g.S.nextRaid = g.S.day + 999; g.S.raids = []; };
    for (let i = 0; i < 400; i++) { calm(); g.update(g.DAY_SECONDS / 4); }
    let house = null; for (const [i, b] of g.S.buildings) if (b.t === 'house' && b.p >= 1 && !b.ab && !b.fire) { house = i; break; }
    const hb = g.S.buildings.get(house);
    const keep = new Map(L.roads), keepP = new Set(g.S.proads);
    const nb = [0, 1, 2, 3].map((d) => { const [nx, ny] = L.stepTile(house % 2000, Math.floor(house / 2000), d); return ny * 2000 + nx; });
    for (const j of nb) { L.roads.delete(j); g.S.proads.delete(j); }
    for (let i = 0; i < 48; i++) { for (const j of nb) { L.roads.delete(j); g.S.proads.delete(j); } calm(); g.update(g.DAY_SECONDS / 4); }
    const abandoned = hb.ab;
    for (const [k, v] of keep) L.roads.set(k, v); for (const k of keepP) g.S.proads.add(k);
    for (let i = 0; i < 8; i++) calm(), g.update(g.DAY_SECONDS / 4);
    const back = hb.ab;
    // a raid that breaks through sets unprotected buildings alight; they burn down to ruins you can rebuild
    const lit = C.raidFires(c, 3);
    let ruin = null; for (let i = 0; i < 20; i++) g.update(g.DAY_SECONDS / 4);
    for (const [i, b] of g.S.buildings) if (b.ab === 'ruin') { ruin = i; break; }
    const repaired = ruin != null && C.repair(ruin);
    return { zonedLonely, zoned, dm, b9: b9.taxes, b18: b18.taxes, h9: dm.housing, h18: dm18.housing, walls, stoneUsed,
      abandoned, back, lit, ruin: ruin != null, repaired, lv: C.landValue(house) };
  }, zoneTownSrc);
  expect(r.zonedLonely).toBe(false);
  expect(r.zoned).toBeGreaterThan(10);
  for (const k of ['housing', 'farmland', 'workshop']) expect(Math.abs(r.dm[k])).toBeLessThanOrEqual(100);
  expect(r.b18).toBeGreaterThan(r.b9);
  expect(r.h18).toBeLessThan(r.h9);
  expect(r.walls).toBeGreaterThan(2);
  expect(r.stoneUsed).toBeGreaterThanOrEqual(r.walls * 3);
  expect(r.abandoned).toBe('road');
  expect(r.back).toBeFalsy();
  expect(r.lit).toBeGreaterThan(0);
  expect(r.ruin).toBe(true);
  expect(r.repaired).toBe(true);
  expect(r.lv).toBeGreaterThanOrEqual(0);
  // the budget sheet opens from the gold counter
  await closePanels(page);
  await page.locator('#res-gold').click();
  await expect(page.locator('#sheet')).toContainText('Tax rate');
  await page.locator('[data-act=taxup]').click();
  await expect(page.locator('.taxv')).toHaveText('10%');
  expect(errors).toEqual([]);
});
