import { test, expect } from '@playwright/test';
import { openGame } from './helpers.js';

test('the game boots to the main menu without errors', async ({ page }) => {
  const errors = await openGame(page);
  await expect(page.locator('#titlebtns')).toContainText('New Realm');
  expect(errors).toEqual([]);
});

test('every content table is consistent', async ({ page }) => {
  await openGame(page);
  const problems = await page.evaluate(async () => {
    const g = await import('./js/game.js'); const out = [];
    for (const [k, z] of Object.entries(g.ZONES)) if (!g.DEFS[z.builds]) out.push(`zone ${k} builds unknown ${z.builds}`);
    for (const r of g.RESEARCH) {
      for (const q of r.req) if (!g.RESEARCH.some((x) => x.id === q)) out.push(`research ${r.id} needs unknown ${q}`);
      for (const u of r.unlocks || []) if (!g.DEFS[u]) out.push(`research ${r.id} unlocks unknown ${u}`);
    }
    for (const [k, d] of Object.entries(g.DEFS)) {
      if (d.research && !g.RESEARCH.some((x) => x.id === d.research)) out.push(`building ${k} needs unknown research ${d.research}`);
      for (const r of Object.keys({ ...d.cost, ...d.prod, ...d.use })) if (!g.RES_NAMES[r]) out.push(`building ${k} uses unknown resource ${r}`);
    }
    for (const c of g.CHAPTERS) for (const id of c.goals) if (!g.QUESTS.some((q) => q.id === id)) out.push(`chapter ${c.id} lists unknown goal ${id}`);
    const ids = new Set(); for (const r of g.RESEARCH) { if (ids.has(r.id)) out.push(`duplicate research ${r.id}`); ids.add(r.id); }
    return out;
  });
  expect(problems).toEqual([]);
});
