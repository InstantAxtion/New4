// Shared helpers for the browser tests.
import { expect } from '@playwright/test';

// Open the game on a clean slate and collect any page errors.
export async function openGame(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#title')).toBeVisible({ timeout: 60_000 });
  return errors;
}

// Start a realm in western Europe, skipping the guide, with plenty of stores.
export async function startRealm(page, { name = 'Testford', tier = 0, rich = true } = {}) {
  return page.evaluate(async ({ name, tier, rich }) => {
    const g = await import('./js/game.js'); const ui = await import('./js/ui.js');
    let x = 1011, y = 944;
    for (let k = 0; k < 400 && !g.canStart(x, y).ok; k++) { x += (k % 7) - 3; y += (k % 11) - 5; }
    g.setSlot(1); g.newGame(name, x, y);
    g.S.tutorial = 99; g.S.hints = ['folk', 'everyday', 'wonders2', 'spec', 'explore']; g.S.settings.zoneHint = true;
    ui.enterGame(false);
    if (rich) Object.assign(g.S.res, { wood: 5000, stone: 5000, food: 5000, gold: 5000, iron: 300 });
    g.S.tier = tier;
    const c = g.S.towns[0];
    return { x: c.x, y: c.y };
  }, { name, tier, rich });
}

// Close any panels that opened by themselves (tier cards, year reports...).
export async function closePanels(page) {
  for (let k = 0; k < 6; k++) {
    const open = await page.evaluate(() => { const b = document.querySelector('#sheet:not(.hidden) [data-act=close]'); if (b) b.click(); return !!b; });
    if (!open) return;
    await page.waitForTimeout(550);
  }
}
