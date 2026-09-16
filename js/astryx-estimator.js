// Astryx Estimator Module — EB-5 EAD + Conditional GC projection
// Uses data/lucid-snapshot.json + local model; no backend required
// Embedded fallback data mirrors data/lucid-snapshot.json for offline file:// use

const FALLBACK = {
  updatedAt: "2026-09-16",
  visaBulletin: {
    unreserved: { china: "2016-07-14", india: "2021-07-01", row: "Current" },
    rural: { row: "Current" }, hua: { row: "Current" }, infra: { row: "Current" }
  },
  pipeline: {
    totalPetitions: 19780,
    byCountry: { chinaPct: 0.46, indiaPct: 0.27, rowPct: 0.27 },
    estimatedVisas: { rural: 15000, hua: 15000, infra: 1000, unreservedPipeline: 20000, grandTotal: 51000 }
  },
  supply: {
    rural: { typical: 3200, fy26: 4000, perCountryCap: 227, rowEffective: 2746 },
    hua: { typical: 1800, perCountryCap: 128, rowEffective: 1544 },
    infra: { firstYear: 400, typical: 200, perCountryCapFirstYear: 28, perCountryCapTypical: 14, rowEffectiveFirstYear: 344 },
    unreserved: { typical: 6800, perCountryCap: 483 },
    totalPerCountryCap: 700, annualTotal: 10000
  },
  processing: { i526e: { medianMonths: 13.6, denialRate: 0.24 }, i485: { dosLag: "Johannesburg Aug 2023 DQ still scheduling Aug 2026" } },
  i485Inventory: { ruralPending: 9200, huaPending: 9100, infraPending: 165 },
  projections: { setAsideOnly: {}, withUnreservedOverflow: { clearing: "2033 (~7yr)" } }
};

let SNAP = null;
let LAST_FETCH = null;

async function loadSnapshot(){
  try{
    const r = await fetch('data/lucid-snapshot.json', {cache:'no-store'});
    if(!r.ok) throw new Error('no snapshot');
    SNAP = await r.json();
    LAST_FETCH = new Date().toISOString();
  }catch{
    SNAP = FALLBACK;
  }
  return SNAP;
}

function yearsFor({country, category, family, withOverflow}){
  const c = country === 'china' ? 'china' : country === 'india' ? 'india' : 'row';
  const cat = category;
  const snap = SNAP || FALLBACK;
  const fam = Math.max(1.5, Math.min(3.0, family||2.0));
  const p = snap.pipeline.estimatedVisas;
  const s = snap.supply;

  // pipeline visas for that slice: category share * country share
  const catVisas = cat==='rural'? p.rural : cat==='hua'? p.hua : cat==='infra'? p.infra : p.unreservedPipeline;
  const countryShare = c==='china'? snap.pipeline.byCountry.chinaPct : c==='india'? snap.pipeline.byCountry.indiaPct : snap.pipeline.byCountry.rowPct;
  // For grand total overflow model, India/China total pipeline across all categories matters
  const totalForCountry = (p.rural + p.hua + p.infra) * countryShare + (cat==='unreserved' ? 20000*countryShare : 0);

  let annualCap;
  if(withOverflow){
    // Per-country total capacity across all EB-5 (~700/yr) — Lazicki optimistic
    annualCap = s.totalPerCountryCap;
    if(c==='row') annualCap = s.annualTotal * 0.52; // ROW effectively inherits leftover; simplified 5200
    // years using totalForCountry is more accurate for overflow
    const yrs = (totalForCountry * fam/2) / annualCap;
    return { yrs: Math.max(0.6, yrs), cap: annualCap, pipeline: totalForCountry*fam/2 };
  } else {
    // Set-aside only: per-category per-country cap
    if(cat==='rural') annualCap = c==='row'? s.rural.rowEffective : s.rural.perCountryCap;
    else if(cat==='hua') annualCap = c==='row'? s.hua.rowEffective : s.hua.perCountryCap;
    else if(cat==='infra') annualCap = c==='row'? s.infra.rowEffectiveFirstYear : s.infra.perCountryCapFirstYear;
    else annualCap = c==='row'? s.unreserved.typical : s.unreserved.perCountryCap;
    const sliceVisas = catVisas * countryShare * fam/2; // adjusted for family vs 2.0 base
    const yrs = sliceVisas / annualCap;
    // Infra special: if pipeline <400 and row, short wait regardless of formula
    if(cat==='infra' && c==='row' && catVisas < 400) return { yrs: 0.4, cap: annualCap, pipeline: sliceVisas };
    return { yrs: Math.max(0.4, yrs), cap: annualCap, pipeline: sliceVisas };
  }
}

