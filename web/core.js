/* Port City — simulation core (no DOM). Shared by the web page and the Node balance test. */
const START = 1950, END = 2050, ACTIONS = 3;
const ERAS = [
  {n:'Break-Bulk Era', from:1950},
  {n:'Containerization', from:1966},
  {n:'Globalization', from:1990},
  {n:'Automation & Green Shipping', from:2010},
  {n:'Climate Pressure', from:2030}
];
const FEE_NAMES = ['Very Low','Low','Standard','High','Very High'];
const FEE_ATTR  = [1.30, 1.15, 1.00, 0.87, 0.75];
const FEE_RATE  = [0.065, 0.090, 0.115, 0.140, 0.165]; // $M per thousand TEU
const LABOR = ['Strict','Balanced','Loose'];
const PARTNERS = ['the Northern Commonwealth','the Eastern Federation','the Southern Union','the Pacific Concord','the Continental Bloc'];

function eraIdx(y){ let i=0; for(let j=0;j<ERAS.length;j++) if(y>=ERAS[j].from) i=j; return i; }
function price(y){ return Math.pow(1.03, y-START); }           // cost inflation
function gdemand(y){ return Math.exp(0.049*(y-START)); }         // world trade growth
function clamp(v,a,b){ return v<a?a:v>b?b:v; }
function lerpTable(t, y){ // t: [[year,val],...]
  if(y<=t[0][0]) return t[0][1];
  for(let i=1;i<t.length;i++){ if(y<=t[i][0]){ const [y0,v0]=t[i-1],[y1,v1]=t[i]; return v0+(v1-v0)*(y-y0)/(y1-y0);} }
  return t[t.length-1][1];
}
const REQ_DEPTH = [[1950,8],[1965,9.5],[1980,12],[1995,14],[2008,15.5],[2020,17],[2050,18.5]];
function reqDepth(s){ return lerpTable(REQ_DEPTH, s.year) + s.shipBump; }
function wallNeeded(y){ return y<2032?0 : y<2040?1 : y<2046?2 : 3; }
function C(s,base){ return base*price(s.year); }

function newState(){
  return {
    v:1, year:START, treasury:14, teu:30, pop:40, approval:62, rep:40,
    depth:8, berths:2, terms:0, megas:0, auto:0, rail:0, airport:0, wh:0, ftz:0,
    housingCap:58, houses:0, edu:0, corr:25, green:0, wall:0,
    fee:2, tax:25, labor:1, agree:0, alliance:'none', court:0, shipBump:0, cruise:0, ecustoms:0, natline:0,
    projects:[], mods:[], hist:[{y:START,teu:30,t:14}], news:[],
    actionsLeft:ACTIONS, used:{}, nextEvent:START+2, lastEv:{}, debtYears:0,
    rev:0, exp:0, net:0, portRev:0, taxRev:0, demand:30, cap:50, prevTeu:30,
    flags:{}, over:null, pendingEvent:null
  };
}

/* ---- modifiers ---- */
function addMod(s,k,v,yrs,label){ s.mods.push({k,v,until:s.year+yrs,label}); }
function modMult(s,k){ let m=1; for(const x of s.mods) if(x.k===k) m*=x.v; return m; }
function modAdd(s,k){ let m=0; for(const x of s.mods) if(x.k===k) m+=x.v; return m; }
function news(s,txt){ s.news.unshift({y:s.year,t:txt}); if(s.news.length>40) s.news.length=40; }
function adjRep(s,d){ s.rep=clamp(s.rep+d,0,100); }
function adjAppr(s,d){ s.approval=clamp(s.approval+d,0,100); }

/* ---- derived economics ---- */
function capacity(s){
  const bbF = s.year<1972?1 : s.year<1990?0.6 : 0.35;
  let c = 15 + s.berths*25*bbF + (s.terms*320 + s.megas*2400)*(1+0.3*s.auto);
  return c * modMult(s,'cap') * floodFactor(s);
}
function floodFactor(s){ const miss = Math.max(0, wallNeeded(s.year)-s.wall); return 1 - 0.12*miss; }
function efficiency(s){ return [0.9,1,1.06][s.labor] * (1+0.02*s.edu); }
function depthFactor(s){
  const r = reqDepth(s);
  return s.depth>=r ? Math.min(1.1, 1+0.035*(s.depth-r)) : Math.max(0.2, 1-0.15*(r-s.depth));
}
function attract(s){
  const repF = 0.5 + s.rep/100;
  const taxF = 1.16 - 0.65*s.tax/100;
  const labF = [0.9,1,1.08][s.labor];
  const corrF = 1 - s.corr/260;
  const ally = s.alliance==='joined'?0.12 : 0;
  const greenF = s.year>=2012 ? s.green*0.05 - (s.year>=2025 && s.green===0 ? 0.08 : 0) : 0;
  const conn = 1 + 0.12*s.rail + 0.05*s.wh + 0.12*s.ftz + 0.07*s.agree + ally + 0.05*s.airport + greenF + 0.06*s.ecustoms + 0.03*s.edu + 0.1*(s.natline||0);
  return repF * FEE_ATTR[s.fee] * depthFactor(s) * taxF * labF * corrF * conn * modMult(s,'demand');
}
function demand(s){ return 30 * gdemand(s.year) * attract(s); }

function upkeep(s){
  const p = Math.pow(price(s.year), 0.6); // running costs inflate slower than construction
  const infra = s.berths*0.12 + s.terms*1.4 + s.megas*8 + s.auto*3 + s.rail*0.9 + s.airport*2.2 + s.wh*0.3 +
    s.ftz*0.5 + s.edu*0.7 + s.wall*1.8 + s.green*0.8 + s.depth*0.05 + s.cruise*0.8 + s.houses*0.25 + (s.natline||0)*3;
  const city = s.pop*0.014;
  return infra*p + city;
}

