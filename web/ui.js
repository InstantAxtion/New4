
/* Port City — UI, rendering and input. Depends on core.js. */
const SAVE_KEY = 'portcity_save_v1', BEST_KEY = 'portcity_best_v1', SEEN_KEY='portcity_seen_help';
let S = null, undoStack = [], curTab = 'build', prevStats = null;
const $ = id => document.getElementById(id);

function store(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
function load(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
function wipe(k){ try{ localStorage.removeItem(k); }catch(e){} }
function save(){ if (S) store(SAVE_KEY, JSON.stringify(S)); }

function fmtMoney(v){
  const a = Math.abs(v), sg = v<0?'−':'';
  if (a >= 1000) return sg+'$'+(a/1000).toFixed(a>=10000?0:1)+'B';
  if (a >= 100) return sg+'$'+a.toFixed(0)+'M';
  return sg+'$'+a.toFixed(1)+'M';
}
function fmtTEU(k){ if (k >= 1000) return (k/1000).toFixed(k>=10000?1:2)+'M'; return Math.round(k)+'k'; }
function fmtPop(k){ if (k >= 1000) return (k/1000).toFixed(2)+'M'; return Math.round(k)+'k'; }

let toastT;
function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'),2200); }

function showScreen(name){
  const game = name==='game';
  $('title').classList.toggle('hidden', game);
  ['topbar','main','bottombar'].forEach(id=>$(id).classList.toggle('hidden', !game));
}

function titleScreen(){
  closeModal();
  showScreen('title');
  const sv = load(SAVE_KEY); let ok=false;
  if (sv) { try{ const o=JSON.parse(sv); ok = o && o.v===1 && !o.over; if(ok) $('btnContinue').textContent='Continue ('+o.year+')'; }catch(e){} }
  $('btnContinue').classList.toggle('hidden', !ok);
  const best = load(BEST_KEY);
  $('bestLine').textContent = best ? 'Best score: ' + best : '';
}

function startGame(fresh){
  if (fresh) { S = newState(); const t = JSON.parse(JSON.stringify(S)); simYear(t); for (const k of ['rev','exp','net','demand','cap','crowd','cong','portRev','taxRev']) S[k]=t[k]; news(S,'You take office as harbor governor. The quays are wooden, the cranes are men.'); }
  else { try{ S = JSON.parse(load(SAVE_KEY)); }catch(e){ S=null; } if(!S || S.v!==1){ S=newState(); } }
  undoStack = []; prevStats = null;
  showScreen('game');
  resizeCanvases(); render(); save();
  if (S.pendingEvent) showEvent();
  if (fresh && !load(SEEN_KEY)) showHelp();
}

/* ---- top bar ---- */
function renderStats(){
  const st = [
    {ic:'💰', l:'Treasury', v:fmtMoney(S.treasury), raw:S.treasury, d: S.net, df:v=>(v>=0?'+':'')+fmtMoney(v).replace('$','$')},
    {ic:'📦', l:'TEU/yr', v:fmtTEU(S.teu), raw:S.teu},
    {ic:'👥', l:'Pop.', v:fmtPop(S.pop), raw:S.pop},
    {ic:'👍', l:'Approval', v:Math.round(S.approval)+'%', raw:S.approval},
    {ic:'⚓', l:'Rep.', v:Math.round(S.rep), raw:S.rep}
  ];
  $('stats').innerHTML = st.map((x,i)=>{
    let d = '';
    if (i===0) d = '<div class="d '+(S.net>=0?'up':'down')+'">'+(S.net>=0?'+':'')+fmtMoney(S.net)+'</div>';
    else if (prevStats) { const diff = x.raw - prevStats[i]; if (Math.abs(diff) > (i<3? x.raw*0.005 : 0.5)) d = '<div class="d '+(diff>0?'up':'down')+'">'+(diff>0?'▲':'▼')+'</div>'; else d='<div class="d">&nbsp;</div>'; }
    else d='<div class="d">&nbsp;</div>';
    return '<div class="stat"><div class="ic">'+x.ic+'</div><div class="v'+(i===0&&S.treasury<0?' down':'')+(i===3&&S.approval<25?' down':'')+'">'+x.v+'</div>'+d+'<div class="l">'+x.l+'</div></div>';
  }).join('');
  $('year').textContent = S.year;
  $('era').textContent = ERAS[eraIdx(S.year)].n;
  $('yprog').style.width = ((S.year-START)/(END-START)*100)+'%';
}

function renderInfo(){
  const r = reqDepth(S), cap = capacity(S)*efficiency(S);
  $('tagDepth').innerHTML = '🌊 Depth ' + S.depth.toFixed(0) + ' m <span style="color:'+(S.depth>=r?'#4ad991':'#ff8a8a')+'">/ ships need ' + r.toFixed(1) + ' m</span>';
  $('tagCap').textContent = '🏗 Capacity ' + fmtTEU(cap);
  const kv = [
    ['Revenue', fmtMoney(S.rev)], ['Expenses', fmtMoney(S.exp)],
    ['Port fees', FEE_NAMES[S.fee]], ['Corp. tax', S.tax+'%'],
    ['Labor rules', LABOR[S.labor]], ['Alliance', ({none:'Unaligned',joined:'Member',neutral:'Neutral'})[S.alliance]],
    ['Ship demand', fmtTEU(S.demand)], ['Housing', Math.round((S.crowd||S.pop/S.housingCap)*100)+'% full'],
  ];
  $('kv').innerHTML = kv.map(x=>'<div><span>'+x[0]+'</span><span>'+x[1]+'</span></div>').join('');
  const chips = [];
  for (const p of S.projects){ const c = CARD_BY_ID[p.id]; chips.push('<span class="chip">🚧 '+c.name+' · '+(p.done-S.year)+'y</span>'); }
  const seen = {};
  for (const m of S.mods){ if (seen[m.label]) continue; seen[m.label]=1; const good = (m.k==='appr'||m.k==='rep') ? m.v>0 : m.v>1; chips.push('<span class="chip '+(good?'':'warn')+'">'+(good?'📈 ':'⚠️ ')+m.label+' · '+(m.until-S.year)+'y</span>'); }
  if (S.cong > 1.1) chips.push('<span class="chip bad">🚢 Congested ×'+S.cong.toFixed(2)+'</span>');
  if (S.depth < r - 0.5) chips.push('<span class="chip bad">🌊 Harbor too shallow</span>');
  if ((S.crowd||0) > 1.05) chips.push('<span class="chip bad">🏚 Overcrowded</span>');
  if (wallNeeded(S.year) > S.wall) chips.push('<span class="chip bad">🌊 Flooding — need sea wall '+wallNeeded(S.year)+'</span>');
  if (S.debtYears>0) chips.push('<span class="chip bad">💀 Deep debt '+S.debtYears+'/3 yrs</span>');
  if (S.corr > 45) chips.push('<span class="chip warn">🕵️ Corruption '+Math.round(S.corr)+'</span>');
  $('chips').innerHTML = chips.join('');
  $('news').innerHTML = S.news.slice(0,12).map(n=>'<div><b>'+n.y+'</b>'+n.t+'</div>').join('') || '<div>No news yet.</div>';
}

function renderCards(){
  const list = CARDS.filter(c => c.cat===curTab && cardVisible(S,c));
  $('cards').innerHTML = list.map(c=>{
    const st = cardStatus(S,c), cost = cardCost(S,c);
    const meta = [];
    if (c.delay) meta.push('⏳ '+c.delay+' yr'+(c.delay>1?'s':'')); else meta.push('⚡ Instant');
    if (c.max) meta.push('Lv '+c.cur(S)+'/'+c.max(S));
    if (c.lvl) meta.push('Now: '+c.lvl(S));
    const done = st==='Done this year';
    return '<button class="card'+(st?(done?' done':' dis'):'')+'" data-c="'+c.cat+'" data-id="'+c.id+'">'+
      '<div class="ci">'+c.icon+'</div><div class="cb"><div class="cn"><span>'+c.name+'</span><span class="cost">'+(cost>0?fmtMoney(cost):'Free')+'</span></div>'+
      '<div class="cd">'+cardDesc(S,c)+'</div><div class="cm">'+meta.map(m=>'<span>'+m+'</span>').join('')+
      (st?'<span class="why">'+(done?'✓ ':'')+st+'</span>':'')+'</div></div></button>';
  }).join('');
}

function renderBottom(){
  let p=''; for(let i=0;i<ACTIONS;i++) p+='<i class="'+(i>=S.actionsLeft?'used':'')+'"></i>';
  $('pips').innerHTML = p;
  $('btnUndo').disabled = undoStack.length===0;
  $('btnEnd').firstChild.textContent = S.year>=END ? 'Final Year ' : 'End '+S.year+' ';
}

function render(){ renderStats(); renderInfo(); renderCards(); renderBottom(); drawChart(); }

/* ---- actions ---- */
function onCard(id){
  const c = CARD_BY_ID[id]; if (!c) return;
  const st = cardStatus(S,c);
  if (st) { toast(st); return; }
  undoStack.push(JSON.stringify(S));
  doCard(S,c);
  toast((c.delay ? '🚧 ' : '✅ ') + c.name + (c.delay ? ' — ready in '+(S.year+c.delay) : ''));
  save(); render();
}
function onUndo(){ if(!undoStack.length) return; S = JSON.parse(undoStack.pop()); save(); render(); toast('Undone'); }

function onEndYear(){
  if (S.pendingEvent) { showEvent(); return; }
  prevStats = [S.treasury,S.teu,S.pop,S.approval,S.rep];
  const before = {teu:S.teu, treasury:S.treasury, year:S.year};
  const res = advanceYear(S);
  undoStack = [];
  for (const l of res.log) if (Math.random()<0.6) news(S, l);
  save();
  if (S.over) { render(); gameOver(); return; }
  render();
  const dt = S.teu - before.teu;
  toast(before.year+': '+(S.net>=0?'+':'')+fmtMoney(S.net)+' · TEU '+(dt>=0?'▲':'▼')+' '+fmtTEU(Math.abs(dt)) + (res.done && res.done.length ? ' · ✅ '+res.done.join(', ') : ''));
  if (S.pendingEvent) setTimeout(showEvent, 350);
}

/* ---- modals ---- */
function openModal(html, dismissable){
  $('sheet').innerHTML = html; $('modal').classList.remove('hidden');
  $('modal').onclick = e => { if (dismissable && e.target.id==='modal') closeModal(); };
  $('sheet').scrollTop = 0;
}
function closeModal(){ $('modal').classList.add('hidden'); }

function showEvent(){
  const ev = EVENT_BY_ID[S.pendingEvent]; if (!ev) { S.pendingEvent=null; return; }
  const html = '<div class="paper"><div class="mast"><span>The Harbor Gazette</span><span>'+S.year+'</span></div>'+
    '<h2>'+evText(S,ev.head)+'</h2><p>'+evText(S,ev.body)+'</p></div>'+
    '<div class="small">Treasury: '+fmtMoney(S.treasury)+' — choose a response:</div>'+
    ev.ch.map((ch,i)=>{ const st = choiceStatus(S,ch), cost = choiceCost(S,ch);
      return '<button class="choice" data-i="'+i+'" '+(st?'disabled':'')+'><b>'+ch.t+(cost>0?' <span style="color:var(--warn)">('+fmtMoney(cost)+')</span>':'')+'</b><small>'+evText(S,ch.h)+(st?' — <span style="color:var(--bad)">'+st+'</span>':'')+'</small></button>'; }).join('');
  openModal(html,false);
  $('sheet').querySelectorAll('.choice').forEach(b=>b.onclick=()=>{
    resolveEvent(S, +b.dataset.i); save(); closeModal(); render();
    if (S.approval<=0){ S.over='overthrown'; save(); gameOver(); }
  });
}

function showHelp(){
  store(SEEN_KEY,'1');
  openModal(
  '<h1>⚓ How to Play</h1>'+
  '<p>You govern a small coastal town from <b>1950 to 2050</b>. Each turn is one year. Grow it into a world trade hub.</p>'+
  '<h3>Each year</h3><ul><li>Take up to <b>3 actions</b> by tapping cards in the Build, Policy, Diplomacy and Social tabs.</li><li>Tap <b>End Year</b> to see the results. Made a mistake? <b>Undo</b> works until you end the year.</li></ul>'+
  '<h3>How trade works</h3><ul>'+
  '<li><b>Demand</b> for your port comes from world trade × your attractiveness: reputation, fees, harbor depth, taxes, rail links, trade pacts.</li>'+
  '<li><b>Throughput</b> can never exceed your terminal <b>capacity</b>. Congestion hurts reputation.</li>'+
  '<li>Ships grow every era. Keep <b>dredging</b> or lines will skip you.</li>'+
  '<li>Big projects take <b>2–5 years</b> to finish and cost upkeep. Plan ahead!</li></ul>'+
  '<h3>Money</h3><ul><li>Income = port fees per box + corporate tax. Low fees bring ships; high fees bring cash.</li><li>Debt costs interest. Being deeply in debt for 3 years = <b>bankruptcy</b>.</li></ul>'+
  '<h3>People</h3><ul><li>Growth brings people. Build <b>housing</b> before they arrive, or approval sinks.</li><li>Loose labor rules, free-trade zones and low taxes raise inequality.</li><li>If approval hits <b>0%</b>, you are overthrown.</li></ul>'+
  '<h3>Strategies</h3><p><b>Free port:</b> low fees, low tax, free-trade zones — volume over margin. <b>State builder:</b> higher taxes & fees funding education, housing and mega-projects. Both can win.</p>'+
  '<h3>Eras</h3><p>Break-bulk → Containers (1966) → Globalization (1990) → Automation & green shipping (2010) → Climate pressure (2030): sea walls become essential.</p>'+
  '<p>In 2050 you are ranked from <b>Fishing Village</b> to <b>Global Gateway</b>.</p>'+
  '<button class="btn" style="width:100%;margin-top:10px" id="helpOk">Got it</button>', true);
  $('helpOk').onclick = closeModal;
}

function gameOver(){
  const sc = score(S), rk = rankFor(sc.total);
  const best = +(load(BEST_KEY)||0);
  if (S.over==='complete' && sc.total > best) store(BEST_KEY, String(sc.total));
  let head, sub;
  if (S.over==='overthrown'){ head='🔥 Overthrown!'; sub='Angry crowds storm the harbor office in '+S.year+'. Your term is over.'; }
  else if (S.over==='bankrupt'){ head='💀 Bankrupt!'; sub='Creditors seize the port in '+S.year+' after three years of crushing debt.'; }
  else { head='🏁 The Year 2050'; sub='A century of governance comes to an end.'; }
  const peak = S.hist.reduce((a,h)=>Math.max(a,h.teu),0);
  openModal(
    '<h1>'+head+'</h1><p>'+sub+'</p>'+
    (S.over==='complete' ? '<div class="small">Your port is remembered as a</div><div class="rank">'+rk.n+'</div><p>'+rk.d+'</p>' : '<div class="small">Had history ended here, your port would be a</div><div class="rank">'+rk.n+'</div>')+
    '<div class="report">'+
    '<span>Trade volume ('+fmtTEU(S.teu)+' TEU)</span><span>'+sc.trade+'</span>'+
    '<span>Population ('+fmtPop(S.pop)+')</span><span>'+sc.pop+'</span>'+
    '<span>Treasury ('+fmtMoney(S.treasury)+')</span><span>'+sc.treasury+'</span>'+
    '<span>Approval ('+Math.round(S.approval)+'%)</span><span>'+sc.approval+'</span>'+
    '<span style="border-top:1px solid var(--line);padding-top:4px"><b>Total score</b></span><span style="border-top:1px solid var(--line);padding-top:4px;color:var(--warn)">'+sc.total+'</span>'+
    '</div>'+
    '<p class="small">Peak trade: '+fmtTEU(peak)+' TEU · Ranks: Fishing Village < Coastal Town (900) < Regional Port (1700) < Major Hub (2800) < Global Gateway (3800)</p>'+
    '<button class="btn" style="width:100%;margin-top:8px" id="goNew">Play Again</button>'+
    '<button class="btn sec" style="width:100%;margin-top:8px" id="goTitle">Title Screen</button>', false);
  $('goNew').onclick = ()=>{ closeModal(); startGame(true); };
  $('goTitle').onclick = ()=>{ wipe(SAVE_KEY); titleScreen(); };
}

/* ---- chart ---- */
function drawChart(){
  const cv = $('chart'), ctx = cv.getContext('2d'), dpr = window.devicePixelRatio||1;
  const W = cv.clientWidth, H = cv.clientHeight;
  if (cv.width !== W*dpr) { cv.width = W*dpr; cv.height = H*dpr; }
  ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,W,H);
  const h = S.hist, max = Math.max(50, ...h.map(p=>p.teu));
  $('chartMax').textContent = 'peak ' + fmtTEU(max);
  const pl=4, pr=4, pt=6, pb=14;
  const x = y => pl + (y-START)/(END-START)*(W-pl-pr);
  const yv = v => pt + (1 - v/max)*(H-pt-pb);
  // era bands
  ERAS.forEach((e,i)=>{ const x0=x(e.from), x1=i<ERAS.length-1?x(ERAS[i+1].from):x(END);
    ctx.fillStyle = i%2? 'rgba(255,255,255,0.035)':'rgba(255,255,255,0)'; ctx.fillRect(x0,pt,x1-x0,H-pt-pb); });
  ctx.fillStyle='#6f87a6'; ctx.font='9px system-ui'; ctx.textAlign='center';
  [1950,1975,2000,2025,2050].forEach(yr=>ctx.fillText(yr, clamp(x(yr),12,W-12), H-3));
  ctx.strokeStyle='rgba(255,255,255,.12)'; ctx.beginPath(); ctx.moveTo(pl,yv(0)); ctx.lineTo(W-pr,yv(0)); ctx.stroke();
  if (h.length < 2) return;
  const g = ctx.createLinearGradient(0,pt,0,H-pb); g.addColorStop(0,'rgba(63,182,255,.45)'); g.addColorStop(1,'rgba(63,182,255,0)');
  ctx.beginPath(); ctx.moveTo(x(h[0].y), yv(0));
  h.forEach(p=>ctx.lineTo(x(p.y), yv(p.teu))); ctx.lineTo(x(h[h.length-1].y), yv(0)); ctx.closePath();
  ctx.fillStyle=g; ctx.fill();
  ctx.beginPath(); h.forEach((p,i)=> i?ctx.lineTo(x(p.y),yv(p.teu)):ctx.moveTo(x(p.y),yv(p.teu)));
  ctx.strokeStyle='#3fb6ff'; ctx.lineWidth=2; ctx.stroke();
  const L = h[h.length-1]; ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(x(L.y),yv(L.teu),3,0,7); ctx.fill();
}

/* ---- harbor scene ---- */
let sceneShips = [], lastFrame = 0, trainX = 0;
function rng(seed){ let x = seed>>>0 || 1; return ()=>{ x ^= x<<13; x>>>=0; x ^= x>>17; x ^= x<<5; x>>>=0; return x/4294967296; }; }
function resizeCanvases(){
  const cv = $('scene'), dpr = window.devicePixelRatio||1;
  cv.width = cv.clientWidth*dpr; cv.height = cv.clientHeight*dpr;
  const ch = $('chart'); ch.width = ch.clientWidth*dpr; ch.height = ch.clientHeight*dpr;
  if (S) drawChart();
}
function shipCountTarget(){ return clamp(1 + Math.floor(Math.log2(Math.max(1,S.teu/15))), 1, 10); }
function newShip(W,H,qy,i){
  const lane = Math.random();
  return {x: Math.random()*W, y: 20 + Math.random()*(qy-60), vx:(Math.random()<.5?-1:1)*(6+Math.random()*10), phase: Math.random()<0.5?'sail':'dock', t: Math.random()*10, seed: Math.random()*1e9|0, dockX: 0, lane};
}
function drawScene(ts){
  requestAnimationFrame(drawScene);
  if (!S || $('main').classList.contains('hidden')) return;
  if (ts - lastFrame < 33) return;
  const dt = Math.min(0.1, (ts - lastFrame)/1000); lastFrame = ts;
  const cv = $('scene'), ctx = cv.getContext('2d'), dpr = window.devicePixelRatio||1;
  const W = cv.width/dpr, H = cv.height/dpr; if (!W) return;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const era = eraIdx(S.year);
  const flood = Math.max(0, wallNeeded(S.year)-S.wall);
  const qy = Math.round(H*0.56) + flood*4; // quay line
  // water: deeper = darker
  const dn = clamp((S.depth-8)/14,0,1);
  const wg = ctx.createLinearGradient(0,0,0,qy);
  const c1 = `rgb(${Math.round(70-50*dn)},${Math.round(170-100*dn)},${Math.round(200-90*dn)})`;
  const c2 = `rgb(${Math.round(110-60*dn)},${Math.round(200-90*dn)},${Math.round(215-70*dn)})`;
  wg.addColorStop(0,c1); wg.addColorStop(1,c2);
  ctx.fillStyle = wg; ctx.fillRect(0,0,W,qy+2);
  // waves
  ctx.strokeStyle='rgba(255,255,255,.18)'; ctx.lineWidth=1;
  for (let i=0;i<14;i++){ const yy = (i*37 % (qy-10)) + 6, xx = ((i*97 + ts/60) % (W+40)) - 20; ctx.beginPath(); ctx.moveTo(xx,yy); ctx.quadraticCurveTo(xx+5,yy-2,xx+10,yy); ctx.stroke(); }
  // dredged channel
  const chW = 10 + (S.depth-8)*3;
  ctx.fillStyle='rgba(5,25,60,'+(0.15+dn*0.25)+')';
  ctx.beginPath(); ctx.moveTo(W*0.62-chW/2,0); ctx.lineTo(W*0.62+chW/2,0); ctx.lineTo(W*0.5+chW,qy); ctx.lineTo(W*0.5-chW,qy); ctx.fill();
  // breakwater
  ctx.strokeStyle='#8c8f94'; ctx.lineWidth=6; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(-5,qy*0.35); ctx.quadraticCurveTo(W*0.25,qy*0.18,W*0.38,qy*0.28); ctx.stroke();
  // lighthouse
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(W*0.38,qy*0.28,4,0,7); ctx.fill();
  ctx.fillStyle='#e33'; ctx.beginPath(); ctx.arc(W*0.38,qy*0.28,2,0,7); ctx.fill();
  if (Math.floor(ts/800)%2){ ctx.fillStyle='rgba(255,240,150,.35)'; ctx.beginPath(); ctx.arc(W*0.38,qy*0.28,10,0,7); ctx.fill(); }
  // wind turbines on breakwater (green)
  for (let i=0;i<S.green*2;i++){ const tx = 14 + i*22, ty = qy*0.33 - i*3.2;
    ctx.fillStyle='#ddd'; ctx.beginPath(); ctx.arc(tx,ty,2,0,7); ctx.fill();
    ctx.strokeStyle='#f4f4f4'; ctx.lineWidth=1.5; const a = ts/400 + i;
    for (let k=0;k<3;k++){ const aa=a+k*2.094; ctx.beginPath(); ctx.moveTo(tx,ty); ctx.lineTo(tx+Math.cos(aa)*8,ty+Math.sin(aa)*8); ctx.stroke(); } }

  // land
  const landC = era>=1 && S.terms ? '#7d8790' : '#b9ad86';
  ctx.fillStyle = landC; ctx.fillRect(0,qy,W,H-qy);
  // city area (lower land)
  const cityY = qy + 34;
  ctx.fillStyle = era>=2 ? '#5d6a63' : '#8a9a6a'; ctx.fillRect(0,cityY,W,H-cityY);
  // roads
  ctx.fillStyle='#454b52'; ctx.fillRect(0,cityY-2,W,3);
  for (let i=1;i<5;i++) ctx.fillRect(i*W/5,cityY,2,H-cityY);
  // quay edge / sea wall
  ctx.fillStyle = S.wall ? '#c9ccd1' : '#6b5a3e'; ctx.fillRect(0,qy-1,W,S.wall?2+S.wall*1.5:3);
  // FTZ fence
  if (S.ftz){ ctx.setLineDash([3,3]); ctx.strokeStyle='#ffd34d'; ctx.lineWidth=1.2; ctx.strokeRect(W*0.62,qy+3,W*0.36,28); ctx.setLineDash([]);
    ctx.fillStyle='#ffd34d'; ctx.font='bold 8px system-ui'; ctx.textAlign='left'; ctx.fillText('FTZ'+(S.ftz>1?' ×'+S.ftz:''),W*0.62+3,qy+30); }
  // warehouses
  for (let i=0;i<S.wh;i++){ const wx = W*0.64 + (i%3)*(W*0.11), wy = qy+6+Math.floor(i/3)*11;
    ctx.fillStyle='#d6d0c4'; ctx.fillRect(wx,wy,W*0.1,8); ctx.fillStyle='#a69e8e'; ctx.fillRect(wx,wy+6,W*0.1,2); }
  // terminals: container yards with stacks
  const r = rng(77);
  const facilities = [];
  for (let i=0;i<Math.min(S.berths,6);i++) facilities.push('b');
  for (let i=0;i<S.terms;i++) facilities.push('t');
  for (let i=0;i<S.megas;i++) facilities.push('m');
  const slots = facilities.slice(-12);
  const yardW = W*0.6;
  let fx = 4;
  const per = yardW / Math.max(4, slots.length);
  const cranes = [];
  slots.forEach((f,i)=>{
    const x0 = fx + i*per;
    if (f==='b'){ ctx.fillStyle='#8b6b43'; ctx.fillRect(x0+per*0.2, qy-10, per*0.6, 11); cranes.push({x:x0+per*0.5,s:0.6,t:'b'}); }
    else { const big = f==='m';
      ctx.fillStyle = big ? '#5b6670' : '#6e7882'; ctx.fillRect(x0+1, qy+2, per-2, big?28:22);
      for (let k=0;k<(big?10:6);k++){ ctx.fillStyle = ['#d64541','#2e86de','#f39c12','#27ae60','#8e44ad','#e67e22'][Math.floor(r()*6)];
        ctx.fillRect(x0+3+(k%5)*(per-6)/5, qy+5+Math.floor(k/5)*7, (per-6)/5-1.5, 5); }
      cranes.push({x:x0+per*0.3,s:big?1.3:1,t:'g'}); if (big||S.auto) cranes.push({x:x0+per*0.75,s:big?1.3:1,t:'g'}); }
  });
  // cranes
  for (const c of cranes){
    if (c.t==='b'){ ctx.strokeStyle='#5a4630'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(c.x,qy-2); ctx.lineTo(c.x+6,qy-14); ctx.stroke(); continue; }
    const h = 16*c.s; ctx.fillStyle = S.auto? '#2fb5a6':'#e2a03f';
    ctx.fillRect(c.x-1.5, qy-h, 3, h+6);
    ctx.fillRect(c.x-3, qy-h-1, 6, 3);
    ctx.fillRect(c.x-1, qy-h-14*c.s, 2, 14*c.s); // boom over water
    ctx.fillStyle='rgba(0,0,0,.2)'; ctx.fillRect(c.x+2, qy-h+2, 3, h);
  }
  // rail link
  if (S.rail){ const ry = qy+31; ctx.strokeStyle='#3d3d3d'; ctx.lineWidth=2;
    for (let k=0;k<S.rail && k<2;k++){ ctx.beginPath(); ctx.moveTo(0,ry+k*4); ctx.lineTo(W,ry+k*4); ctx.stroke(); }
    trainX = (trainX + dt*40*S.rail) % (W+120);
    const tx = W - trainX;
    for (let k=0;k<6;k++){ ctx.fillStyle = k===0?'#c0392b':['#2e86de','#f39c12','#27ae60'][k%3]; ctx.fillRect(tx+k*11, ry-2, 10, 5); } }
  // city buildings
  const cr = rng(1234);
  const nB = clamp(Math.round(S.pop/12), 5, 60);
  const cols = 12, bw = W/cols;
  for (let i=0;i<nB;i++){
    const col = i % cols, row = Math.floor(i/cols);
    const bx = col*bw + 3 + cr()*4, by = cityY + 6 + row*((H-cityY-8)/5) + cr()*3;
    const tall = clamp(S.pop/400 + cr()*1.5, 0.3, 4);
    const sz = bw*0.55;
    if (by+sz > H-2) continue;
    if (S.airport && bx > W*0.66 && by > H-26) continue;
    ctx.fillStyle='rgba(0,0,0,.25)'; ctx.fillRect(bx+tall*2, by+tall*1.5, sz, sz); // shadow = height
    const shade = era>=2 && tall>1.5 ? ['#b8d4ea','#9cb8cf','#d0dde8'] : ['#d9c6a5','#c7a982','#e5d7bd','#b98d6a'];
    ctx.fillStyle = shade[Math.floor(cr()*shade.length)]; ctx.fillRect(bx,by,sz,sz);
    if (tall>2){ ctx.fillStyle='rgba(255,255,255,.35)'; ctx.fillRect(bx+1,by+1,sz-2,2); }
  }
  // housing blocks (public housing)
  for (let i=0;i<Math.min(S.houses,8);i++){ const hx = 4 + i*14, hy = H-12; ctx.fillStyle='#e8a87c'; ctx.fillRect(hx,hy,11,9); ctx.fillStyle='#a0522d'; ctx.fillRect(hx,hy,11,2); }
  // airport runway
  if (S.airport){ ctx.fillStyle='#3a3f45'; ctx.fillRect(W*0.68,H-20,W*0.3,10*S.airport>10?14:9);
    ctx.fillStyle='#fff'; for(let k=0;k<6;k++) ctx.fillRect(W*0.7+k*W*0.045,H-16,W*0.025,1.2);
    const px = W*0.68 + ((ts/30) % (W*0.32)); ctx.fillStyle='#fff'; ctx.font='10px system-ui'; ctx.fillText('✈', px, H-12); }
  // flooding overlay
  if (flood){ ctx.fillStyle='rgba(60,140,200,'+(0.15+0.1*flood)+')'; ctx.fillRect(0,qy,W,10+flood*8); }

  // ships
  const target = shipCountTarget();
  while (sceneShips.length < target) sceneShips.push(newShip(W,H,qy,sceneShips.length));
  if (sceneShips.length > target) sceneShips.length = target;
  const shipLen = [18,24,30,36,40][era] , shipH = [6,7,8,9,10][era];
  sceneShips.forEach((sh,i)=>{
    sh.t += dt;
    if (sh.phase==='sail'){ sh.x += sh.vx*dt; if (sh.x < -50) sh.x = W+40; if (sh.x > W+50) sh.x = -40;
      if (sh.t > 12) { sh.phase='dock'; sh.t=0; } }
    else { if (sh.t > 9) { sh.phase='sail'; sh.t=0; } }
    let x = sh.x, y = sh.y;
    if (sh.phase==='dock' && slots.length){ const idx = i % slots.length; x = 4 + idx*per + per*0.15; y = qy - shipH - 6; }
    else if (sh.phase==='dock') { x = W*0.45; y = qy - shipH - 6; }
    const L = shipLen * (i%3===0?1:0.8);
    ctx.fillStyle='rgba(0,0,0,.18)'; ctx.fillRect(x+2,y+2,L,shipH);
    ctx.fillStyle = era===0 ? '#3b3b3b' : '#1f2d3d';
    ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+L-4,y); ctx.lineTo(x+L,y+shipH/2); ctx.lineTo(x+L-4,y+shipH); ctx.lineTo(x,y+shipH); ctx.closePath(); ctx.fill();
    if (era>=1){ const sr = rng(sh.seed); const n = Math.floor((L-8)/4);
      for (let k=0;k<n;k++){ ctx.fillStyle=['#d64541','#2e86de','#f39c12','#27ae60','#ecf0f1'][Math.floor(sr()*5)]; ctx.fillRect(x+3+k*4, y+1.5, 3.2, shipH-3); } }
    else { ctx.fillStyle='#7a5c3a'; ctx.fillRect(x+4,y+2,L-12,shipH-4); }
    ctx.fillStyle='#f4f4f4'; ctx.fillRect(x+1,y+1,3,shipH-2); // bridge
    if (sh.phase==='sail'){ ctx.strokeStyle='rgba(255,255,255,.4)'; ctx.lineWidth=1; ctx.beginPath(); const back = sh.vx>0? x : x+L; ctx.moveTo(back,y+shipH/2); ctx.lineTo(back - Math.sign(sh.vx)*10, y+shipH/2-3); ctx.moveTo(back,y+shipH/2); ctx.lineTo(back - Math.sign(sh.vx)*10, y+shipH/2+3); ctx.stroke(); }
  });
  // label
  ctx.fillStyle='rgba(255,255,255,.75)'; ctx.font='bold 10px system-ui'; ctx.textAlign='right';
  ctx.fillText(slots.length? (S.terms+S.megas? (S.terms+S.megas)+' terminals':'') : '', W-8, qy-6);
}

