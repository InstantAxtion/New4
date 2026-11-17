import { test, expect } from '@playwright/test';
import { zoneTownSrc, openGame, startRealm } from './helpers.js';

test('research, talents, skills and storage work together', async ({ page }) => {
  const errors = await openGame(page);
  await startRealm(page, { tier: 2 });
  const r = await page.evaluate(async (src) => {
    const g = await import('./js/game.js'); const c = g.S.towns[0];
    const lockedPotter = g.canPlace('potter', c.x + 3, c.y + 3).reason;
    await (0, eval)(src)(3, 6);
    g.pickResearch('tools');
    for (let i = 0; i < 1600; i++) g.update(g.DAY_SECONDS / 4);
    const talent = g.takeTalent('bounty');
    const t = g.S.towns[0];
    return { lockedPotter, learned: g.S.research.done, talent, farmSkill: t.jobSkill && t.jobSkill.farm, foodCap: g.storeCap('food') };
  }, zoneTownSrc);
  expect(r.lockedPotter).toContain('research');
  expect(r.learned).toContain('tools');
  expect(r.talent).toBe(true);
  expect(r.farmSkill).toBeGreaterThan(0);
  expect(r.foodCap).toBeGreaterThan(300);
  expect(errors).toEqual([]);
});

test('raids can be held off and an army can take a village', async ({ page }) => {
  const errors = await openGame(page);
  await startRealm(page, { tier: 1 });
  const r = await page.evaluate(async () => {
    const g = await import('./js/game.js'); const W = await import('./js/war.js'); const c = g.S.towns[0];
    for (let r2 = 2; r2 <= 10; r2++) for (let dy = -2 * r2; dy <= 2 * r2; dy++) for (let dx = -r2; dx <= r2; dx++) g.placeBuilding('barracks', c.x + dx, c.y + dy);
    for (let i = 0; i < 1600; i++) g.update(g.DAY_SECONDS / 4);
    const fought = (g.S.stats.raidsRepelled || 0) + (g.S.stats.raidsLost || 0);
    W.muster(20); if (g.S.army) g.S.army.n = 300;
    const target = W.targets()[0];
    let won = 0;
    if (target && W.marchAttack(target.id)) { for (let i = 0; i < 600 && g.S.army && g.S.army.march; i++) g.update(g.DAY_SECONDS / 4); won = g.S.stats.battlesWon || 0; }
    return { fought, garrison: Math.round(g.S.towns[0].garrison || 0), target: !!target, won };
  });
  expect(r.fought).toBeGreaterThan(0);
  expect(r.garrison).toBeGreaterThan(0);
  if (r.target) expect(r.won).toBe(1);
  expect(errors).toEqual([]);
});
