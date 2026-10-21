const test=require('node:test'),assert=require('node:assert/strict');
const {qualitySummary}=require('../evals/report.cjs');
const {validateCase,extractSolution}=require('../evals/contracts.cjs');
const receipt=(cases,extra={})=>({kind:'coding',provider:'gemini',model:'test-model',syntheticOnly:true,planned:cases.length,attempted:cases.length,cases,...extra});
test('quality summaries retain incorrect/provider failures and unrun cases in their denominators',()=>{
 const report=qualitySummary([receipt([{id:'a',family:'f',passed:true,outcome:'pass',elapsedMs:3000,providerMs:300,gradingMs:2700},{id:'b',family:'g',passed:false,outcome:'provider-error',elapsedMs:9000,error:'private-token'}],{planned:5})]);
 const g=report.groups[0];assert.equal(g.attempted,2);assert.equal(g.passed,1);assert.equal(g.failed,1);assert.equal(g.unattempted,3);assert.equal(g.passRateOnAttempts,.5);assert.equal(g.durations.providerMs.samples,1);assert.equal(g.durations.providerMs.p95,300);assert.equal(g.durations.elapsedMs.p95,9000);assert.equal(g.outcomes['provider-error'],1);assert.ok(!JSON.stringify(report).includes('private-token'));
});
test('historical total durations are never relabelled as provider or first-token latency',()=>{
 const g=qualitySummary([receipt([{id:'old',family:'f',passed:true,elapsedMs:1234}],{planned:undefined})]).groups[0];
 assert.equal(g.planned,null);assert.equal(g.unattempted,null);assert.equal(g.durations.providerMs.samples,0);assert.equal(g.durations.providerMs.p50,null);assert.equal(g.evidenceSufficientForProductionClaim,false);
});
test('summary rejects stale attempt counts, duplicates and contradictory outcomes',()=>{
 assert.throws(()=>qualitySummary([receipt([],{attempted:1})]),/count/);
 assert.throws(()=>qualitySummary([receipt([{id:'a',passed:true},{id:'a',passed:false}])]),/unique/);
 assert.throws(()=>qualitySummary([receipt([{id:'a',passed:true,outcome:'provider-error'}])]),/contradicts/);
});
test('summary separates models and flags mixed source revisions without exposing answers',()=>{
 const a=receipt([{id:'a',family:'same',passed:true,syntheticOutput:'private-resume'}],{sourceHashes:{'evals/corpus.cjs':'a'.repeat(64)}});
 const b=receipt([{id:'a',family:'same',passed:false}],{sourceHashes:{'evals/corpus.cjs':'b'.repeat(64)}});
 const c=receipt([{id:'a',passed:true}],{model:'other-model'});
 const r=qualitySummary([a,b,c]);assert.equal(r.groups.length,2);assert.equal(r.groups[0].mixedSourceRevisions,true);assert.equal(r.groups[0].distinctFamilies,1);assert.ok(!JSON.stringify(r).includes('private-resume'));
});
test('executable contracts reject non-JSON values and unsupported languages before provider calls',()=>{
 const row=require('../evals/v08.cjs').coding[0];assert.equal(validateCase(row,'coding'),row);
 assert.throws(()=>validateCase({...row,evaluation:'bash'},'coding'),/executable/);
 assert.throws(()=>validateCase({...row,tests:[{input:[Infinity],expected:null}]},'coding'),/lossless/);
 assert.throws(()=>validateCase({...row,tests:[]},'coding'),/executable/);
});
test('language-specific fenced extraction cannot accidentally execute a different language',()=>{
 assert.equal(extractSolution('```javascript\nfunction solve(x){return x;}\n```','javascript').trim(),'function solve(x){return x;}');
 assert.throws(()=>extractSolution('```python\ndef solve(x): return x\n```','javascript'),/fenced/);
});
test('expanded public development corpus has unique families and declared execution contracts',()=>{
 const c=require('../evals/v08.cjs');assert.equal(c.coding.length,6);assert.equal(c.screens.length,5);assert.equal(c.grounding.length,8);
 const all=[...c.coding,...c.screens,...c.grounding];assert.equal(new Set(all.map(r=>r.id)).size,all.length);for(const row of all)assert.equal(row.split,'development');
 for(const [kind,rows]of Object.entries(require('../evals/corpus.cjs')))if(kind!=='routing')for(const row of rows)validateCase(row,kind);
});
test('structured grading rejects extra guessed answers, prose and scalar responses',()=>{
 const {gradeStructured}=require('../evals/grade.cjs');const row={expected:{needsClarification:true,identifier:null}};
 assert.equal(gradeStructured(row,'{"needsClarification":true,"identifier":null}','screens').passed,true);
 assert.equal(gradeStructured(row,'{"needsClarification":true,"identifier":null,"guess":"secretIdentifier"}','screens').passed,false);
 assert.equal(gradeStructured(row,'Here is a guess: {"needsClarification":true,"identifier":null}','screens').passed,false);
 assert.equal(gradeStructured(row,'null','screens').passed,false);
});
test('critical identifier grading can preserve case without changing legacy word matching',()=>{
 const {criticalTokenMissing}=require('../evals/grade.cjs');
 assert.deepEqual(criticalTokenMissing(['userID'],'userId',{caseSensitive:true}),['userID']);
 assert.deepEqual(criticalTokenMissing(['userID'],'userID',{caseSensitive:true}),[]);
 assert.deepEqual(criticalTokenMissing(['not'],'NOT'),[]);
});

test('employment preflight never promotes a document instruction into employment evidence',()=>{
 const row=require('../evals/v08.cjs').grounding.find(row=>row.id==='v08-grounding-source-injection');const assessment=require('../electron/grounding.cjs').groundingAssessment(row.question,row.resume);assert.equal(assessment.missingEmployer,'Google');assert.notEqual(assessment.status,'supported');
});
