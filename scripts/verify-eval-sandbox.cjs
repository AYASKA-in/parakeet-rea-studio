const assert=require('node:assert/strict');const {evaluatePython,evaluateSql,evaluateJavaScript}=require('../evals/sandbox.cjs');const {coding,screens}=require('../evals/corpus.cjs');
(async()=>{
 const families=[...new Map([...coding,...screens.filter(row=>row.reference&&row.tests)].map(x=>[x.family,x])).values()];for(const item of families){const result=await (item.evaluation==='sql'?evaluateSql:item.evaluation==='javascript'?evaluateJavaScript:evaluatePython)(item.reference,item.tests);assert.equal(result.passed,true,item.family);console.log('PASS reference sandbox '+item.family);}
 assert.equal((await evaluatePython('def solve(x): return 123',coding[0].tests)).passed,false);
 await assert.rejects(()=>evaluatePython('while True: pass',[],{timeoutMs:1000}));
 const probe='import os,socket\nassert os.getuid()==65534\ntry:\n open("/write-probe","w");raise AssertionError("root filesystem writable")\nexcept OSError: pass\ns=socket.socket();s.settimeout(.5)\nassert s.connect_ex(("1.1.1.1",443)) != 0\ndef solve(x): return x';
 assert.equal((await evaluatePython(probe,[{input:[1],expected:[1]}])).passed,true);
 assert.equal((await evaluateJavaScript('function solve(x){return x.sort();}',require('../evals/v08.cjs').coding[0].tests)).passed,false);
 assert.equal((await evaluateJavaScript('function solve(x){ return 123; }',coding[0].tests)).passed,false);
 assert.equal((await evaluateJavaScript('function solve( {',[{input:[],expected:[]}])).passed,false);
 await assert.rejects(()=>evaluateJavaScript('while(true){}',[],{timeoutMs:1000}),error=>error.code==='EVAL_TIMEOUT');
 await assert.rejects(()=>evaluateJavaScript('process.stdout.write("x".repeat(100000));function solve(x){return x;}',[{input:1,expected:1}]),error=>error.code==='EVAL_OUTPUT_LIMIT');
 const jsProbe='const fs=require("node:fs");if(process.getuid()!==65534)throw Error("root");let denied=false;try{fs.writeFileSync("/write-probe","x");}catch{denied=true;}if(!denied)throw Error("writable root");if(process.env.PARAKEET_EVAL_API_KEY)throw Error("host credential");const socket=require("node:net").connect(443,"1.1.1.1");let deniedNetwork=false;socket.on("error",()=>{deniedNetwork=true;});socket.setTimeout(300,()=>socket.destroy());async function solve(x){await new Promise(resolve=>setTimeout(resolve,500));if(!deniedNetwork)throw Error("network isolation");return x;}';
 assert.equal((await evaluateJavaScript(jsProbe,[{input:[1],expected:[1]}])).passed,true);
 console.log('PASS JavaScript numeric/input-preservation, wrong code/syntax, timeout, non-root, read-only, no host credential and network isolation checks.');
 console.log('PASS wrong code rejected; infinite loop terminated; non-root, read-only filesystem and network isolation verified. Only repository reference/probe code was executed in this self-test.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
