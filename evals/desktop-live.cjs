const fs=require('node:fs');
function readPcmWave(bytes){
 if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE')throw Error('Expected a WAV fixture.');let pcm,format;
 for(let at=12;at+8<=bytes.length;){const n=bytes.readUInt32LE(at+4),end=at+8+n;if(end>bytes.length)throw Error('Truncated WAV fixture.');const name=bytes.toString('ascii',at,at+4);if(name==='fmt '){if(n<16)throw Error('Invalid WAV format.');format=[bytes.readUInt16LE(at+8),bytes.readUInt16LE(at+10),bytes.readUInt32LE(at+12),bytes.readUInt16LE(at+22)];}if(name==='data')pcm=bytes.subarray(at+8,end);at=end+(n%2);}
 if(JSON.stringify(format)!=='[1,1,16000,16]'||!pcm?.length||pcm.length%2)throw Error('Expected nonempty 16 kHz mono PCM16.');let last=pcm.length/2-1;while(last>=0&&Math.abs(pcm.readInt16LE(last*2))<164)last--;if(last<0)throw Error('Fixture contains no speech signal.');return {pcm,endpointSeconds:(last+1)/16000,durationSeconds:pcm.length/32000};
}
function reserveRequest(file,kind){
 const ledger=JSON.parse(fs.readFileSync(file,'utf8'));
 if(!Number.isInteger(ledger.maximumCalls)||ledger.maximumCalls<1||ledger.maximumCalls>12||!Number.isInteger(ledger.used)||ledger.used<0||!Array.isArray(ledger.requests)||ledger.requests.length!==ledger.used)throw Error('Invalid benchmark ledger.');
 if(!['answer-http','transcription-websocket'].includes(kind))throw Error('Invalid request kind.');
 if(ledger.blocked||ledger.used>=ledger.maximumCalls)throw Object.assign(Error('Benchmark request budget stopped.'),{name:'AbortError'});
 ledger.used++;ledger.requests.push({kind,caseId:ledger.currentCase,at:new Date().toISOString()});fs.writeFileSync(file,JSON.stringify(ledger,null,2)+'\n');return ledger.used;
}
const percentile=(values,p)=>{const v=values.filter(x=>Number.isFinite(x)&&x>=0).sort((a,b)=>a-b);return {samples:v.length,value:v.length?v[Math.ceil(v.length*p)-1]:null};};
function summarize(rows){const groups=new Map();for(const row of rows){const key=row.kind+'/'+row.transport;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}return [...groups].map(([group,items])=>({group,attempts:items.length,successes:items.filter(r=>r.metric?.outcome==='success').length,failures:items.filter(r=>r.metric?.outcome!=='success').length,durableSaves:items.filter(r=>r.metric?.save==='durable'&&r.persistedAnswerMatches).length,measurements:Object.fromEntries(['firstVisibleMs','first40VisibleMs','overlayFirstVisibleMs','completeMs','savedMs','saveAfterCompleteMs'].map(k=>{const values=items.map(r=>r.timings?.[k]);return [k,{p50:percentile(values,.5),p95:percentile(values,.95)}];})),productionSloEstablished:false}));}
module.exports={readPcmWave,reserveRequest,summarize};
