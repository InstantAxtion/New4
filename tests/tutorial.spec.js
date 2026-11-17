import { test, expect } from '@playwright/test';
import { openGame } from './helpers.js';

// Plays a brand new realm through Pip's first-time guide by tapping like a person would.
test('Pip guides a new player from the first field to the lumber camp', async ({ page }) => {
  const p = page;
  const errs = await openGame(page);
  const step = async () => p.evaluate(async () => { const g = await import('./js/game.js'); return g.S.tutorial; });
  await p.locator('[data-m="new"]').tap(); await p.fill('#rname','Pipton'); await p.tap('#tgo'); await p.waitForTimeout(1300);
  await p.evaluate(async()=>{const r=await import('./js/render.js');r.centerOn(Math.round((2.5+180)/360*2000),Math.round((90-47)/180*4000),12);});
  await p.waitForTimeout(300); await p.tap('#map',{position:{x:206,y:445}}); await p.waitForTimeout(900); await p.tap('[data-reg=go]');
  await p.waitForTimeout(3000);
  
  await p.tap('#bottombar [data-tab=zones]'); await p.waitForTimeout(1000); 
  await p.tap('#modebar [data-arg=farmland]'); await p.waitForTimeout(1000); 
  // paint around the hall by tapping tiles
  const pts=await p.evaluate(async()=>{const g=await import('./js/game.js');const r=await import('./js/render.js');const w=await import('./js/world.js');const c=g.S.towns[0];const out=[];
   for(const [dx,dy] of [[0,2],[1,2],[0,4],[-1,2],[1,4],[0,-2],[1,-2]]){if(g.canZone(c.x+dx,c.y+dy))out.push({x:r.sx(w.tileWX(c.x+dx,c.y+dy)),y:r.sy(w.tileWY(c.y+dy))});}return out;});
  for(const q of pts.slice(0,4)) {await p.tap('#map',{position:q}); await p.waitForTimeout(150);}
  await p.waitForTimeout(800); 
  await p.tap('#modebar [data-arg=housing]'); await p.waitForTimeout(300);
  const pts2=await p.evaluate(async()=>{const g=await import('./js/game.js');const r=await import('./js/render.js');const w=await import('./js/world.js');const c=g.S.towns[0];const out=[];
   for(let dy=-3;dy<=3;dy++)for(let dx=-2;dx<=2;dx++){if(g.canZone(c.x+dx,c.y+dy))out.push({x:r.sx(w.tileWX(c.x+dx,c.y+dy)),y:r.sy(w.tileWY(c.y+dy))});}return out.filter(q=>q.y<600);});
  for(const q of pts2.slice(0,3)) {await p.tap('#map',{position:q}); await p.waitForTimeout(150);}
  await p.waitForTimeout(800); 
  await p.tap('#modebar [data-act=cancelmode]'); await p.waitForTimeout(1000); 
  await p.tap('#bottombar [data-tab=build]'); await p.waitForTimeout(1000); 
  await p.locator('[data-act=pick][data-arg=lumber]').tap(); await p.waitForTimeout(1500); 
  const lp=await p.evaluate(async()=>{const g=await import('./js/game.js');const r=await import('./js/render.js');const w=await import('./js/world.js');const c=g.S.towns[0];
   for(let dy=-10;dy<=10;dy++)for(let dx=-5;dx<=5;dx++)if(g.canPlace('lumber',c.x+dx,c.y+dy).ok)return {x:r.sx(w.tileWX(c.x+dx,c.y+dy)),y:r.sy(w.tileWY(c.y+dy))};return null;});
  if(lp && lp.x>0 && lp.y>0 && lp.x<412 && lp.y<891) await p.tap('#map',{position:lp}); else await p.tap('#modebar [data-act=cancelmode]');
  await p.waitForTimeout(1200); 
  await p.locator('#pipsay [data-pip=next]').tap(); await p.waitForTimeout(400); 
  await p.tap('#quests .qbtn'); await p.waitForTimeout(300); 
  expect(await step()).toBe(99);
  expect(errs).toEqual([]);
});