function formatYears(y){
  if(y < 0.7) return `${Math.round(y*12)} months`;
  if(y < 2) return `${y.toFixed(1)} years`;
  if(y >= 20) return `${Math.round(y)}+ years (multi-decade)`;
  return `${y.toFixed(1)} years`;
}
function formatRange(y){
  // ±25% band for optimistic/pessimistic family + ROW demand
  const lo = y * 0.75, hi = y * 1.35;
  if(lo < 0.7) return `${Math.round(lo*12)} mo – ${formatYears(hi)}`;
  return `${lo.toFixed(1)} – ${hi.toFixed(1)} years`;
}

function eadEstimate({country, category, filingDate}){
  // EAD via concurrent filing only if Dates for Filing is Current
  const snap = SNAP || FALLBACK;
  const catState = snap.visaBulletin[category]?.row || 'Current';
  const isCurrent = catState === 'Current';
  // For unreserved India/China, NOT current
  let blockCountry = country;
  if(category==='unreserved' && (country==='india' || country==='china')) {
    // Unreserved has FADs
    return { isCurrent:false, eadMonths: null, waitYears: yearsFor({country, category:'unreserved', family:2.0, withOverflow:false}).yrs, note: `Unreserved ${country} FAD ${snap.visaBulletin.unreserved[country]} — must wait for filing date to become current` };
  }
  if(isCurrent){
    return { isCurrent:true, eadMonths: 8, note: `Category Current — concurrent I-485/I-765 allowed. EAD typically 6–12 mo after filing (USCIS median ~8mo). Filing ${filingDate || 'today'} → EAD Q2–Q3 2027.` };
  } else {
    const y = yearsFor({country, category, family:2.0, withOverflow:true}).yrs;
    return { isCurrent:false, eadMonths:null, waitYears: y, note: `Not Current — EAD only after priority date becomes current for filing (~${formatYears(y)} queue)` };
  }
}

function gcEstimate({country, category, family, withOverflow, aos}){
  const proc = (SNAP||FALLBACK).processing.i526e.medianMonths;
  const consular = aos==='aos'? 8 : 13; // months: AOS uses I-485, consular adds DOS lag
  const y = yearsFor({country, category, family, withOverflow});
  // Total = max( I-526E wait , visa queue ) + consular — queue already includes family
  // For simplicity totalYears = max(y.yrs, proc/12) + consular/12 ; queue dominates if >1yr
  const queueYears = y.yrs;
  const procYears = proc/12;
  const base = Math.max(queueYears, procYears) + consular/12;
  // Infra first-wave special: if infra row and queue <0.5, show as proc + consular only
  return {
    procMonths: proc,
    consularMonths: consular,
    queue: y,
    totalLo: base*0.85,
    total: base,
    totalHi: base*1.25,
    breakdown: `I-526E ${proc}mo + queue ${formatYears(queueYears)} + ${aos==='aos'?'I-485 ~8mo':'consular ~13mo DOS lag'}`
  };
}

