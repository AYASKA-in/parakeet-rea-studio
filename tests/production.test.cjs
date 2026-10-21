const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createHttpClient,retryAfterMs}=require('../electron/http.cjs');
const {createStorage}=require('../electron/storage.cjs');
const {retainedWorkspace,encodeWorkspace,decodeWorkspace}=require('../electron/workspace-privacy.cjs');
const {createDiagnostics}=require('../electron/diagnostics.cjs');

test('retry hints accept seconds and HTTP dates; waits fit deadlines and never replay quota errors',async()=>{
 const now=Date.parse('2026-10-20T12:00:00Z');assert.equal(retryAfterMs('2',now),2000);assert.equal(retryAfterMs('Tue, 20 Oct 2026 12:00:03 GMT',now),3000);assert.equal(retryAfterMs('bad',now),null);
 let calls=0;const waits=[];const client=createHttpClient({now:()=>now,random:()=>0});
 const result=await client('http://local',{}, {fetchImpl:async()=>new Response('',{status:++calls===1?503:200,headers:{'retry-after':'2'}}),wait:async ms=>waits.push(ms)});assert.equal(result.status,200);assert.deepEqual(waits,[2000]);
 calls=0;const short=await client('http://short',{}, {deadlineAt:now+1000,fetchImpl:async()=>{calls++;return new Response('',{status:503,headers:{'retry-after':'2'}});},wait:async()=>assert.fail('No time for retry')});assert.equal(short.status,503);assert.equal(calls,1);
});
test('quota cooldown is origin scoped, expires and does not store or expose credentials',async()=>{
 let now=1000,calls=0;const client=createHttpClient({now:()=>now});const fetchImpl=async()=>{calls++;return new Response('',{status:calls===1?429:200,headers:{'retry-after':'4'}});};
 assert.equal((await client('http://quota/v1',{headers:{Authorization:'secret'}},{fetchImpl})).status,429);
 await assert.rejects(()=>client('http://quota/v2',{}, {fetchImpl}),e=>e.code==='PROVIDER_COOLDOWN'&&e.retryAfterMs===4000&&!e.message.includes('secret'));assert.equal(calls,1);
 assert.equal((await client('http://other',{}, {fetchImpl})).status,200);now+=4001;assert.equal((await client('http://quota',{}, {fetchImpl})).status,200);
});
test('repeated network failures open a bounded circuit and cancellation stops the retry wait',async()=>{
 let now=0,calls=0;const client=createHttpClient({now:()=>now,random:()=>0});const offline=async()=>{calls++;throw new TypeError('offline');};
 for(let i=0;i<3;i++)await assert.rejects(()=>client('http://offline',{}, {fetchImpl:offline,wait:async()=>{}}),/offline/);
 assert.equal(calls,6);await assert.rejects(()=>client('http://offline',{}, {fetchImpl:offline}),/cooling down/);assert.equal(calls,6);
 now=16000;await assert.rejects(()=>client('http://offline',{}, {fetchImpl:offline,wait:async()=>{}}),/offline/);
 const controller=new AbortController();calls=0;
 await assert.rejects(()=>createHttpClient()('http://cancel',{signal:controller.signal},{fetchImpl:async()=>{calls++;return new Response('',{status:503});},wait:async()=>{controller.abort();controller.signal.throwIfAborted();}}),{name:'AbortError'});assert.equal(calls,1);
});
test('retention preserves unknown dates, memory-only excludes all personal workspace data',()=>{
 const now=Date.parse('2026-10-20'),value={context:{resume:'PRIVATE'},sessions:[{id:'old',createdAt:'2020-01-01'},{id:'new',createdAt:'2026-10-19'},{id:'unknown'}]};
 assert.deepEqual(retainedWorkspace(value,{retentionDays:7},now).sessions.map(s=>s.id),['new','unknown']);assert.deepEqual(retainedWorkspace(value,{historyMode:'ephemeral'},now),{context:{},sessions:[]});assert.equal(value.sessions.length,3);
});
test('workspace codec never falls back to plaintext and preserves files on decryption failure',async()=>{
 const crypto={isAsyncEncryptionAvailable:async()=>true,encryptStringAsync:async text=>Buffer.from(text.split('').reverse().join('')),decryptStringAsync:async bytes=>({result:bytes.toString().split('').reverse().join('')})};
 const value={context:{resume:'PRIVATE'},sessions:[]};const encoded=await encodeWorkspace(value,{encryptWorkspace:true},crypto);assert.ok(!JSON.stringify(encoded).includes('PRIVATE'));assert.equal((await decodeWorkspace(encoded,crypto)).context.resume,'PRIVATE');
 await assert.rejects(()=>encodeWorkspace(value,{encryptWorkspace:true},{isAsyncEncryptionAvailable:async()=>false}),/No plaintext fallback/);
 await assert.rejects(()=>decodeWorkspace(encoded,{isAsyncEncryptionAvailable:async()=>false}),/no data was reset/);
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'parakeet-privacy-'));try{const store=createStorage(dir);await store.write('workspace.json',value);await store.write('workspace.json',encoded,{preservePrevious:false});for(const suffix of ['', '.bak'])assert.ok(!(await fs.readFile(path.join(dir,'workspace.json'+suffix),'utf8')).includes('PRIVATE'));await store.write('workspace.json',await encodeWorkspace(value,{historyMode:'ephemeral'},crypto),{preservePrevious:false});for(const suffix of ['', '.bak'])assert.deepEqual(JSON.parse(await fs.readFile(path.join(dir,'workspace.json'+suffix),'utf8')),{context:{},sessions:[]});}finally{assert.equal(path.dirname(dir),os.tmpdir());await fs.rm(dir,{recursive:true,force:true});}
});
test('diagnostics enforce a content-free allowlist, bound retention and include failures in denominator',()=>{
 const data=createDiagnostics(3);data.add({question:'SECRET',model:'SECRET',firstTextMs:1,outcome:'success',save:'durable'});data.add({firstTextMs:10,outcome:'success',save:'durable'});data.add({outcome:'cancelled'});data.add({outcome:'error',firstTextMs:Infinity,error:'SECRET',savedMs:-5});const report=data.report();assert.equal(report.attempts,3);assert.ok(!JSON.stringify(report).includes('SECRET'));assert.equal(report.groups[0].attempts,3);assert.equal(report.groups[0].successes,1);assert.equal(report.groups[0].cancellations,1);assert.equal(report.groups[0].errors,1);assert.equal(report.groups[0].stages.firstTextMs.p95,10);assert.equal(report.rows.at(-1).savedMs,null);data.clear();assert.equal(data.report().attempts,0);
});