/* ---- yearly simulation ---- */
function simYear(s){
  const y = s.year;
  const log = [];
  s.prevTeu = s.teu;
  const D = demand(s);
  const cap = capacity(s) * efficiency(s);
  const target = Math.min(D, cap);
  s.teu = Math.max(5, s.teu + (target - s.teu) * (target > s.teu ? 0.6 : 0.8));
  s.demand = D; s.cap = cap;
  const cong = D / cap;

  // money
  const portRev = s.teu * FEE_RATE[s.fee] * modMult(s,'rev');
  const business = (s.pop*0.09 + s.teu*0.08) * (1 + 0.08*s.wh + 0.12*s.airport + 0.05*s.edu + 0.1*s.ftz + 0.1*s.cruise);
  const taxRev = business * s.tax/100 * (1 - 0.08*s.ftz);
  const up = upkeep(s);
  const interest = s.treasury < 0 ? s.treasury*0.09 : Math.min(s.treasury*0.02, 5*price(y));
  s.portRev = portRev; s.taxRev = taxRev;
  s.rev = portRev + taxRev + Math.max(0,interest);
  s.exp = up + Math.max(0,-interest);
  s.net = s.rev - s.exp;
  s.treasury += s.net;

  // population & housing
  const popT = 25 + 7*Math.sqrt(s.teu) * (1 + 0.06*s.edu + 0.12*s.airport + 0.1*s.cruise) + modAdd(s,'pop');
  let g = (popT - s.pop) * 0.07;
  if (s.pop > s.housingCap*1.2 && g > 0) g *= 0.3;
  s.pop = Math.max(10, s.pop + g);
  s.housingCap *= 1.024;
  const crowd = s.pop / s.housingCap;
  const overPen = crowd > 1 ? Math.min(30, (crowd-1)*90) : 0;

  // inequality
  const ineq = 25 + 8*s.ftz + [-8,0,10][s.labor] + (25 - s.tax)*0.5 - 3*s.edu - 1.5*Math.min(6,s.houses) + 4*s.auto;
  const ineqPen = Math.max(0, ineq-30) * 0.7;

  // approval
  const growth = (s.teu / Math.max(1,s.prevTeu) - 1) * 100;
  const growthB = clamp(growth*0.4, -8, 6);
  const appT = 61 + 1.5*s.edu + 2*s.green - overPen - ineqPen - 0.2*s.corr + growthB + (s.treasury<0?-7:0)
    - Math.max(0, wallNeeded(y)-s.wall)*6;
  s.approval = clamp(s.approval + (appT - s.approval)*0.3 + modAdd(s,'appr'), 0, 100);
  s.ineq = ineq; s.crowd = crowd;

  // reputation with shipping lines
  const r = reqDepth(s);
  const depthT = s.depth >= r ? 8 : -6*(r - s.depth);
  const congPen = cong > 1 ? Math.min(25, (cong-1)*40) : 0;
  const repT = 40 + (2-s.fee)*7 + depthT - congPen + s.court*3 + s.green*4 + s.agree*1.5 - s.corr*0.15
    + [-8,0,4][s.labor] + (s.alliance==='neutral'?3:0) + s.ecustoms*5 + (s.natline||0)*5;
  s.rep = clamp(s.rep + (repT - s.rep)*0.2 + modAdd(s,'rep'), 0, 100);
  s.cong = cong;

  // corruption drift
  s.corr = clamp(s.corr + 0.5 + 0.4*s.ftz + (s.labor===2?0.4:0) - 0.1*s.edu, 5, 100);

  // warnings
  if (cong > 1.15) log.push('Ships queue offshore — the port is congested. Build capacity!');
  if (s.depth < r - 0.5) log.push('Modern ships are too big for our shallow harbor. Dredge!');
  if (crowd > 1.08) log.push('Overcrowded tenements anger residents. Build housing.');
  if (wallNeeded(y) > s.wall) log.push('Seawater floods the docks at high tide. Build sea walls.');

  // game over checks
  const limit = -Math.max(20*price(y), s.rev*0.75);
  if (s.treasury < limit) s.debtYears++; else s.debtYears = 0;
  if (s.approval <= 0) s.over = 'overthrown';
  else if (s.debtYears >= 3) s.over = 'bankrupt';

  s.hist.push({y, teu:s.teu, t:s.treasury});
  return {log, cong};
}

function advanceYear(s){
  const res = simYear(s);
  if (s.over) return res;
  if (s.year >= END) { s.over = 'complete'; return res; }
  s.year++;
  // complete projects
  const done = [];
  s.projects = s.projects.filter(p => {
    if (p.done <= s.year) { const c = CARD_BY_ID[p.id]; c.finish(s); done.push(c.name); return false; }
    return true;
  });
  for (const n of done) news(s, n + ' completed.');
  s.mods = s.mods.filter(m => m.until > s.year);
  s.actionsLeft = ACTIONS; s.used = {};
  // era change
  if (eraIdx(s.year) !== eraIdx(s.year-1)) news(s, 'A new age dawns: ' + ERAS[eraIdx(s.year)].n + '.');
  // events
  if (s.year >= s.nextEvent) {
    const ev = pickEvent(s);
    if (ev) { s.pendingEvent = ev.id; s.lastEv[ev.id] = s.year; }
    s.nextEvent = s.year + 1 + Math.floor(Math.random()*3); // 1–3 years
  }
  res.done = done;
  return res;
}

function score(s){
  const p = price(s.year);
  const parts = {
    trade: Math.round(s.teu / 8),
    pop: Math.round(s.pop / 3),
    treasury: Math.round(s.treasury > 0 ? 120*Math.log(1 + s.treasury/p/40) : Math.max(-300, s.treasury/p/2)),
    approval: Math.round(s.approval * 8)
  };
  parts.total = parts.trade + parts.pop + parts.treasury + parts.approval;
  return parts;
}
const RANKS = [
  {min:-1e9, n:'Fishing Village', d:'Gulls outnumber cargo ships. The harbor sleeps.'},
  {min:900, n:'Coastal Town', d:'A tidy port serving local trade.'},
  {min:1700, n:'Regional Port', d:'Feeder ships and freighters keep the quays busy.'},
  {min:2800, n:'Major Hub', d:'A name every shipping line knows.'},
  {min:3800, n:'Global Gateway', d:'One of the great ports of the world.'}
];
function rankFor(total){ let r=RANKS[0]; for(const x of RANKS) if(total>=x.min) r=x; return r; }

