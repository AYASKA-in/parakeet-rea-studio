const test=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
const {DEFAULT_SETTINGS,sanitizeWorkspace}=require('../electron/core.cjs');
const {credentialBinding,prepareOutbound,requireDataPolicy,personalDataRemoved,redactContacts}=require('../electron/safety.cjs');
const {readBoundedJson,jsonAnswer}=require('../electron/response.cjs');
test('credential identity binds provider and canonical origin; path changes retain origin identity',()=>{
 assert.equal(credentialBinding(DEFAULT_SETTINGS),credentialBinding({...DEFAULT_SETTINGS,baseUrl:'https://generativelanguage.googleapis.com:443/other'}));
 assert.notEqual(credentialBinding(DEFAULT_SETTINGS),credentialBinding({...DEFAULT_SETTINGS,baseUrl:'https://other.example.invalid'}));
});
test('outbound practice omits saved context/history, notes omit context, and contact filtering preserves constraints',()=>{
 const input={question:'Explain binary search for 1000000000 items',context:{resume:'SECRET RESUME test@example.invalid +91 99999 00000',notes:'PRIVATE'},transcript:'PRIVATE TRANSCRIPT',previousAnswers:[{answer:'PRIVATE ANSWER'}]};
 const safe=prepareOutbound(input,{...DEFAULT_SETTINGS,dataPolicy:'unpaid'});
 assert.deepEqual(safe.context,{});assert.equal(safe.transcript,'');assert.deepEqual(safe.previousAnswers,[]);assert.match(safe.question,/1000000000/);
 assert.deepEqual(prepareOutbound({...input,kind:'notes'},{...DEFAULT_SETTINGS,dataPolicy:'reviewed'}).context,{});
 assert.deepEqual(prepareOutbound({...input,style:'coding'},{...DEFAULT_SETTINGS,dataPolicy:'reviewed'}).context,{});
 assert.ok(!redactContacts(input.context.resume).includes('test@example.invalid'));assert.ok(!redactContacts(input.context.resume).includes('99999'));
 assert.throws(()=>requireDataPolicy(DEFAULT_SETTINGS),/Choose a data-use/);
 assert.throws(()=>requireDataPolicy({...DEFAULT_SETTINGS,dataPolicy:'local'}),/loopback/);
 assert.throws(()=>requireDataPolicy({...DEFAULT_SETTINGS,dataPolicy:'unpaid'},'pdf'),/disabled/);
});
test('capacity is rejected without truncation and context removal rewrites recovery copies',()=>{
 const sessions=Array.from({length:101},(_,i)=>({id:String(i)}));assert.throws(()=>sanitizeWorkspace({sessions}),/No history was removed/);assert.equal(sessions.length,101);
 assert.equal(personalDataRemoved({context:{resume:'secret'},sessions:[]},{context:{resume:''},sessions:[]}),true);
 assert.equal(personalDataRemoved({sessions:[{id:'1',context:{resume:'secret'}}]},{sessions:[{id:'1',context:{resume:''}}]}),true);
});
test('JSON completion rejects truncation but emits the partial draft, and enforces a byte budget',async()=>{
 let partial='';assert.throws(()=>jsonAnswer({candidates:[{content:{parts:[{text:'partial'}]},finishReason:'MAX_TOKENS'}]},'gemini',text=>partial+=text),/partial draft/);assert.equal(partial,'partial');
 assert.throws(()=>jsonAnswer({choices:[{message:{content:'partial'},finish_reason:'length'}]},'openai',()=>{}),/output limit/);
 assert.throws(()=>jsonAnswer({candidates:[{content:{parts:[{text:'unconfirmed'}]}}]},'gemini',()=>{}),/missing finish/);
 assert.equal(jsonAnswer({choices:[{message:{content:'done'},finish_reason:'stop'}]},'openai',()=>{}),'done');
 await assert.rejects(()=>readBoundedJson(new Response('123456789'),4),/size limit/);
});
test('actual worklet flush sends every partial sample before acknowledgement and stops recording',()=>{
 let Recorder;const messages=[];class Worklet{constructor(){this.port={postMessage:frame=>messages.push(frame)}}}
 vm.runInNewContext(fs.readFileSync(require.resolve('../renderer/pcm-worklet.js'),'utf8'),{AudioWorkletProcessor:Worklet,Float32Array,registerProcessor:(_,Class)=>Recorder=Class});
 const recorder=new Recorder();for(let i=0;i<23;i++)recorder.process([[new Float32Array(128).fill(i)]]);
 recorder.port.onmessage({data:{type:'flush'}});assert.equal(messages.filter(m=>m instanceof Float32Array).reduce((n,m)=>n+m.length,0),23*128);assert.equal(messages.at(-1).type,'flushed');
 const count=messages.length;recorder.process([[new Float32Array(128)]]);assert.equal(messages.length,count);
});
test('Live stop waits for a final later than the old 1.2-second deadline',async()=>{
 const {GeminiLive}=require('../electron/gemini-live.cjs');const live=new GeminiLive({settings:DEFAULT_SETTINGS,key:'synthetic',onTranscript:()=>{},onError:()=>{}});
 live.ready=true;live.sentAudio=true;live.speechSinceFinal=true;live.socket={readyState:1,send:()=>setTimeout(()=>live.resolveDrain?.(),1400),close(){}};
 const started=Date.now();assert.equal((await live.stop()).complete,true);assert.ok(Date.now()-started>=1300);
});