test('unknown future workspace formats fail closed instead of resetting history',async()=>{
 await assert.rejects(()=>decodeWorkspace({format:'parakeet-workspace-dpapi-v2',ciphertext:'future'},{}),/no data was reset/);
});


test('history capacity counts UTF-8 bytes so encrypted workspaces can be read back within budget',()=>{
 const {sanitizeWorkspace}=require('../electron/core.cjs');const sessions=[{id:'unicode',text:'界'.repeat(6*1024*1024)}];assert.throws(()=>sanitizeWorkspace({sessions}),/16 MB/);assert.equal(sessions[0].text.length,6*1024*1024);
});


test('local discovery never contacts remote/non-local providers and bounds model-list responses',async()=>{
 const {checkLocalProvider}=require('../electron/local-provider.cjs');const {DEFAULT_SETTINGS}=require('../electron/core.cjs');let calls=0;const fetchImpl=async()=>{calls++;return new Response(JSON.stringify({data:[{id:'answer'},{id:'speech'}]}));};
 await assert.rejects(()=>checkLocalProvider({...DEFAULT_SETTINGS,dataPolicy:'local'},'secret',{fetchImpl}),/loopback/);assert.equal(calls,0);
 const profile={...DEFAULT_SETTINGS,provider:'openai',baseUrl:'http://127.0.0.1:1234/v1',dataPolicy:'local',model:'answer',transcriptionModel:'speech'};const result=await checkLocalProvider(profile,'local',{fetchImpl});assert.equal(result.answerModelListed,true);assert.equal(result.transcriptionModelListed,true);assert.equal(calls,1);
 await assert.rejects(()=>checkLocalProvider(profile,'local',{fetchImpl:async()=>new Response('x'.repeat(70000))}),/size limit/);
});

async function quickCapture(){const source=await require('node:fs/promises').readFile(require('node:path').join(__dirname,'../renderer/screen-analysis.js'),'utf8');return (await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).captureScreenshotAnswer;}
test('quick capture validates the selected display lease without window control and preserves detail pixels',async()=>{const capture=await quickCapture(),calls=[];const image=await capture({captureScreenshot:async input=>{calls.push(input);return {dataUrl:'data:image/jpeg;base64,fixture',captureId:'lease'};},validateScreenshot:async input=>calls.push(input)},'',{displayId:'second'});assert.deepEqual(calls,[{displayId:'second'},{captureId:'lease'}]);assert.equal(image.screenQuality,'detail');assert.equal(image.imageDataUrl,'data:image/jpeg;base64,fixture');assert.match(image.question,/edge cases/);});
test('quick capture cancels after acquisition and never uploads an invalidated lease',async()=>{const capture=await quickCapture(),controller=new AbortController();let validates=0;assert.equal(await capture({captureScreenshot:async()=>{controller.abort();return {};},validateScreenshot:async()=>validates++},'',{signal:controller.signal}),null);assert.equal(validates,0);await assert.rejects(capture({captureScreenshot:async()=>({captureId:'old'}),validateScreenshot:async()=>{throw new Error('Display changed');}}),/Display changed/);});
