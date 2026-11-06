// Headless balance test: plays many full games with simple bot strategies.
// Usage: node tools/balance.js <idle|balanced|freeport|state> [games]
const G = require('../web/core.js');
function tryC(s,id){ const c=G.CARD_BY_ID[id]; if(!G.cardStatus(s,c)){G.doCard(s,c);return true;} return false;}
function costOf(s,id){return G.CARD_BY_ID[id].cost(s);}
const strategies={
 idle(s){},
 freeport(s){
   if(s.fee>1) tryC(s,'feeDown'); if(s.tax>15) tryC(s,'taxDown');
   generic(s, s=>{ if(s.ftz<2) tryC(s,'ftz'); });
 },
 state(s){
   if(s.fee<3) tryC(s,'feeUp'); if(s.tax<35) tryC(s,'taxUp');
   generic(s, s=>{ if(s.edu<6) tryC(s,'edu'); });
 },
 balanced(s){ generic(s,()=>{}); },
};
function generic(s,extra){
  const cap=G.capacity(s)*G.efficiency(s), D=G.demand(s);
  const reserve = s.rev*0.3;
  const inProg=id=>s.projects.some(p=>p.id===id);
  if(s.approval<35) tryC(s,'parks');
  if(s.crowd>1.0 && !inProg('house')) tryC(s,'house');
  if(G.wallNeeded(s.year+5)>s.wall) tryC(s,'wall');
  if(s.depth < G.reqDepth(s)+1 && !inProg('dredge')) tryC(s,'dredge');
  if((D > cap*0.85 || (s.terms===0&&s.year>=1966)) && !inProg('term') && !inProg('mega')){ if(s.year>=1995 && s.depth>=14) tryC(s,'mega')||tryC(s,'term'); else if(!tryC(s,'term')) tryC(s,'berth'); }
  const needCap = (D > cap*0.85 || (s.terms===0 && s.year>=1970)) && !inProg('term') && !inProg('mega') && s.year>=1966;
  if(needCap) return;
  extra(s);
  if(s.corr>45) tryC(s,'anticorr');
  if(s.rep<45) tryC(s,'court');
  for(const id of ['agree','rail','wh','green','airport','edu','line','auto','promo']) { if(s.actionsLeft<=0) break; if(s.treasury - costOf(s,id) > reserve) tryC(s,id); }
}
function run(strat,verbose){
  const s=G.newState();
  while(!s.over){
    strategies[strat](s);
    const r=G.advanceYear(s);
    if(s.pendingEvent){ const ev=G.EVENT_BY_ID[s.pendingEvent]; const opts=ev.ch.map((c,i)=>i).filter(i=>!G.choiceStatus(s,ev.ch[i])); const i=opts[Math.floor(Math.random()*opts.length)]; G.resolveEvent(s,i??ev.ch.length-1); }
    if(verbose && s.year%10==0) console.log(s.year, 'T',s.treasury.toFixed(0),'teu',s.teu.toFixed(0),'D',s.demand.toFixed(0),'cap',s.cap.toFixed(0),'pop',s.pop.toFixed(0),'ap',s.approval.toFixed(0),'rep',s.rep.toFixed(0),'rev',s.rev.toFixed(1),'exp',s.exp.toFixed(1),'dep',s.depth, 'terms',s.terms,s.megas,'crowd',s.crowd.toFixed(2));
  }
  const sc=G.score(s); return {over:s.over,year:s.year,total:sc.total,sc,rank:G.rankFor(sc.total).n};
}
const strat=process.argv[2]||'balanced', n=+process.argv[3]||1;
if(n===1){console.log(run(strat,true));}
else{ const res=[]; for(let i=0;i<n;i++) res.push(run(strat)); const overs={}; const ranks={}; res.forEach(r=>{overs[r.over]=(overs[r.over]||0)+1; ranks[r.rank]=(ranks[r.rank]||0)+1;}); const t=res.map(r=>r.total).sort((a,b)=>a-b); console.log(strat,overs,ranks,'median',t[n>>1],'p10',t[Math.floor(n*.1)],'p90',t[Math.floor(n*.9)]); }