function renderEstimatorRoot(root){
  const snap = SNAP||FALLBACK;
  const html = `
  <div class="astryx-head">
    <div class="astryx-live" id="astryxLive"><i></i> Live: LucidText ${snap.updatedAt} · I-526E ${snap.processing.i526e.medianMonths}mo median</div>
    <span class="astryx-chip">Model: <em>per-country 7.1% caps + ${snap.supply.annualTotal/1000}k/yr</em></span>
  </div>
  <div class="astryx-grid">
    <div class="astryx-panel" id="astryxInputs">
      <div class="astryx-panel-head"><h3>Your filing</h3><span class="sub">EAD = work permit · GC = conditional 2-yr</span></div>
      <div class="astryx-panel-body">
        <div class="astryx-row">
          <div class="astryx-field"><label>Birth country</label>
            <select id="axCountry"><option value="row">Rest of World (ROW)</option><option value="india">India</option><option value="china">China</option></select>
          </div>
          <div class="astryx-field"><label>Category</label>
            <select id="axCat"><option value="rural">Rural ($800K)</option><option value="hua">High Unemployment — HUA</option><option value="infra">Infrastructure</option><option value="unreserved">Unreserved ($1.05M)</option></select>
          </div>
        </div>
        <div class="astryx-row">
          <div class="astryx-field"><label>Filing date</label><input type="date" id="axDate"></div>
          <div class="astryx-field"><label>Path</label>
            <select id="axPath"><option value="aos">AOS (I-485, in US)</option><option value="consular">Consular (abroad)</option></select>
          </div>
        </div>
        <div class="astryx-toggle"><div><b>Unreserved overflow</b><br><span>Can set-aside investors claim Unreserved visas in PD order? (DOS yes, USCIS AOS not yet)</span></div>
          <label style="display:flex;align-items:center;gap:6px;font-size:13px"><input type="checkbox" id="axOverflow" checked> allow</label>
        </div>
        <div class="astryx-slider">
          <label style="font-size:11.5px;font-weight:650;letter-spacing:.03em;text-transform:uppercase;color:#354052">Family multiplier <span id="axFamVal" style="font-weight:800;color:var(--astryx-accent)">2.0×</span> <span style="font-weight:400;text-transform:none;letter-spacing:0;color:#667085">(visas per petition after denials/family)</span></label>
          <input type="range" id="axFam" min="1.6" max="2.8" step="0.1" value="2.0">
          <div class="astryx-help">Lazicki assumes 2.0×. Move to 2.5–2.8 to see pessimistic (larger families / lower denials).</div>
        </div>
        <div class="astryx-help" style="padding:8px 10px;background:#f8fafc;border:1px solid #e8eaed">
          <b>What “filing today” means:</b> You are at the end of ~19,780 petitions (Apr22–Jun26) + 30k pipeline visas. Earlier filers in same country/category are ahead; later ROW demand adds.
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn small" id="axCopy">Copy estimate</button>
          <button class="btn small" id="axReset">Reset</button>
          <span class="astryx-help" id="axSourceNote" style="align-self:center"></span>
        </div>
      </div>
    </div>

    <div class="astryx-results" id="astryxResults">
      <div class="astryx-kpi" id="axEAD">
        <div><h4>EAD — work permit (I-765)</h4><div class="num" id="axEADNum">—</div><div class="unit" id="axEADSub"></div><div class="astryx-help" id="axEADNote" style="margin-top:6px"></div></div>
        <div class="side" id="axEADSide"></div>
      </div>
      <div class="astryx-kpi" id="axGC">
        <div><h4>Conditional green card — I-526E → visa → GC</h4><div class="num" id="axGCNum">—</div><div class="unit" id="axGCSub"></div><div class="astryx-help" id="axGCNote" style="margin-top:6px"></div></div>
        <div class="side" id="axGCSide"></div>
      </div>
      <div class="astryx-breakdown" id="axBreak">
        <div style="font-size:11.5px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:#667085">Timeline breakdown</div>
        <div class="astryx-bar"><span style="min-width:92px">I-526E</span><span class="seg" style="background:#e6f4f2"><i style="width:28%;background:#0e6b62"></i></span><span id="axBar1" style="min-width:92px;text-align:right"></span></div>
        <div class="astryx-bar"><span style="min-width:92px">Visa queue</span><span class="seg" style="background:#fffbeb"><i id="axBar2i" style="background:#d97706"></i></span><span id="axBar2" style="min-width:92px;text-align:right"></span></div>
        <div class="astryx-bar"><span style="min-width:92px">Consular/AOS</span><span class="seg" style="background:#f3f4f6"><i style="width:18%;background:#475569"></i></span><span id="axBar3" style="min-width:92px;text-align:right"></span></div>
        <div class="astryx-legend"><span><i style="background:#0e6b62"></i> I-526E median</span><span><i style="background:#d97706"></i> visa queue (dominates if >1yr)</span><span><i style="background:#475569"></i> AOS/consular</span></div>
        <div id="axRangeTable" style="margin-top:6px"></div>
      </div>
    </div>
  </div>

  <details class="astryx-provenance" style="margin-top:14px" open>
    <summary>Sources & assumptions — what this projects</summary>
    <div class="src" style="display:grid;gap:8px;margin-top:8px">
      <div><b>Sources (fetched <span id="axFetchDate">—</span>):</b> <span id="axSrcList"></span></div>
      <div><b>Pipeline:</b> <span id="axPipe"></span></div>
      <div><b>Supply:</b> <span id="axSupply"></span></div>
      <div><b>Processing:</b> <span id="axProc"></span></div>
      <div><b>Caveats:</b> Excel Summary2/Infra tabs not OCR’d (formulas image-only), FY26 limits unpublished (DOS silence May 2025), 400/200 Infra inferred, 2.0× vs 2.8 family, ROW Unreserved 0/30/100% swings 4–38yr, “Current” = few qualified (~687/Q3) + slow DOS not no backlog, not FIFO. Model = Lazicki backlog logic (pipeline vs annual per-country caps). <a href="https://blog.lucidtext.com/eb-5-timing/" target="_blank" rel="noopener">EB5 Timing</a> · <a href="https://blog.lucidtext.com/2026/03/05/eb-5-set-aside-visa-backlog-and-outlook-update-as-of-march-2026-set-aside-backlog-size-unreserved-visa-availability-infrastructure-visa-bulletin-outlook/" target="_blank">Mar 5 Backlog</a> · <a href="https://blog.lucidtext.com/2026/03/06/infrastructure-revision/" target="_blank">Infra Rev</a> · <a href="https://blog.lucidtext.com/2026/09/09/sluggish-volumes-and-rising-denial-rates-continue-in-fy2026-q3-processing-data/" target="_blank">Q3 Data</a></div>
      <div class="astryx-foot">Not investment/legal/tax advice. Confirm with counsel. Attribution: Suzanne Lazicki, Lucid Professional Writing, blog.lucidtext.com. Host updates via daily <code>data/lucid-snapshot.json</code> sync.</div>
    </div>
  </details>
  `;
  root.innerHTML = html;
}

