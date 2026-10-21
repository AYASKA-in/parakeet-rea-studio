const assert=require('node:assert/strict');const {evaluatePython,evaluateSql}=require('../evals/sandbox.cjs');const {coding}=require('../evals/corpus.cjs');
(async()=>{
 const families=[...new Map(coding.map(x=>[x.family,x])).values()];for(const item of families){const result=await (item.evaluation==='sql'?evaluateSql:evaluatePython)(item.reference,item.tests);assert.equal(result.passed,true,item.family);console.log('PASS reference sandbox '+item.family);}
 assert.equal((await evaluatePython('def solve(x): return 123',coding[0].tests)).passed,false);
 await assert.rejects(()=>evaluatePython('while True: pass',[],{timeoutMs:1000}));
 const probe='import os,socket\nassert os.getuid()==65534\ntry:\n open("/write-probe","w");raise AssertionError("root filesystem writable")\nexcept OSError: pass\ns=socket.socket();s.settimeout(.5)\nassert s.connect_ex(("1.1.1.1",443)) != 0\ndef solve(x): return x';
 assert.equal((await evaluatePython(probe,[{input:[1],expected:[1]}])).passed,true);
 console.log('PASS wrong code rejected; infinite loop terminated; non-root, read-only filesystem and network isolation verified. No model-generated code was executed in this self-test.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