test('explicit filtered SSE completion is rejected, and unpaid notes cannot reuse saved private history',async()=>{
 const {readAnswerStream}=require('../electron/core.cjs');
 async function* body(){yield Buffer.from('data: '+JSON.stringify({choices:[{delta:{content:'partial'},finish_reason:'content_filter'}]})+'\n\n');yield Buffer.from('data: [DONE]\n\n');}
 await assert.rejects(()=>readAnswerStream(body(),()=>{},'openai'),/content_filter/);
 assert.throws(()=>prepareOutbound({kind:'notes',transcript:'previous private meeting'},{...DEFAULT_SETTINGS,dataPolicy:'unpaid'}),/summaries require/);
 const reviewed=prepareOutbound({question:'Explain my Python project',style:'technical',context:{resume:'Reviewed project evidence'}},{...DEFAULT_SETTINGS,dataPolicy:'reviewed'});assert.match(reviewed.context.resume,/Reviewed project/);
});

test('Live setup errors cannot expose the credential to the renderer',async()=>{
 const {GeminiLive}=require('../electron/gemini-live.cjs');const secret='synthetic-private-key';
 class Socket extends EventTarget {constructor(){super();queueMicrotask(()=>this.dispatchEvent(new Event('open')));}send(){queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({error:{code:403,message:'Rejected '+secret}})})));}close(){}}
 const live=new GeminiLive({settings:DEFAULT_SETTINGS,key:secret,onTranscript:()=>{},onError:()=>{},WebSocketImpl:Socket});
 await assert.rejects(()=>live.start(),error=>error.message.includes('[redacted]')&&!error.message.includes(secret));
});


test('SSE rejects oversized answers before display even when completion shares the chunk', async()=>{
 const {readAnswerStream}=require('../electron/core.cjs');
 for(const provider of ['openai','gemini']) {
  const payload=provider==='gemini'?{candidates:[{content:{parts:[{text:'x'.repeat(200001)}]},finishReason:'STOP'}]}:{choices:[{delta:{content:'x'.repeat(200001)}}]};
  async function* body(){yield Buffer.from('data: '+JSON.stringify(payload)+'\n\ndata: [DONE]\n\n');}
  let displayed=0;
  await assert.rejects(()=>readAnswerStream(body(),text=>displayed+=text.length,provider),/size limit/);
  assert.equal(displayed,0);
 }
});

test('SSE bounds complete metadata traffic and closes the upstream iterator on failure',async()=>{
 const {readAnswerStream}=require('../electron/core.cjs');let closed=false;let chunks=0;
 async function* body(){try{for(let i=0;i<10;i++){chunks++;yield Buffer.from(':'+ 'x'.repeat(1024*1024)+'\n\n');}yield Buffer.from('data: [DONE]\n\n');}finally{closed=true;}}
 await assert.rejects(()=>readAnswerStream(body(),()=>{}),/size limit/);
 assert.equal(closed,true);assert.ok(chunks<10);
});

test('Gemini completion closes the stream and never appends later candidate text',async()=>{
 const {readAnswerStream}=require('../electron/core.cjs');let closed=false;const deltas=[];
 async function* body(){try{yield Buffer.from('data: '+JSON.stringify({candidates:[{content:{parts:[{text:'Complete'}]},finishReason:'STOP'}]})+'\n\n');yield Buffer.from('data: '+JSON.stringify({candidates:[{content:{parts:[{text:'unexpected'}]}}]})+'\n\n');}finally{closed=true;}}
 assert.equal(await readAnswerStream(body(),text=>deltas.push(text),'gemini'),'Complete');
 assert.deepEqual(deltas,['Complete']);assert.equal(closed,true);
});

test('malformed JSON provider envelopes fail with actionable errors',async()=>{
 const {readAnswerStream}=require('../electron/core.cjs');
 for(const payload of [null,[],42,'wrong']) {
  assert.throws(()=>jsonAnswer(payload,'gemini',()=>{}),/invalid.*response/i);
  async function* body(){yield Buffer.from('data: '+JSON.stringify(payload)+'\n\n');}
  await assert.rejects(()=>readAnswerStream(body(),()=>{}),/invalid.*response/i);
 }
});


test('response budgets preserve earlier valid deltas but never emit the overflowing delta',async()=>{
 const {readAnswerStream}=require('../electron/core.cjs');let displayed='';
 async function* body(){yield Buffer.from('data: '+JSON.stringify({choices:[{delta:{content:'Retained draft'}}]})+'\n\n');yield Buffer.from('data: '+JSON.stringify({choices:[{delta:{content:'x'.repeat(200000)}}]})+'\n\n');}
 await assert.rejects(()=>readAnswerStream(body(),text=>displayed+=text),/size limit/);
 assert.equal(displayed,'Retained draft');
 let emitted=false;assert.throws(()=>jsonAnswer({choices:[{message:{content:'x'.repeat(200001)},finish_reason:'stop'}]},'openai',()=>emitted=true),/size limit/);assert.equal(emitted,false);
});

test('an oversized complete SSE event is rejected before its payload is parsed',async()=>{
 const {readAnswerStream}=require('../electron/core.cjs');
 async function* body(){yield Buffer.from('data: '+JSON.stringify({padding:'x'.repeat(2*1024*1024),choices:[]})+'\n\ndata: [DONE]\n\n');}
 await assert.rejects(()=>readAnswerStream(body(),()=>{}),/size limit/);
});


test('provider error redaction discards upstream stacks and encoded credential copies',()=>{
 const {redactProviderFailure}=require('../electron/response.cjs');const secret='private/key+example';const upstream=new Error('Rejected '+secret+' and '+encodeURIComponent(secret));const sanitized=redactProviderFailure(upstream,secret);assert.ok(sanitized.message.includes('[redacted]'));assert.ok(!sanitized.stack.includes(secret));assert.ok(!sanitized.stack.includes(encodeURIComponent(secret)));assert.equal(redactProviderFailure(new DOMException('cancelled','AbortError')).name,'AbortError');assert.equal(redactProviderFailure(new Error('x'.repeat(10000))).message.length,2000);
});