function updateProvenance(){
  const snap = SNAP||FALLBACK;
  const el = (id,v)=>{ const e=document.getElementById(id); if(e) e.textContent=v; };
  const htmlList = (snap.sources||[]).map(s=> `<a href="${s.url}" target="_blank" rel="noopener">${s.name||s.url}</a>`).join(' · ');
  const srcEl=document.getElementById('axSrcList'); if(srcEl) srcEl.innerHTML=htmlList||'fallback (offline)';
  const f=document.getElementById('axFetchDate'); if(f) f.textContent = (snap.updatedAt||'') + (LAST_FETCH?` · synced ${LAST_FETCH.slice(0,10)}`:' · offline fallback');
  const p=document.getElementById('axPipe'); if(p) p.textContent = `${snap.pipeline.totalPetitions.toLocaleString()} petitions Apr22–Jun26 (China ${(snap.pipeline.byCountry.chinaPct*100).toFixed(0)}% India ${(snap.pipeline.byCountry.indiaPct*100).toFixed(0)}% ROW ${(snap.pipeline.byCountry.rowPct*100).toFixed(0)}%) → ~${snap.pipeline.estimatedVisas.grandTotal.toLocaleString()} visas inc. 30k set-aside @ 2.0×`;
  const s=document.getElementById('axSupply'); if(s) s.textContent = `10k/yr total — Rural ${snap.supply.rural.typical} (FY26 ${snap.supply.rural.fy26}) · HUA ${snap.supply.hua.typical} · Infra ${snap.supply.infra.firstYear}→${snap.supply.infra.typical} · Unreserved ${snap.supply.unreserved.typical} · per-country 7.1% when retrogressed`;
  const pr=document.getElementById('axProc'); if(pr) pr.textContent = `I-526E ${snap.processing.i526e.medianMonths}mo median, ${snap.processing.i526e.pending.toLocaleString()} pending, ${(snap.processing.i526e.denialRate*100).toFixed(0)}% denial Q3 (${snap.processing.i526e.approvedQ3} approved) · I-956F 5.4mo · I-485 inventory Rural ~${snap.i485Inventory.ruralPending.toLocaleString()} HUA ~${snap.i485Inventory.huaPending.toLocaleString()} Infra ~${snap.i485Inventory.infraPending}`;
  const live=document.getElementById('astryxLive'); if(live){
    const isStale = !LAST_FETCH;
    live.className = 'astryx-live'+(isStale?' warn':'');
    live.innerHTML = `<i></i> ${isStale?'Fallback':'Live'}: LucidText ${snap.updatedAt} · I-526E ${snap.processing.i526e.medianMonths}mo median ${isStale?'(offline — using embedded)':''}`;
  }
}

