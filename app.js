/* Tankmate — aquarium co-pilot. Local-first, no account, no server.
   The differentiator vs every existing app: it gives VERDICTS and ACTIONS,
   not just stored numbers. Rules encoded from real freshwater chemistry. */

const STORE = 'tankmate.tests.v1';
const TANK = 'tankmate.tank.v1';

/* ---------- seed: Marc's real Fluval Flex 57 L, 2026-06-11 ---------- */
const SEED = [
  { date:'2025-12-20', nh3:0, no2:0.5, no3:15, kh:4, ph:7.2, temp:25, note:'after adding fish — NO2 spike' },
  { date:'2026-05-30', nh3:0, no2:0.25, no3:20, kh:3, ph:7.1, temp:25, note:'instability; started water-change run' },
  { date:'2026-06-11', nh3:0, no2:0, no3:10, kh:7, ph:7.4, temp:25, note:'healthy after 5–6 water changes' },
];

const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const load = () => { try { return JSON.parse(localStorage.getItem(STORE)) || null } catch { return null } };
const save = (a) => localStorage.setItem(STORE, JSON.stringify(a));
let tests = load();
if (!tests) { tests = SEED.slice(); save(tests); }

/* ---------- VERDICT ENGINE (the moat) ---------- */
// returns {level:'good|warn|bad', tag, meaning, action}
const RULES = {
  nh3(v){ if(v==null||isNaN(v)) return null;
    if(v===0) return {level:'good',tag:'0 — perfect',meaning:'Filter bacteria are processing all fish waste. Zero is the only acceptable number.'};
    return {level:'bad',tag:v+' ppm — toxic',meaning:'Ammonia is toxic at any visible level. Colony A is overwhelmed: overfeeding, a death, or filter damage.',action:'25–30% water change TODAY. Re-test daily until 0. Find the cause.'}; },
  no2(v){ if(v==null||isNaN(v)) return null;
    if(v===0) return {level:'good',tag:'0 — perfect',meaning:'Second-stage bacteria are working. Zero is the only acceptable number.'};
    return {level:'bad',tag:v+' ppm — toxic',meaning:'Colony B is behind colony A — classic after adding fish or a disturbance.',action:'Water changes until it reads 0. Re-test daily.'}; },
  no3(v){ if(v==null||isNaN(v)) return null;
    if(v<=20) return {level:'good',tag:v+' ppm — green zone',meaning:'The exhaust pipe of the cycle. Low and healthy. Plants + weekly changes manage it.'};
    if(v<=40) return {level:'warn',tag:v+' ppm — climbing',meaning:'Still tolerable but trending up. Don\'t let it pass ~40.',action:'Bring forward your next water change; check feeding amount.'};
    return {level:'bad',tag:v+' ppm — act',meaning:'Above the comfortable range for sensitive fish.',action:'Water change now; reduce feeding; add/maintain plants.'}; },
  kh(v){ if(v==null||isNaN(v)) return null;
    if(v>=7) return {level:'good',tag:v+' dKH — healthy buffer',meaning:'Comfortable buffer. Nitrification consumes KH all day; water changes are your supply line.'};
    if(v>=5) return {level:'warn',tag:v+' dKH — thinning',meaning:'Buffer getting thin. Test weekly now, not monthly.',action:'Plan a water change in the next few days to top KH up.'};
    return {level:'bad',tag:v+' dKH — danger',meaning:'Thin buffer → pH can crash suddenly (not gradually), stalling bacteria and stressing fish.',action:'Water change SAME DAY. Re-test in 3 days.'}; },
  ph(v){ if(v==null||isNaN(v)) return null;
    return {level:'good',tag:v+' — informational',meaning:'Absolute pH matters less than stability. A steady 7.0–7.8 with healthy KH is fine; don\'t chase a number.'}; },
  temp(v){ if(v==null||isNaN(v)) return null;
    if(v>=23&&v<=27) return {level:'good',tag:v+'°C — in range',meaning:'Good tropical community range.'};
    return {level:'warn',tag:v+'°C — check',meaning:'Outside the usual 23–27°C tropical range. Check the heater/room temp.',action:'Verify heater function; sudden swings stress fish.'}; },
  gh(v){ if(v==null||isNaN(v)) return null;
    return {level:'good',tag:v+' dGH — informational',meaning:'General hardness. Hard tap suits guppies and is fine for tank-bred tetras. Stability beats ideal numbers.'}; },
};
const LABEL = {nh3:'NH₃ ammonia',no2:'NO₂ nitrite',no3:'NO₃ nitrate',kh:'KH buffer',ph:'pH',gh:'GH',temp:'Temperature'};