/* ---- wiring ---- */
$('btnNew').onclick = ()=>{
  const sv = load(SAVE_KEY);
  if (sv && !$('btnContinue').classList.contains('hidden')) {
    openModal('<h1>New game?</h1><p>This will overwrite your saved game.</p><button class="btn" style="width:100%;margin-top:8px" id="cfYes">Start over</button><button class="btn sec" style="width:100%;margin-top:8px" id="cfNo">Cancel</button>', true);
    $('cfYes').onclick = ()=>{ closeModal(); startGame(true); }; $('cfNo').onclick = closeModal;
  } else startGame(true);
};
$('btnContinue').onclick = ()=>startGame(false);
$('btnHow').onclick = showHelp;
$('btnHelp').onclick = showHelp;
$('btnQuit').onclick = ()=>{ save(); titleScreen(); };
$('btnEnd').onclick = onEndYear;
$('btnUndo').onclick = onUndo;
$('tabs').onclick = e => { const b = e.target.closest('.tab'); if(!b) return; curTab = b.dataset.c;
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('on', t===b)); renderCards(); };
$('cards').onclick = e => { const b = e.target.closest('.card'); if (b) onCard(b.dataset.id); };
window.addEventListener('resize', ()=>{ resizeCanvases(); });
document.addEventListener('visibilitychange', ()=>{ if (document.hidden) save(); });
titleScreen();
requestAnimationFrame(drawScene);