function recalc(){
  const country = document.getElementById('axCountry').value;
  const category = document.getElementById('axCat').value;
  const date = document.getElementById('axDate').value;
  const aos = document.getElementById('axPath').value;
  const fam = parseFloat(document.getElementById('axFam').value);
  const withOverflow = document.getElementById('axOverflow').checked;
  document.getElementById('axFamVal').textContent = fam.toFixed(1)+'×';

  // EAD
  const ead = eadEstimate({country, category, filingDate: date});
  const eadNum=document.getElementById('axEADNum'), eadSub=document.getElementById('axEADSub'), eadNote=document.getElementById('axEADNote'), eadSide=document.getElementById('axEADSide');
  if(ead.isCurrent){
    eadNum.textContent = '6 – 12 months';
    eadSub.textContent = 'after filing (concurrent I-485 → I-765)';
    eadNote.textContent = ead.note;
    eadSide.innerHTML = `<b style="color:#065f46">Current</b><div>File I-485 + I-765 together</div><div>med 8mo</div>`;
    document.getElementById('axEAD').className='astryx-kpi';
  } else {
    const w = ead.waitYears || yearsFor({country, category, family:fam, withOverflow}).yrs;
    eadNum.textContent = formatYears(w) + ' + 8mo';
    eadSub.textContent = 'until filing date current + EAD processing';
    eadNote.textContent = ead.note;
    eadSide.innerHTML = `<b style="color:#92400e">Not current</b><div>Wait for PDB</div><div>${formatYears(w)} queue</div>`;
    document.getElementById('axEAD').className='astryx-kpi warn';
  }

  // GC
  const gc = gcEstimate({country, category, family:fam, withOverflow, aos});
  const totalY = gc.total;
  const gcNum=document.getElementById('axGCNum'), gcSub=document.getElementById('axGCSub'), gcNote=document.getElementById('axGCNote'), gcSide=document.getElementById('axGCSide');
  gcNum.textContent = formatRange(totalY) + (totalY>=20? '':'  (base '+totalY.toFixed(1)+'y)');
  gcSub.textContent = gc.breakdown;
  // Special messaging for Infra India/China set-aside only
  let infraNote='';
  if(category==='infra' && (country==='india'||country==='china') && !withOverflow){
    infraNote=' · Infra-only: 0 to multi-decade depending on flurry sort — with overflow you are no worse than Rural/HUA (~7y).';
  }
  gcNote.textContent = `Queue ${formatYears(gc.queue.yrs)} @ ${gc.queue.cap}/yr caps (${Math.round(gc.queue.pipeline)} visas in your slice)${infraNote} · 3–5yr market claim vanishingly improbable per Mar 5.`;
  // Side: base case
  gcSide.innerHTML = `<b>${formatYears(totalY)} total</b><div>base case @ ${fam.toFixed(1)}×</div><div>lo ${formatYears(gc.totalLo)} · hi ${formatYears(gc.totalHi)}</div>`;
  document.getElementById('axGC').className = totalY>=7 ? 'astryx-kpi warn' : 'astryx-kpi';

  // Bars
  const procPct = Math.min(42, (gc.procMonths/12)/Math.max(1,totalY)*100);
  const queuePct = Math.min(78, gc.queue.yrs/Math.max(1,totalY)*100);
  const consPct = Math.min(26, (gc.consularMonths/12)/Math.max(1,totalY)*100);
  document.getElementById('axBar1').textContent = gc.procMonths+' mo';
  const bar2i=document.getElementById('axBar2i'); if(bar2i) bar2i.style.width = queuePct.toFixed(0)+'%';
  document.getElementById('axBar2').textContent = formatYears(gc.queue.yrs);
  document.getElementById('axBar3').textContent = gc.consularMonths+' mo';
  // Range table
  const rt=document.getElementById('axRangeTable');
  if(rt){
    const row = (label, y, cap, pipe) => `<tr><td>${label}</td><td class=num>${formatYears(y)}</td><td>${cap}/yr</td><td>${Math.round(pipe).toLocaleString()} slice visas</td></tr>`;
    const yNo = yearsFor({country, category, family:fam, withOverflow:false});
    const yYes = yearsFor({country, category, family:fam, withOverflow:true});
    rt.innerHTML = `<table class="astryx-table"><thead><tr><th>Scenario</th><th>Queue</th><th>Cap</th><th>Your slice</th></tr></thead><tbody>
      ${row('Set-aside only', yNo.yrs, yNo.cap, yNo.pipeline)}
      ${row('With Unreserved', yYes.yrs, yYes.cap, yYes.pipeline)}
    </tbody></table><div class="astryx-help" style="margin-top:6px">Slice = category pipeline × country share × family/2. Set-aside only uses per-category per-country cap; With Unreserved uses ~700/yr total per-country (ROW ~5.2k). True wait = max(queue, I-526E) + AOS/consular.</div>`;
  }

  // provenance live chip
  updateProvenance();
}