function verdictsFor(t){
  const order=['nh3','no2','no3','kh','ph','gh','temp'], out=[];
  for(const k of order){ const r=RULES[k]?.(t[k]); if(r){ r.key=k; r.label=LABEL[k]; out.push(r); } }
  // worst-first so the dangerous thing is on top
  const rank={bad:0,warn:1,good:2};
  return out.sort((a,b)=>rank[a.level]-rank[b.level]);
}
const worst = (t)=>{ const v=verdictsFor(t); return v.length?v[0].level:'good'; };

function renderVerdicts(t, el){
  const vs=verdictsFor(t);
  el.innerHTML = `<h2>Verdict — ${t.date}</h2>` + vs.map(v=>`
    <div class="verdict ${v.level}">
      <div class="top"><span>${v.label}</span><span class="v">${v.tag}</span></div>
      <p>${v.meaning}</p>
      ${v.action?`<div class="act">→ <b>${v.action}</b></div>`:''}
    </div>`).join('');
}

/* ---------- HISTORY ---------- */
function renderHistory(){
  const el=document.getElementById('history');
  const sorted=[...tests].sort((a,b)=>b.date.localeCompare(a.date));
  el.innerHTML = sorted.map(t=>{
    const w=worst(t);
    const vals=['nh3','no2','no3','kh'].map(k=>t[k]!=null&&!isNaN(t[k])?`${k.toUpperCase()} ${t[k]}`:'').filter(Boolean).join(' · ');
    return `<div class="h"><span class="d">${t.date}<span class="dot ${w}"></span></span><span class="vals">${vals}</span></div>`;
  }).join('') || '<div class="empty">No tests yet.</div>';
}

/* ---------- TRENDS (rate of change) ---------- */
function renderTrends(){
  const el=document.getElementById('trend-cards');
  const s=[...tests].filter(t=>t.no3!=null).sort((a,b)=>a.date.localeCompare(b.date));
  let html='';
  if(s.length>=2){
    const a=s[s.length-2], b=s[s.length-1];
    const days=Math.max(1,(new Date(b.date)-new Date(a.date))/864e5);
    const rate=((b.no3-a.no3)/days*7).toFixed(1);
    const rising=rate>0;
    const lvl = rate>10 ? 'bad' : rate>5 ? 'warn' : 'good';
    html += `<div class="card ${lvl==='good'?'':''}"><div class="trend">
      <div><small>Nitrate rate (last interval)</small><div class="big" style="color:var(--${lvl})">${rising?'+':''}${rate} <small>ppm/week</small></div></div>
      <div style="text-align:right;max-width:55%"><small>${
        rate>10?'Climbing fast — find the load (overfeeding? stocking?) and increase water-change frequency.':
        rate>5?'Mild climb — keep an eye on it; bring water changes forward if it continues.':
        rising?'Gentle, normal accumulation. Weekly changes are keeping up.':
        'Flat or falling — your maintenance is winning.'}</small></div>
    </div></div>`;
  } else html='<div class="empty">Log at least two tests to see trends.</div>';
  // KH watch
  const k=[...tests].filter(t=>t.kh!=null).sort((a,b)=>b.date.localeCompare(a.date))[0];
  if(k){ const r=RULES.kh(k.kh); html+=`<div class="card"><div class="trend"><div><small>Latest KH buffer</small><div class="big" style="color:var(--${r.level})">${k.kh} <small>dKH</small></div></div><div style="text-align:right;max-width:55%"><small>${r.action||r.meaning}</small></div></div></div>`; }
  el.innerHTML=html;
  drawChart();
}