/* ---- action cards ---- */
const CARDS = [
  // BUILD
  {id:'dredge', cat:'build', icon:'🚜', name:'Dredge Harbor', from:1950,
   desc:'Deepen the channel by 2 m so larger ships can call.',
   cost:s=>C(s, 4*Math.pow(1.33,(s.depth-8)/2)), delay:2,
   req:s=> s.depth>=24 ? 'Maximum depth reached' : null,
   lvl:s=>s.depth.toFixed(0)+' m', finish:s=>{ s.depth+=2; }},
  {id:'berth', cat:'build', icon:'⚓', name:'Break-Bulk Berth', from:1950, to:1980,
   desc:'Wharf with cargo booms: +25k TEU capacity. Cheap, but obsolete once boxes arrive.',
   cost:s=>C(s,3.5), delay:1, max:s=>8, cur:s=>s.berths, finish:s=>{ s.berths++; }},
  {id:'term', cat:'build', icon:'🏗️', name:'Container Terminal', from:1966,
   desc:'Gantry cranes and box yards: +320k TEU capacity. Needs 10 m depth.',
   cost:s=>C(s,15), delay:3, max:s=>8, cur:s=>s.terms,
   req:s=> s.depth<10 ? 'Needs 10 m depth' : null, finish:s=>{ s.terms++; }},
  {id:'mega', cat:'build', icon:'🚢', name:'Mega Terminal', from:1995,
   desc:'Deep-water mega berths: +2.4M TEU capacity. Needs 14 m depth.',
   cost:s=>C(s,70), delay:4, max:s=>10, cur:s=>s.megas,
   req:s=> s.depth<14 ? 'Needs 14 m depth' : null, finish:s=>{ s.megas++; }},
  {id:'auto', cat:'build', icon:'🤖', name:'Automate Terminals', from:2008,
   desc:'Robotic cranes & driverless trucks: +30% terminal capacity. Dockworkers lose jobs (−approval).',
   cost:s=>C(s, 50*(s.auto+1)), delay:3, max:s=>3, cur:s=>s.auto,
   req:s=> (s.terms+s.megas)===0 ? 'Needs a container terminal' : null,
   finish:s=>{ s.auto++; adjAppr(s,-7); addMod(s,'appr',-2,3,'Automation layoffs'); }},
  {id:'rail', cat:'build', icon:'🚆', name:'Rail Link', from:1950,
   desc:'Connect the docks to the hinterland: +12% trade demand per level.',
   cost:s=>C(s, 12*(s.rail+1)), delay:3, max:s=>3, cur:s=>s.rail, finish:s=>{ s.rail++; }},
  {id:'wh', cat:'build', icon:'🏬', name:'Logistics Warehouses', from:1950,
   desc:'Storage & distribution parks: +5% demand, +8% business tax base.',
   cost:s=>C(s, 5*(1+s.wh*0.5)), delay:2, max:s=>6, cur:s=>s.wh, finish:s=>{ s.wh++; }},
  {id:'airport', cat:'build', icon:'✈️', name:'Airport', from:1955,
   desc:'Air cargo & business travel: +5% demand, +12% business, faster population growth.',
   cost:s=>C(s, 25*(s.airport+1)), delay:4, max:s=>2, cur:s=>s.airport, finish:s=>{ s.airport++; }},
  {id:'green', cat:'build', icon:'🌱', name:'Green Port Upgrade', from:2010,
   desc:'Shore power, LNG & hydrogen bunkering. Shipping lines and residents love it. Lines start shunning ports without it after 2025.',
   cost:s=>C(s, 22*(s.green+1)), delay:2, max:s=>3, cur:s=>s.green, finish:s=>{ s.green++; adjAppr(s,3); }},
  {id:'wall', cat:'build', icon:'🧱', name:'Sea Wall', from:2015,
   desc:'Protect quays from rising seas and storm surges. Needed from the 2030s.',
   cost:s=>C(s, 40*(s.wall+1)), delay:4, max:s=>3, cur:s=>s.wall, finish:s=>{ s.wall++; }},

  // POLICY
  {id:'feeDown', cat:'policy', icon:'⬇️', name:'Lower Port Fees', from:1950,
   desc:'More ships, better reputation — less income per box.',
   cost:()=>0, req:s=> s.fee<=0?'Already at minimum':null, lvl:s=>FEE_NAMES[s.fee],
   instant:s=>{ s.fee--; adjRep(s,4); }},
  {id:'feeUp', cat:'policy', icon:'⬆️', name:'Raise Port Fees', from:1950,
   desc:'More income per box — but ships look elsewhere.',
   cost:()=>0, req:s=> s.fee>=4?'Already at maximum':null, lvl:s=>FEE_NAMES[s.fee],
   instant:s=>{ s.fee++; adjRep(s,-5); }},
  {id:'taxDown', cat:'policy', icon:'💸', name:'Cut Corporate Tax (−5%)', from:1950,
   desc:'Businesses flock in; inequality rises and tax revenue falls.',
   cost:()=>0, req:s=> s.tax<=5?'Already at minimum':null, lvl:s=>s.tax+'%',
   instant:s=>{ s.tax-=5; adjRep(s,1); }},
  {id:'taxUp', cat:'policy', icon:'🏛️', name:'Raise Corporate Tax (+5%)', from:1950,
   desc:'Funds the state — but drives some business away.',
   cost:()=>0, req:s=> s.tax>=50?'Already at maximum':null, lvl:s=>s.tax+'%',
   instant:s=>{ s.tax+=5; adjRep(s,-1); adjAppr(s,1); }},
  {id:'labLoose', cat:'policy', icon:'⛓️', name:'Loosen Labor Rules', from:1950,
   desc:'Faster, cheaper docks; unions and residents are furious (−approval, +inequality).',
   cost:()=>0, req:s=> s.labor>=2?'Already loose':null, lvl:s=>LABOR[s.labor],
   instant:s=>{ s.labor++; adjAppr(s,-7); adjRep(s,3); }},
  {id:'labTight', cat:'policy', icon:'🦺', name:'Tighten Labor Rules', from:1950,
   desc:'Safer jobs and fairer pay (+approval), but slower, costlier docks.',
   cost:()=>0, req:s=> s.labor<=0?'Already strict':null, lvl:s=>LABOR[s.labor],
   instant:s=>{ s.labor--; adjAppr(s,5); adjRep(s,-3); }},
  {id:'ftz', cat:'policy', icon:'🏷️', name:'Free-Trade Zone', from:1955,
   desc:'Duty-free manufacturing & re-export: +12% demand. Some tax lost, corruption & inequality rise.',
   cost:s=>C(s, 7*(s.ftz+1)), delay:2, max:s=>3, cur:s=>s.ftz, finish:s=>{ s.ftz++; s.corr+=4; }},

  // DIPLOMACY
  {id:'agree', cat:'diplo', icon:'✍️', name:'Trade Agreement', from:1950,
   desc:s=>'Sign a pact with '+PARTNERS[Math.min(s.agree,PARTNERS.length-1)]+': +7% trade demand.',
   cost:s=>C(s, 3*(s.agree+1)), delay:2, max:s=>5, cur:s=>s.agree,
   finish:s=>{ s.agree++; adjRep(s,2); }},
  {id:'court', cat:'diplo', icon:'🥂', name:'Court a Shipping Line', from:1950,
   desc:'Wine, dine and offer berth priority to a major carrier: +10 reputation now, +3 lasting.',
   cost:s=>C(s, 1.5 + s.teu/2000), req:s=> s.court>=8?'Every line already calls here':null,
   cur:s=>s.court, max:s=>8, instant:s=>{ s.court++; adjRep(s,10); }},
  {id:'promo', cat:'diplo', icon:'📣', name:'Trade Promotion Campaign', from:1950,
   desc:'Trade fairs and envoys abroad: +6% trade demand for 4 years (stacks across years).',
   cost:s=>C(s,2) + s.rev*0.22, instant:s=>{ addMod(s,'demand',1.06,4,'Trade promotion'); adjRep(s,2); }},
  {id:'line', cat:'diplo', icon:'🚩', name:'Found a National Shipping Line', from:1958,
   desc:'A state-owned carrier that always calls here: +10% trade demand, +5 reputation. Costly upkeep.',
   cost:s=>C(s,30), delay:3, max:s=>1, cur:s=>s.natline||0, finish:s=>{ s.natline=1; adjRep(s,5); adjAppr(s,3); }},
  {id:'ally', cat:'diplo', icon:'🛡️', name:'Join Maritime Alliance', from:1950,
   desc:'Military & trade bloc: +12% demand and naval protection — but you get dragged into its conflicts.',
   cost:()=>0, req:s=> s.alliance==='joined'?'Already a member':null,
   lvl:s=>({none:'Unaligned',joined:'Member',neutral:'Neutral'})[s.alliance],
   instant:s=>{ s.alliance='joined'; adjAppr(s,-2); }},
  {id:'neutral', cat:'diplo', icon:'🕊️', name:'Declare Neutrality', from:1950,
   desc:'Trade with everyone, side with no one. Lines trust you in wartime, but you lose bloc perks.',
   cost:()=>0, req:s=> s.alliance==='neutral'?'Already neutral':null,
   lvl:s=>({none:'Unaligned',joined:'Member',neutral:'Neutral'})[s.alliance],
   instant:s=>{ s.alliance='neutral'; adjRep(s,4); adjAppr(s,2); }},

  // SOCIAL
  {id:'house', cat:'social', icon:'🏘️', name:'Public Housing', from:1950,
   desc:'Build affordable homes: big boost to housing capacity, +approval, −inequality.',
   cost:s=>(2.5 + s.pop*0.035)*Math.sqrt(price(s.year)), delay:2,
   finish:s=>{ s.housingCap += Math.max(25, s.pop*0.3); s.houses++; adjAppr(s,4); }},
  {id:'edu', cat:'social', icon:'🎓', name:'Education Program', from:1950,
   desc:'Schools, a maritime academy, a university. Slow (4 yrs) but lifts growth, approval and efficiency.',
   cost:s=>C(s, 5*(s.edu+1)), delay:4, max:s=>6, cur:s=>s.edu, finish:s=>{ s.edu++; adjAppr(s,2); }},
  {id:'anticorr', cat:'social', icon:'🔍', name:'Anti-Corruption Drive', from:1950,
   desc:'Purge customs graft & cronies: −18 corruption, +approval, +reputation.',
   cost:s=>C(s, 2 + s.teu/4000), req:s=> s.corr<12?'Corruption already low':null, lvl:s=>'Corruption '+Math.round(s.corr),
   instant:s=>{ s.corr=Math.max(5,s.corr-18); adjAppr(s,4); adjRep(s,3); }},
  {id:'parks', cat:'social', icon:'🎡', name:'Parks & Festival', from:1950,
   desc:'Waterfront parks and a harbor festival: +6 approval now.',
   cost:s=>C(s, 1.2 + s.pop/400), instant:s=>{ adjAppr(s,6); }}
];
const CARD_BY_ID = {}; for (const c of CARDS) CARD_BY_ID[c.id] = c;