export { yearsFor, formatYears, formatRange, eadEstimate, gcEstimate, loadSnapshot, FALLBACK };
export async function mountAstryxEstimator(selector='#estimatorMount'){
  const mount = document.querySelector(selector);
  if(!mount){ console.warn('Astryx mount not found', selector); return; }
  await loadSnapshot();
  renderEstimatorRoot(mount);
  // defaults
  const d=document.getElementById('axDate'); if(d) d.valueAsDate = new Date();
  // listeners
  ['axCountry','axCat','axPath','axOverflow'].forEach(id=>{
    const e=document.getElementById(id); if(e) e.addEventListener('change', recalc);
  });
  const fam=document.getElementById('axFam'); if(fam) fam.addEventListener('input', recalc);
  document.getElementById('axCopy')?.addEventListener('click', ()=>{
    const country=document.getElementById('axCountry').value, cat=document.getElementById('axCat').value, famv=document.getElementById('axFam').value, withO=document.getElementById('axOverflow').checked;
    const gcNum=document.getElementById('axGCNum').textContent, eadNum=document.getElementById('axEADNum').textContent;
    const txt = `EB-5 estimate (${country} ${cat} @ ${famv}× ${withO?'with':'no'} overflow): EAD ${eadNum}, GC ${gcNum} — via blog.lucidtext.com model ${SNAP?.updatedAt}`;
    navigator.clipboard.writeText(txt); const b=document.getElementById('axCopy'); const t=b.textContent; b.textContent='Copied'; setTimeout(()=>b.textContent=t,1200);
  });
  document.getElementById('axReset')?.addEventListener('click', ()=>{
    document.getElementById('axCountry').value='row'; document.getElementById('axCat').value='rural'; document.getElementById('axOverflow').checked=true; document.getElementById('axFam').value='2.0'; document.getElementById('axPath').value='aos'; recalc();
  });
  document.getElementById('axSourceNote').textContent = LAST_FETCH? 'Live snapshot loaded' : 'Offline fallback — will sync when data/lucid-snapshot.json reachable';
  recalc();
}

// Auto-mount if mount exists on DOMContentLoaded
if(typeof window!=='undefined'){
  window.AstryxEstimator = { mountAstryxEstimator, loadSnapshot, yearsFor, formatYears };
  document.addEventListener('DOMContentLoaded', ()=>{ if(document.querySelector('#estimatorMount')) mountAstryxEstimator('#estimatorMount'); });
}
