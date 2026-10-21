const kinds=['asr','coding','screens','resumes'];
const outcomes=['pass','incorrect','provider-error','execution-timeout','execution-error','evaluation-error','unclassified-error'];
const finite=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const summary=values=>{const a=values.filter(finite).sort((x,y)=>x-y);return {samples:a.length,p50:a.length?a[Math.ceil(a.length*.5)-1]:null,p95:a.length?a[Math.ceil(a.length*.95)-1]:null};};
const safeModel=value=>typeof value==='string'&&/^[a-zA-Z0-9_.:/-]{1,100}$/.test(value)&&!/(?:AIza|AQ\.)/.test(value)?value:'unspecified';
function qualitySummary(reports){
 if(!Array.isArray(reports)||!reports.length)throw new Error('At least one evaluation receipt is required.');
 const groups=new Map();
 for(const report of reports){
  if(!kinds.includes(report?.kind)||!Array.isArray(report.cases)||report.cases.length>10000||!Number.isInteger(report.attempted)||report.attempted!==report.cases.length)throw new Error('Receipt attempt count or kind is invalid.');
  const planned=Number.isInteger(report.planned)?report.planned:null;
  if(planned!==null&&planned<report.attempted)throw new Error('Planned attempts cannot be below attempted.');
  const provider=['gemini','openai'].includes(report.provider)?report.provider:'unspecified';
  const key=[report.kind,provider,safeModel(report.model),report.kind==='asr'?['SMART','VERBATIM'].includes(report.transcriptionMode)?report.transcriptionMode:'unspecified':'n/a'].join('/');
  if(!groups.has(key))groups.set(key,{group:key,receipts:0,attempted:0,planned:0,unknownPlans:0,syntheticReceipts:0,humanReceipts:0,rows:[],families:new Set(),sources:new Set()});
  const g=groups.get(key);g.receipts++;g.attempted+=report.attempted;if(planned===null)g.unknownPlans++;else g.planned+=planned;
  if(report.syntheticOnly===true)g.syntheticReceipts++;if(report.humanAudioConsented===true)g.humanReceipts++;
  if(report.sourceHashes&&typeof report.sourceHashes==='object')g.sources.add(require('node:crypto').createHash('sha256').update(JSON.stringify(Object.entries(report.sourceHashes).filter(([k,v])=>/^[a-f0-9]{64}$/.test(v)).sort())).digest('hex'));
  const seen=new Set();
  for(const row of report.cases){
   if(!row||typeof row.id!=='string'||seen.has(row.id)||typeof row.passed!=='boolean')throw new Error('Receipt rows require unique identities and boolean grades.');
   seen.add(row.id);if(typeof row.family==='string')g.families.add(row.family);
   const outcome=outcomes.includes(row.outcome)?row.outcome:row.passed?'pass':row.error?'unclassified-error':'incorrect';
   if((outcome==='pass')!==row.passed)throw new Error('Receipt outcome contradicts the grade.');
   g.rows.push({passed:row.passed,outcome,elapsedMs:row.elapsedMs,providerMs:row.providerMs,gradingMs:row.gradingMs,asrEndToFinalMs:report.kind==='asr'&&report.asrEndpointTimingVersion==='last-frame-submitted-v1'?row.asrEndToFinalMs:null,unversionedAsrEndMs:report.kind==='asr'&&report.asrEndpointTimingVersion!=='last-frame-submitted-v1'?row.asrEndToFinalMs:null});
  }
 }
 return {
  schemaVersion:1,scope:'Finite public developer cases; family variants and repeated runs are correlated. Not a blinded holdout, correctness guarantee or production SLO.',
  timingNotes:'Provider intervals exclude code execution/grading; ASR provider intervals include clip replay. No first-token, question-end or semantic useful-answer latency is inferred. Only last-frame-submitted-v1 receipts contribute to asrEndToFinalMs; unversioned endpoint values stay separate as unversionedAsrEndMs. Historical receipts without stage timings remain unknown.',
  groups:[...groups.values()].map(g=>({
   group:g.group,receipts:g.receipts,attempted:g.attempted,passed:g.rows.filter(r=>r.passed).length,failed:g.rows.filter(r=>!r.passed).length,
   planned:g.unknownPlans?null:g.planned,unattempted:g.unknownPlans?null:g.planned-g.attempted,receiptsWithoutPlan:g.unknownPlans,
   passRateOnAttempts:g.attempted?g.rows.filter(r=>r.passed).length/g.attempted:null,
   distinctFamilies:g.families.size,sourceRevisions:g.sources.size,mixedSourceRevisions:g.sources.size>1,
   syntheticReceipts:g.syntheticReceipts,humanConsentedReceipts:g.humanReceipts,
   outcomes:Object.fromEntries(outcomes.map(o=>[o,g.rows.filter(r=>r.outcome===o).length])),
   durations:Object.fromEntries(['elapsedMs','providerMs','gradingMs','asrEndToFinalMs','unversionedAsrEndMs'].map(name=>[name,summary(g.rows.map(r=>r[name]))])),
   evidenceSufficientForProductionClaim:false
  }))
 };
}
module.exports={qualitySummary};
