const {randomUUID}=require('node:crypto');
const STAGES = ['captureStartMs','captureEndMs','speechEndMs','finalTranscriptMs','requestMs','firstTextMs','firstUsefulTextMs','firstRenderedMs','completedMs','attemptEndMs','savedMs'];
const CATEGORIES=['none','quota','cooldown','authentication','cancelled','timeout','connection','capture','error'];
const enumeration=(value,choices,fallback)=>choices.includes(value)?value:fallback;
function sanitizeMetric(value={}) {
 if(!value||typeof value!=='object'||Array.isArray(value))value={};
 const row={
  mode:enumeration(value.mode,['fast','balanced','deep'],'balanced'),
  network:enumeration(value.network,['standard','economy'],'standard'),
  kind:enumeration(value.kind,['typed','audio','screen','notes'],'typed'),
  endpointSource:enumeration(value.endpointSource,['estimated-audio','final-transcript','capture-action','request-start'],'request-start'),
  outcome:enumeration(value.outcome,['success','error','partial','cancelled'],'error'),
  save:enumeration(value.save,['durable','failed','memory-only','not-applicable'],'failed'),
  failureCategory:enumeration(value.failureCategory,CATEGORIES,value.outcome==='success'?'none':'error')
 };
 for(const stage of STAGES)row[stage]=Number.isFinite(value[stage])&&value[stage]>=0&&value[stage]<=86400000?Math.round(value[stage]):null;
 return row;
}
const DURATION_PAIRS={
 capture:['captureStartMs','captureEndMs'],
 recognitionLag:['speechEndMs','finalTranscriptMs'],
 queueWait:['finalTranscriptMs','requestMs'],
 providerFirstUseful:['requestMs','firstUsefulTextMs'],
 requestToFirstRender:['requestMs','firstRenderedMs'],
 questionToFirstUseful:['speechEndMs','firstUsefulTextMs'],
 questionToComplete:['speechEndMs','completedMs'],
 screenToFirstUseful:['captureStartMs','firstUsefulTextMs'],
 screenToFirstRender:['captureStartMs','firstRenderedMs'],
 screenToComplete:['captureStartMs','completedMs'],
 durableSave:['completedMs','savedMs']
};
function durations(row) {
 const result=Object.fromEntries(Object.entries(DURATION_PAIRS).map(([name,[a,b]])=>[name,Number.isFinite(row[a])&&Number.isFinite(row[b])&&row[b]>=row[a]?row[b]-row[a]:null]));
 result.attempt=Number.isFinite(row.attemptEndMs)?row.attemptEndMs:null;
 return result;
}
const percentile=(values,p)=>{values=values.filter(Number.isFinite).sort((a,b)=>a-b);return values.length?values[Math.ceil(values.length*p)-1]:null;};
const summary=values=>({samples:values.filter(Number.isFinite).length,p50:percentile(values,.5),p95:percentile(values,.95)});
function createDiagnostics(limit=500) {
 if(!Number.isInteger(limit)||limit<1||limit>5000)throw new Error('Invalid diagnostic retention limit.');
 const rows=[];let totalAttempts=0;
 return {
  add(value){rows.push({...sanitizeMetric(value),attemptId:randomUUID()});totalAttempts++;if(rows.length>limit)rows.shift();return {ok:true};},
  clear(){rows.length=0;totalAttempts=0;},
  report(){
   const groups=new Map();
   for(const row of rows){const key=row.mode+'/'+row.network+'/'+row.kind;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
   return {
    schemaVersion:3,
    scope:'Current app process only; maximum '+limit+' retained attempts; no content or provider error strings.',
    measurementNotes:{
     outcome:'Success means generation completed, not factual correctness; inspect save status separately.',
     speechEndMs:'Estimated from local audio activity, not provider word timestamps.',
     firstUsefulTextMs:'At least 40 non-markup characters: a length proxy, not a semantic quality judgment.',
     firstRenderedMs:'First nonempty answer or notes DOM update in the workspace; not physical display paint or overlay rendering.',
     completedMs:'Successful generation completion only; failed and cancelled attempts use attemptEndMs.',
     attemptId:'Random process-local diagnostic ID generated in the main process; not a session, transcript or provider ID.',
     percentiles:'Retained attempts with each available valid duration; inspect sample counts and failures together.'
    },
    attempts:rows.length,totalAttempts,evictedAttempts:totalAttempts-rows.length,
    groups:[...groups].map(([group,items])=>({
     group,attempts:items.length,
     successes:items.filter(r=>r.outcome==='success').length,
     errors:items.filter(r=>r.outcome==='error').length,
     partials:items.filter(r=>r.outcome==='partial').length,
     cancellations:items.filter(r=>r.outcome==='cancelled').length,
     failureCategories:Object.fromEntries(CATEGORIES.filter(c=>c!=='none').map(c=>[c,items.filter(r=>r.failureCategory===c).length])),
     saveFailures:items.filter(r=>r.save==='failed').length,
     durations:Object.fromEntries([...Object.keys(DURATION_PAIRS),'attempt'].map(name=>[name,summary(items.map(row=>durations(row)[name]))])),
     stages:Object.fromEntries(STAGES.map(stage=>[stage,summary(items.map(r=>r[stage]))]))
    })),
    rows:rows.map(row=>({...row}))
   };
  }
 };
}
module.exports={createDiagnostics,sanitizeMetric,durations};
