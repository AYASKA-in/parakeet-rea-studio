const STAGES = ['speechEndMs','finalTranscriptMs','requestMs','firstTextMs','firstUsefulTextMs','completedMs','savedMs'];
const enumeration = (value, choices, fallback) => choices.includes(value) ? value : fallback;
function sanitizeMetric(value = {}) {
  const row = { mode: enumeration(value.mode,['fast','balanced','deep'],'balanced'), network: enumeration(value.network,['standard','economy'],'standard'), kind: enumeration(value.kind,['typed','audio','screen','notes'],'typed'), outcome: enumeration(value.outcome,['success','error','partial','cancelled'],'error'), save: enumeration(value.save,['durable','failed','memory-only'],'failed') };
  row.failureCategory=enumeration(value.failureCategory,['none','quota','cooldown','authentication','cancelled','timeout','connection','error'],'none');
  for (const stage of STAGES) row[stage] = Number.isFinite(value[stage]) && value[stage] >= 0 && value[stage] <= 86400000 ? Math.round(value[stage]) : null;
  return row;
}
const DURATION_PAIRS={recognitionLag:['speechEndMs','finalTranscriptMs'],queueWait:['finalTranscriptMs','requestMs'],providerFirstUseful:['requestMs','firstUsefulTextMs'],questionToFirstUseful:['speechEndMs','firstUsefulTextMs'],questionToComplete:['speechEndMs','completedMs'],durableSave:['completedMs','savedMs']};
function durations(row){return Object.fromEntries(Object.entries(DURATION_PAIRS).map(([name,[a,b]])=>[name,Number.isFinite(row[a])&&Number.isFinite(row[b])&&row[b]>=row[a]?row[b]-row[a]:null]));}
const percentile = (values, p) => { values = values.filter(Number.isFinite).sort((a,b)=>a-b); return values.length ? values[Math.ceil(values.length*p)-1] : null; };
function createDiagnostics(limit = 500) {
  const rows = [];
  return {
    add(value) { rows.push(sanitizeMetric(value)); if(rows.length>limit)rows.shift(); return { ok:true }; },
    clear() { rows.length=0; },
    report() {
      const groups = new Map();
      for(const row of rows) { const key = row.mode+'/'+row.network+'/'+row.kind; if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row); }
      return { schemaVersion:2, scope:'Current app process only; maximum '+limit+' attempts; no content or provider error strings.', attempts:rows.length, groups:[...groups].map(([group,items])=>({group,attempts:items.length,successes:items.filter(r=>r.outcome==='success').length,errors:items.filter(r=>r.outcome==='error').length,partials:items.filter(r=>r.outcome==='partial').length,cancellations:items.filter(r=>r.outcome==='cancelled').length,failureCategories:Object.fromEntries(['quota','cooldown','authentication','cancelled','timeout','connection','error'].map(category=>[category,items.filter(r=>r.failureCategory===category).length])),saveFailures:items.filter(r=>r.save==='failed').length, durations:Object.fromEntries(Object.keys(DURATION_PAIRS).map(name=>{const values=items.map(row=>durations(row)[name]);return [name,{samples:values.filter(Number.isFinite).length,p50:percentile(values,.5),p95:percentile(values,.95)}];})),stages:Object.fromEntries(STAGES.map(stage=>[stage,{samples:items.filter(r=>Number.isFinite(r[stage])).length,p50:percentile(items.map(r=>r[stage]),.5),p95:percentile(items.map(r=>r[stage]),.95)}]))})), rows:rows.map(row=>({...row})) };
    }
  };
}
module.exports = { createDiagnostics, sanitizeMetric, durations };