function cardCost(s,c){ return c.cost(s); }
function cardDesc(s,c){ return typeof c.desc==='function' ? c.desc(s) : c.desc; }
function cardStatus(s,c){ // returns null if available, else reason
  if (s.year < c.from) return 'Available from ' + c.from;
  if (c.to && s.year > c.to) return 'Obsolete';
  if (s.used[c.id]) return 'Done this year';
  if (c.req) { const r = c.req(s); if (r) return r; }
  if (c.max) { const inProg = s.projects.filter(p=>p.id===c.id).length; if (c.cur(s)+inProg >= c.max(s)) return 'Maximum built'; }
  if (c.delay && s.projects.some(p=>p.id===c.id)) return 'Already under construction';
  if (cardCost(s,c) > s.treasury + 0.001) return 'Not enough money';
  if (s.actionsLeft <= 0) return 'No actions left this year';
  return null;
}
function cardVisible(s,c){ return s.year >= c.from - 6 && !(c.to && s.year > c.to); }
function doCard(s,c){
  const st = cardStatus(s,c); if (st) return st;
  const cost = cardCost(s,c);
  s.treasury -= cost; s.actionsLeft--; s.used[c.id] = true;
  if (c.delay) { s.projects.push({id:c.id, done:s.year + c.delay, start:s.year}); news(s, 'Work begins: ' + c.name + ' (ready ' + (s.year+c.delay) + ').'); }
  else { c.instant(s); news(s, c.name + '.'); }
  return null;
}