function drawChart(){
  const c=document.getElementById('chart'); if(!c) return;
  const ctx=c.getContext('2d'); const W=c.width=c.clientWidth*devicePixelRatio, H=c.height=180*devicePixelRatio;
  ctx.clearRect(0,0,W,H); ctx.scale(1,1);
  const s=[...tests].sort((a,b)=>a.date.localeCompare(b.date));
  if(s.length<2){ return; }
  const series={no3:'#22d3ee', kh:'#fbbf24'};
  const pad=24*devicePixelRatio;
  const xs=s.map((t,i)=> pad + i*(W-2*pad)/(s.length-1));
  const all=s.flatMap(t=>[t.no3,t.kh]).filter(v=>v!=null&&!isNaN(v));
  const max=Math.max(20,...all)*1.15;
  const y=v=> H-pad - (v/max)*(H-2*pad);
  ctx.lineWidth=2*devicePixelRatio;
  for(const [k,col] of Object.entries(series)){
    ctx.strokeStyle=col; ctx.beginPath(); let started=false;
    s.forEach((t,i)=>{ if(t[k]==null||isNaN(t[k]))return; const X=xs[i],Y=y(t[k]); started?ctx.lineTo(X,Y):ctx.moveTo(X,Y); started=true;
      ctx.fillStyle=col; });
    ctx.stroke();
    s.forEach((t,i)=>{ if(t[k]==null||isNaN(t[k]))return; ctx.fillStyle=col; ctx.beginPath(); ctx.arc(xs[i],y(t[k]),3*devicePixelRatio,0,7); ctx.fill(); });
  }
  document.getElementById('legend').innerHTML='<span><i style="background:#22d3ee"></i>NO₃ nitrate</span><span><i style="background:#fbbf24"></i>KH buffer</span>';
}

/* ---------- FEEDING ---------- */
const ROTATION=[ // index 0=Sunday
  {day:'Sun',food:'Pleco spirulina wafer',port:'½ wafer'},
  {day:'Mon',food:'Pleco spirulina wafer',port:'½ wafer'},
  {day:'Tue',food:'Tetra Pleco tablet',port:'½ tablet'},
  {day:'Wed',food:'Repashy Soilent Green',port:'1 cm cube / coated stone'},
  {day:'Thu',food:'Tetra Pleco tablet',port:'½ tablet'},
  {day:'Fri',food:'Veg night — blanched courgette/cucumber',port:'1 slice ~1 cm. Remove Sat evening.'},
  {day:'Sat',food:'Repashy Soilent Green',port:'1 cm cube / coated stone'},
];
function renderFeeding(){
  const d=new Date().getDay();
  const t=ROTATION[d];
  document.getElementById('feed-today').innerHTML =
    `<small style="color:var(--mut)">Tonight (after lights-out)</small>
     <h2 style="margin:.2em 0;color:var(--ink)">${t.food}</h2>
     <p style="margin:0;color:var(--acc)">${t.port}</p>
     <p style="margin:.6em 0 0;font-size:13px;color:var(--mut)">Plus the morning pinch of Tetra Micro Granules. Drop sinking food in the same front-glass spot; baster out leftovers next morning.</p>`;
  document.getElementById('rotation').innerHTML = ROTATION.map((r,i)=>
    `<div class="rot ${i===d?'today':''}"><span class="day">${r.day}</span><span class="food">${r.food}</span><span class="port">${r.port}</span></div>`).join('');
}

/* ---------- PLAYBOOK ---------- */
const PLAYBOOK=[
  {sym:'NH₃ or NO₂ above 0',first:'25–30% water change with dechlorinated, temperature-matched water.',then:'Re-test daily, change daily until 0. Find the cause: dead animal? overfeed? filter disturbed?'},
  {sym:'Fish gasping at surface',first:'Increase surface agitation (air + pump); check temperature.',then:'Test everything — gasping means oxygen or poison.'},
  {sym:'KH ≤ 4 dKH',first:'Water change same day.',then:'Re-test in 3 days. With hard tap (17 dKH) no chemicals are needed.'},
  {sym:'Cloudy white water',first:'Usually a bacterial bloom: feed less, wait, do NOT dose chemicals.',then:'Test NH₃/NO₂ daily until it clears.'},
  {sym:'Green water / algae burst',first:'Reduce light hours; check feeding.',then:'Patience — don\'t reach for chemicals.'},
  {sym:'After any death',first:'Remove the body immediately; test NH₃/NO₂.',then:'A 3 cm corpse can spike a 57 L tank within 24 h.'},
];
function renderPlaybook(){
  document.getElementById('playbook').innerHTML = PLAYBOOK.map(p=>`
    <details class="pb"><summary>${p.sym}<span>＋</span></summary>
      <div class="body"><div class="first">First: ${p.first}</div><div class="then">Then: ${p.then}</div></div></details>`).join('');
}