/* ---- events ---- */
// choice: t=title, h=hint, cost=base $ (scaled by inflation), need=fn(s)->reason, f=effect
const EVENTS = [
 {id:'canal', from:1950, to:2050, w:1.1, head:'CANAL SHUT! Ships Forced Into Long Detour',
  body:'A political crisis has closed the main inter-ocean canal. Lines are rerouting — and the new routes pass our coast.',
  ch:[
   {t:'Offer emergency discount berths', h:'Cost $, Reputation +12, Trade +20% for 2 yrs', cost:3, f:s=>{adjRep(s,12); addMod(s,'demand',1.2,2,'Canal detour');}},
   {t:'Slap on a crisis surcharge', h:'Cash windfall now, Reputation −10', f:s=>{s.treasury+=s.portRev*0.5; adjRep(s,-10);}},
   {t:'Business as usual', h:'Trade +6% for 2 yrs', f:s=>addMod(s,'demand',1.06,2,'Canal detour')}]},
 {id:'rival', from:1955, to:2050, w:1, head:'RIVAL BAYPORT UNVEILS SHINY NEW TERMINAL',
  body:'Just 80 km down the coast, Bayport has opened modern berths and is poaching our customers with cut-rate fees.',
  ch:[
   {t:'Start a price war', h:'Port fees drop one level, Reputation +8', need:s=>s.fee<=0?'Fees already minimal':null, f:s=>{s.fee--; adjRep(s,8);}},
   {t:'Charm offensive with shipping lines', h:'Cost $, Reputation +12', cost:4, f:s=>adjRep(s,12)},
   {t:'Ignore them', h:'Trade −8% for 8 yrs', f:s=>addMod(s,'demand',0.92,8,'Rival port')}]},
 {id:'oil', from:1970, to:2050, w:1, head:'OIL SHOCK: Crude Prices Quadruple Overnight',
  body:'An embargo by oil producers sends fuel costs soaring. Ships slow-steam and global trade stalls.',
  ch:[
   {t:'Subsidize bunker fuel for ships', h:'Cost $, Trade −5% for 2 yrs, Reputation +8', cost:5, f:s=>{addMod(s,'demand',0.95,2,'Oil shock'); adjRep(s,8);}},
   {t:'Austerity budget', h:'Trade −15% for 2 yrs, +cash, Approval −8', f:s=>{addMod(s,'demand',0.85,2,'Oil shock'); s.treasury+=C(s,4); adjAppr(s,-8);}},
   {t:'Build an energy terminal', h:'Cost $$, Trade −15% for 2 yrs then +6% for 12 yrs', cost:12, f:s=>{addMod(s,'demand',0.85,2,'Oil shock'); s.mods.push({k:'demand',v:1.06,until:s.year+14,label:'Energy terminal'});}}]},
 {id:'war', from:1950, to:2050, w:1, head:'WAR ERUPTS ACROSS THE STRAIT',
  body:s=> 'Regional powers trade blows. ' + (s.alliance==='joined' ? 'Our alliance partners demand we close our port to the enemy.' : s.alliance==='neutral' ? 'As a neutral port, both sides look to us for supplies.' : 'Both sides watch which way we lean.'),
  ch:[
   {t:'Stay strictly neutral', h:s=> s.alliance==='joined' ? 'Allies furious: alliance ends, Reputation −6' : 'Reputation +10, Trade −5% for 2 yrs', f:s=>{ if(s.alliance==='joined'){s.alliance='none'; adjRep(s,-6);} else {adjRep(s,10); addMod(s,'demand',0.95,2,'Regional war');}}},
   {t:'Back our allies', h:s=> s.alliance==='joined' ? 'Approval +6, Trade −12% for 3 yrs' : 'Approval +4, Trade −15% for 3 yrs, Reputation −5', f:s=>{ if(s.alliance==='joined'){adjAppr(s,6); addMod(s,'demand',0.88,3,'War blockade');} else {adjAppr(s,4); addMod(s,'demand',0.85,3,'War blockade'); adjRep(s,-5);}}},
   {t:'Become a wartime supply depot', h:'Big cash windfall, Approval −10, Corruption +10', f:s=>{s.treasury+=C(s,8)+s.rev*0.4; adjAppr(s,-10); s.corr+=10;}}]},
 {id:'piracy', from:1950, to:2050, w:1, head:'PIRATES SEIZE TANKER IN SHIPPING LANES',
  body:'Armed gangs in fast skiffs are hijacking freighters. Insurers are hiking premiums on our route.',
  ch:[
   {t:'Fund naval escorts', h:'Cost $, Reputation +10', cost:4, f:s=>adjRep(s,10)},
   {t:'Rely on the alliance navy', h:s=>s.alliance==='joined'?'Free: Reputation +6':'Only for alliance members', need:s=>s.alliance!=='joined'?'Not in an alliance':null, f:s=>adjRep(s,6)},
   {t:'Do nothing', h:'Reputation −10, Trade −8% for 2 yrs', f:s=>{adjRep(s,-10); addMod(s,'demand',0.92,2,'Piracy');}}]},
 {id:'bigships', from:1968, to:2050, w:1, head:'SHIPYARDS LAUNCH RECORD-BREAKING GIANT VESSELS',
  body:'A new class of ships — far longer and deeper than anything before — is entering service. Ports that can’t take them will be left behind.',
  ch:[
   {t:'Emergency dredging program', h:'Cost $$, Depth +2 m immediately', cost:s=>CARD_BY_ID.dredge.cost(s)/price(s.year)*1.3, f:s=>{s.depth+=2; s.shipBump+=0.5;}},
   {t:'Offer feeder transshipment', h:'Cost $, Reputation −4, ships keep growing', cost:2, f:s=>{adjRep(s,-4); s.shipBump+=0.5;}},
   {t:'Wait and see', h:'Required depth +1 m sooner, Reputation −6', f:s=>{adjRep(s,-6); s.shipBump+=1;}}]},
 {id:'pandemic', from:1950, to:2050, w:0.7, head:'PANDEMIC SWEEPS THE GLOBE',
  body:'A new virus spreads through port cities. Crews are quarantined and factories shut.',
  ch:[
   {t:'Strict lockdown', h:'Approval +5, Trade −25% for 1 yr', f:s=>{adjAppr(s,5); addMod(s,'demand',0.75,1,'Pandemic');}},
   {t:'Keep the port open', h:'Approval −12, Trade −8% for 1 yr, Reputation +8', f:s=>{adjAppr(s,-12); addMod(s,'demand',0.92,1,'Pandemic'); adjRep(s,8);}},
   {t:'Relief payments to families', h:'Cost $$, Approval +10, Trade −18% for 1 yr', cost:6, f:s=>{adjAppr(s,10); addMod(s,'demand',0.82,1,'Pandemic');}}]},
 {id:'tradewar', from:1985, to:2050, w:1, head:'SUPERPOWERS SLAP TARIFFS ON EACH OTHER',
  body:'A full-blown trade war erupts between the two largest economies. Container rates plunge.',
  ch:[
   {t:'Pick a side', h:s=>s.alliance==='joined'?'Approval +3, Trade −6% for 3 yrs':'Trade −10% for 3 yrs, Reputation −4', f:s=>{ if(s.alliance==='joined'){adjAppr(s,3); addMod(s,'demand',0.94,3,'Trade war');} else {addMod(s,'demand',0.9,3,'Trade war'); adjRep(s,-4);}}},
   {t:'Become a neutral transshipment hub', h:'Trade +8% for 3 yrs, Corruption +10, Reputation +5', f:s=>{addMod(s,'demand',1.08,3,'Tariff dodging'); s.corr+=10; adjRep(s,5);}},
   {t:'Subsidize hard-hit exporters', h:'Cost $$, Trade −12% for 3 yrs, Approval +8', cost:6, f:s=>{addMod(s,'demand',0.88,3,'Trade war'); adjAppr(s,8);}}]},
 {id:'storm', from:1950, to:2050, w:1, head:s=> s.year>=2025 ? 'SUPER-STORM BATTERS COAST: Docks Under Water' : 'HURRICANE SMASHES INTO HARBOR',
  body:s=>'Winds of 200 km/h and a storm surge tear through the waterfront.' + (s.wall ? ' Our sea walls blunt the worst of it.' : ''),
  ch:[
   {t:'Rebuild stronger', h:'Cost $$, Capacity −15% for 1 yr, Approval +4', cost:s=>6 + s.terms*2 + s.megas*8, f:s=>{addMod(s,'cap',0.85+0.04*s.wall,1,'Storm damage'); adjAppr(s,4);}},
   {t:'Quick patch-up', h:'Cost $, Capacity −30% for 2 yrs', cost:s=>2 + s.terms + s.megas*3, f:s=>addMod(s,'cap',0.7+0.07*s.wall,2,'Storm damage')},
   {t:'Appeal for foreign aid', h:'Capacity −30% for 2 yrs, Approval −6, Reputation −4', f:s=>{addMod(s,'cap',0.7+0.07*s.wall,2,'Storm damage'); adjAppr(s,-6); adjRep(s,-4);}}]},
 {id:'automation', from:2008, to:2045, w:1.2, once:true, head:'ROBOTS ON THE DOCKS: Automation Wave Hits Ports',
  body:'Rivals now run lights-out terminals where cranes are steered by software. Our dockworkers’ union is nervous.',
  ch:[
   {t:'Embrace automation', h:'Automation level +1 now, Approval −10', need:s=>(s.terms+s.megas)===0?'Needs a container terminal':s.auto>=3?'Fully automated':null, cost:20, f:s=>{s.auto++; adjAppr(s,-10);}},
   {t:'Retrain dockworkers', h:'Cost $$, Education +1, Approval +4', cost:12, need:s=>s.edu>=6?'Education maxed':null, f:s=>{s.edu++; adjAppr(s,4);}},
   {t:'Ban the robots', h:'Approval +8, Reputation −10, Trade −5% for 10 yrs', f:s=>{adjAppr(s,8); adjRep(s,-10); addMod(s,'demand',0.95,10,'Robot ban');}}]},
 {id:'strike', from:1950, to:2050, w:1, head:'DOCKERS WALK OUT! Port Paralyzed by Strike',
  body:s=>'Longshoremen demand higher pay and safer conditions.' + (s.labor===2 ? ' Loose labor laws have stoked their anger.' : ''),
  ch:[
   {t:'Concede to the union', h:'Cost $, Approval +6', cost:3, f:s=>adjAppr(s,6)},
   {t:'Break the strike', h:'Approval −14, Reputation +6', f:s=>{adjAppr(s,-14); adjRep(s,6);}},
   {t:'Mediate a compromise', h:'Cost $, Capacity −10% for 1 yr', cost:1, f:s=>addMod(s,'cap',0.9,1,'Strike')}]},
 {id:'box', from:1958, to:1968, w:3, once:true, head:'THE BOX ARRIVES: Steel Containers Revolutionize Shipping',
  body:'An American trucker’s idea — standard steel boxes — is slashing loading times from days to hours. Container terminals become possible from 1966.',
  ch:[
   {t:'Commission a container study', h:'Cost $, Reputation +8, Education +1', cost:3, need:s=>s.edu>=6?'Education maxed':null, f:s=>{adjRep(s,8); s.edu++;}},
   {t:'Protect break-bulk jobs', h:'Approval +6, Reputation −8', f:s=>{adjAppr(s,6); adjRep(s,-8);}},
   {t:'Wait and see', h:'No effect', f:s=>{}}]},
 {id:'scandal', from:1950, to:2050, w:0.9, need:s=>s.corr>30, head:'CUSTOMS CHIEF ARRESTED IN BRIBERY SCANDAL',
  body:'Investigators uncover a smuggling ring operating inside the port authority.',
  ch:[
   {t:'Public inquiry & purge', h:'Cost $, Corruption −20, Approval +4', cost:2, f:s=>{s.corr=Math.max(5,s.corr-20); adjAppr(s,4);}},
   {t:'Quietly hush it up', h:'Approval −8, Corruption +5', f:s=>{adjAppr(s,-8); s.corr+=5;}},
   {t:'Blame the shipping lines', h:'Approval +2, Reputation −12', f:s=>{adjAppr(s,2); adjRep(s,-12);}}]},
 {id:'cruise', from:1985, to:2050, w:0.8, once:true, head:'CRUISE BOOM: Floating Hotels Seek New Ports of Call',
  body:'Cruise lines want a glamorous new stop. Tourists spend freely — but residents worry about crowds.',
  ch:[
   {t:'Build a cruise terminal', h:'Cost $$, +business & population, Approval +3', cost:14, f:s=>{s.cruise=1; adjAppr(s,3);}},
   {t:'Decline politely', h:'No effect', f:s=>{}}]},
 {id:'ecustoms', from:1995, to:2050, w:0.9, once:true, head:'DIGITAL CUSTOMS: Paperless Ports Cut Clearance to Minutes',
  body:'A tech firm offers to digitize all customs paperwork. Shipping lines are impressed by the pilots abroad.',
  ch:[
   {t:'Buy the system', h:'Cost $$, +6% demand and Reputation +5 permanently', cost:10, f:s=>{s.ecustoms=1; adjRep(s,5);}},
   {t:'Build our own (slow, cheap)', h:'Cost $, gains arrive in 4 yrs', cost:4, f:s=>{s.projects.push({id:'_ecus',done:s.year+4});}},
   {t:'Stick with paper', h:'Reputation −4', f:s=>adjRep(s,-4)}]},
 {id:'crash', from:1975, to:2050, w:1, head:'MARKETS CRASH: Banks Fail as Credit Freezes',
  body:'A financial panic spreads from the world’s money centres. Orders for goods collapse.',
  ch:[
   {t:'Stimulus spending', h:'Cost $$, Trade −10% for 2 yrs, Approval +6', cost:8, f:s=>{addMod(s,'demand',0.9,2,'Financial crisis'); adjAppr(s,6);}},
   {t:'Austerity', h:'Trade −20% for 2 yrs, +cash, Approval −8', f:s=>{addMod(s,'demand',0.8,2,'Financial crisis'); s.treasury+=C(s,5); adjAppr(s,-8);}},
   {t:'Bail out a struggling shipping line', h:'Cost $$, Trade −15% for 2 yrs, Reputation +18', cost:10, f:s=>{addMod(s,'demand',0.85,2,'Financial crisis'); adjRep(s,18);}}]},
 {id:'boom', from:1950, to:2050, w:1.1, head:'GLOBAL BOOM: Factories Can’t Keep Up With Orders',
  body:'Consumers worldwide are on a spending spree and every ship is full.',
  ch:[
   {t:'Cash in with peak-season surcharges', h:'Trade +10% for 3 yrs, Port income +20%, Reputation −6', f:s=>{addMod(s,'demand',1.1,3,'Global boom'); addMod(s,'rev',1.2,3,'Surcharges'); adjRep(s,-6);}},
   {t:'Keep fees steady, win loyalty', h:'Trade +15% for 3 yrs, Reputation +6', f:s=>{addMod(s,'demand',1.15,3,'Global boom'); adjRep(s,6);}}]},
 {id:'blockade', from:1950, to:1990, w:0.8, head:'COLD WAR STANDOFF: Navy Blockade Threatens Sea Lanes',
  body:'The superpowers stare each other down. Our harbor is a tempting naval base.',
  ch:[
   {t:'Lease a naval base to the alliance', h:'Cash windfall, joins alliance, Approval −6', f:s=>{s.treasury+=C(s,8); s.alliance='joined'; adjAppr(s,-6);}},
   {t:'Proclaim strict neutrality', h:'Becomes neutral, Reputation +6', f:s=>{s.alliance='neutral'; adjRep(s,6);}},
   {t:'Keep our heads down', h:'Trade −5% for 2 yrs', f:s=>addMod(s,'demand',0.95,2,'Blockade')}]},
 {id:'decol', from:1955, to:1980, w:1, once:true, head:'NEW NATIONS RISE: Former Colonies Seek Trade Partners',
  body:'A wave of independence creates dozens of new countries, all looking for a friendly port.',
  ch:[
   {t:'Send trade missions', h:'Cost $, Trade +10% for 10 yrs', cost:3, f:s=>addMod(s,'demand',1.1,10,'New partners')},
   {t:'Stick with old partners', h:'Reputation +3', f:s=>adjRep(s,3)}]},
 {id:'labor', from:1960, to:2050, w:0.8, head:'LABOR SHORTAGE: Docks Can’t Find Enough Workers',
  body:'The booming port needs hands. Recruiters eye workers from abroad.',
  ch:[
   {t:'Welcome migrant workers', h:'Population +, Approval −4, Housing pressure', f:s=>{s.pop*=1.06; adjAppr(s,-4);}},
   {t:'Raise wages', h:'Cost $, Approval +4', cost:3, f:s=>adjAppr(s,4)},
   {t:'Accept slower docks', h:'Capacity −10% for 2 yrs', f:s=>addMod(s,'cap',0.9,2,'Labor shortage')}]},
 {id:'cyber', from:2012, to:2050, w:0.9, head:'HACKERS CRIPPLE PORT COMPUTERS WITH RANSOMWARE',
  body:s=>'Terminal operating systems are frozen. ' + (s.auto ? 'Our automated cranes stand motionless.' : 'Clerks dust off paper manifests.'),
  ch:[
   {t:'Pay the ransom', h:'Cost $, Reputation −4', cost:4, f:s=>adjRep(s,-4)},
   {t:'Rebuild systems from scratch', h:s=>'Capacity −'+(10+s.auto*8)+'% for 1 yr, Reputation +4', f:s=>{addMod(s,'cap',0.9-0.08*s.auto,1,'Cyberattack'); adjRep(s,4);}},
   {t:'Invest in cyber defense', h:'Cost $$, Reputation +8', cost:9, f:s=>adjRep(s,8)}]},
 {id:'greenreg', from:2015, to:2045, w:1, once:true, head:'GLOBAL CARBON RULES FOR SHIPPING TAKE EFFECT',
  body:'New emission rules require ports to offer clean fuels and shore power. Lines will reward the leaders.',
  ch:[
   {t:'Lead the transition', h:'Cost $$, Green level +1 now, Reputation +6', cost:25, need:s=>s.green>=3?'Already fully green':null, f:s=>{s.green++; adjRep(s,6);}},
   {t:'Lobby for exemptions', h:'Reputation −8, Approval −4', f:s=>{adjRep(s,-8); adjAppr(s,-4);}},
   {t:'Comply slowly', h:'Trade −4% for 5 yrs', f:s=>addMod(s,'demand',0.96,5,'Carbon rules')}]},
 {id:'sealevel', from:2030, to:2050, w:1.6, head:'KING TIDES FLOOD WATERFRONT FOR THIRD TIME THIS YEAR',
  body:s=>'Rising seas push salt water into warehouses and streets.' + (s.wall>=wallNeeded(s.year) ? ' Thanks to the sea walls, damage is minor.' : ' Engineers warn it will only get worse.'),
  ch:[
   {t:'Emergency flood barriers', h:'Cost $$, Sea Wall +1 now', cost:s=>40*(s.wall+1)*0.8, need:s=>s.wall>=3?'Walls maxed':null, f:s=>{s.wall++;}},
   {t:'Relocate low-lying homes', h:'Cost $, Approval −4, Housing capacity −10%', cost:3, f:s=>{adjAppr(s,-4); s.housingCap*=0.9;}},
   {t:'Accept the damage', h:s=>s.wall>=wallNeeded(s.year)?'Minor losses':'Capacity −15% for 2 yrs, Approval −6', f:s=>{ if(s.wall<wallNeeded(s.year)){addMod(s,'cap',0.85,2,'Flooding'); adjAppr(s,-6);} }}]},
 {id:'refugees', from:2032, to:2050, w:1, once:true, head:'CLIMATE REFUGEES ARRIVE BY THE THOUSANDS',
  body:'Drought and floods elsewhere drive families to seek new lives in our city.',
  ch:[
   {t:'Open our doors', h:'Population +10%, Approval −4 (housing strain), Reputation +4', f:s=>{s.pop*=1.1; adjAppr(s,-4); adjRep(s,4);}},
   {t:'Build welcome housing', h:'Cost $$, Population +10%, Housing +', cost:12, f:s=>{s.pop*=1.1; s.housingCap+=s.pop*0.15;}},
   {t:'Close the borders', h:'Approval +3, Reputation −6', f:s=>{adjAppr(s,3); adjRep(s,-6);}}]},
 {id:'arctic', from:2033, to:2050, w:0.8, once:true, head:'MELTING ICE OPENS ARCTIC SHIPPING ROUTE',
  body:'Year-round polar passage cuts weeks off some voyages — bypassing some southern ports entirely.',
  ch:[
   {t:'Market ourselves as the Arctic gateway', h:'Cost $, Trade +8% for 10 yrs', cost:6, f:s=>addMod(s,'demand',1.08,10,'Arctic route')},
   {t:'Focus on regional trade', h:'Trade −5% for 10 yrs, Reputation +3', f:s=>{addMod(s,'demand',0.95,10,'Arctic bypass'); adjRep(s,3);}}]},
 {id:'hydrogen', from:2030, to:2050, w:0.8, once:true, head:'SHIPOWNERS RACE TO ZERO-CARBON FUELS',
  body:'Ammonia and hydrogen-powered ships need refueling hubs. Early hubs could win huge business.',
  ch:[
   {t:'Build a clean-fuel hub', h:'Cost $$$, Trade +10% for 15 yrs, Reputation +6', cost:30, f:s=>{addMod(s,'demand',1.1,15,'Clean-fuel hub'); adjRep(s,6);}},
   {t:'Let others go first', h:'Reputation −3', f:s=>adjRep(s,-3)}]},
 {id:'mergers', from:1995, to:2050, w:0.8, head:'SHIPPING GIANTS MERGE INTO MEGA-ALLIANCE',
  body:'The three largest carriers are pooling ships. They will pick just a few hub ports in our region.',
  ch:[
   {t:'Offer exclusive discounts', h:'Port income −15% for 5 yrs, Reputation +15', f:s=>{addMod(s,'rev',0.85,5,'Alliance discount'); adjRep(s,15);}},
   {t:'Bet on our infrastructure', h:s=>s.cong<0.9 && s.depth>=reqDepth(s) ? 'Reputation +6 (we have room & depth)' : 'Reputation −8 (congested or shallow)', f:s=>{ adjRep(s, s.cong<0.9 && s.depth>=reqDepth(s) ? 6 : -8); }}]},
 {id:'fishing', from:1950, to:1965, w:1, once:true, head:'FISHING FLEET DEMANDS ITS OWN HARBOR SPACE',
  body:'Fishermen complain freighters are crowding them out of the old harbor.',
  ch:[
   {t:'Build them a separate fishing pier', h:'Cost $, Approval +6', cost:1.5, f:s=>adjAppr(s,6)},
   {t:'Cargo comes first', h:'Approval −5, Reputation +4', f:s=>{adjAppr(s,-5); adjRep(s,4);}}]},
 {id:'aid', from:1950, to:1962, w:1.2, once:true, head:'RECONSTRUCTION FUND OFFERS PORT LOANS',
  body:'A postwar development fund will lend cheaply to ports that modernize.',
  ch:[
   {t:'Take the loan', h:'+$12M now, upkeep of debt via interest', f:s=>{s.treasury+=12; s.flags.loan=1; addMod(s,'rev',0.93,10,'Loan repayment');}},
   {t:'Stay independent', h:'Approval +3', f:s=>adjAppr(s,3)}]}
];
const EVENT_BY_ID = {}; for (const e of EVENTS) EVENT_BY_ID[e.id] = e;
// hidden project used by an event
CARD_BY_ID._ecus = {id:'_ecus', name:'Digital customs system', finish:s=>{ s.ecustoms=1; adjRep(s,5); }};

function pickEvent(s){
  const pool = EVENTS.filter(e => s.year>=e.from && s.year<=e.to && (!e.need || e.need(s)) &&
    !(e.once && s.lastEv[e.id]) && !(s.lastEv[e.id] && s.year - s.lastEv[e.id] < 8));
  if (!pool.length) return null;
  let tot = pool.reduce((a,e)=>a+e.w,0), r = Math.random()*tot;
  for (const e of pool){ r -= e.w; if (r <= 0) return e; }
  return pool[pool.length-1];
}
function evText(s,v){ return typeof v==='function' ? v(s) : v; }
function choiceCost(s,ch){ if(!ch.cost) return 0; const b = typeof ch.cost==='function' ? ch.cost(s) : ch.cost; return C(s,b); }
function choiceStatus(s,ch){
  if (ch.need){ const r = ch.need(s); if (r) return r; }
  if (choiceCost(s,ch) > s.treasury + 0.001) return 'Not enough money';
  return null;
}
function resolveEvent(s, idx){
  const ev = EVENT_BY_ID[s.pendingEvent]; if (!ev) { s.pendingEvent=null; return; }
  const ch = ev.ch[idx];
  s.treasury -= choiceCost(s,ch);
  ch.f(s);
  s.corr = clamp(s.corr,5,100);
  news(s, evText(s,ev.head).replace(/:.*/,'') + ' — ' + ch.t.toLowerCase() + '.');
  s.pendingEvent = null;
}

if (typeof module !== 'undefined') module.exports = {newState,advanceYear,simYear,CARDS,CARD_BY_ID,cardStatus,doCard,EVENTS,EVENT_BY_ID,resolveEvent,choiceStatus,score,rankFor,capacity,efficiency,reqDepth,wallNeeded,demand,price};