/* ---------- HOLIDAY HANDOVER (no competitor does this) ---------- */
function renderHandover(){
  const days=+document.getElementById('h-days').value||7;
  const friend=esc(document.getElementById('h-friend').value.trim());
  const visits=Math.max(1,Math.ceil(days/3));
  const last=[...tests].sort((a,b)=>b.date.localeCompare(a.date))[0];
  const el=document.getElementById('handover');
  el.innerHTML=`<div class="sheet" id="sheet">
    <h3>🐟 Tankmate handover — ${days} days${friend?` · for ${friend}`:''}</h3>
    <p>Tank: <b>Fluval Flex 57 L</b>. Last water test ${last?last.date:'—'}: everything was ${last&&worst(last)==='good'?'healthy':'see notes'}. Thank you! The fish need very little — <b>the danger is doing too much, not too little.</b></p>
    <div class="box"><b>Every day — morning only</b><ul>
      <li>One 3-finger pinch of the granules in the labelled pot. That's it for the day.</li>
      <li>Glance: are the fish swimming normally? Is the water clear? Is the light on its timer?</li>
      <li>📷 Photograph the tank and text it to me.</li></ul></div>
    <div class="box"><b>${visits} pill-organiser compartment${visits>1?'s':''} (one per visit, ~every 3 days)</b><ul>
      <li>Each compartment = 1 pleco tablet + 1 crab loop. Drop in <b>after lights-out</b>. Nothing else.</li>
      <li>Label on the box: "Drop in after lights off. Nothing else."</li></ul></div>
    <div class="box"><b>Only if I ask (emergency)</b><ul>
      <li>If I say so after seeing a photo: 25–30% water change. Buckets + dechlorinator drops are under the tank, steps taped to the lid.</li>
      <li>Never clean the filter sponge. Never add anything else.</li></ul></div>
    <p style="font-size:12px;color:#555">Generated by Tankmate. Print this and tape it by the tank.</p>
    <button class="print" onclick="window.print()">🖨️ Print / Save as PDF</button>
  </div>`;
}

/* ---------- form + tabs + wiring ---------- */
document.getElementById('f-date').value=new Date().toISOString().slice(0,10);
document.getElementById('testform').addEventListener('submit',e=>{
  e.preventDefault();
  const g=id=>{const v=document.getElementById(id).value; return v===''?null:+v;};
  const t={date:document.getElementById('f-date').value||new Date().toISOString().slice(0,10),
    nh3:g('f-nh3'),no2:g('f-no2'),no3:g('f-no3'),kh:g('f-kh'),ph:g('f-ph'),gh:g('f-gh'),temp:g('f-temp'),
    note:document.getElementById('f-note').value.trim()};
  tests.push(t); save(tests);
  renderVerdicts(t, document.getElementById('verdicts'));
  renderHistory(); renderTrends();
  document.getElementById('verdicts').scrollIntoView({behavior:'smooth',block:'start'});
  e.target.reset(); document.getElementById('f-date').value=new Date().toISOString().slice(0,10);
});

function show(tab){
  document.querySelectorAll('.tab').forEach(s=>s.classList.toggle('active',s.id==='tab-'+tab));
  document.querySelectorAll('.tabbar button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  if(tab==='trends')drawChart();
}
document.querySelectorAll('.tabbar button').forEach(b=>b.onclick=()=>show(b.dataset.tab));
document.getElementById('h-gen').onclick=renderHandover;

// initial paint
renderHistory(); renderTrends(); renderFeeding(); renderPlaybook();
if(tests.length) renderVerdicts([...tests].sort((a,b)=>b.date.localeCompare(a.date))[0], document.getElementById('verdicts'));
window.addEventListener('resize',drawChart);

// PWA
if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').catch(()=>{}); }
