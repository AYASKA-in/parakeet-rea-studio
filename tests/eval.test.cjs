const test=require('node:test'),assert=require('node:assert/strict');const {pathToFileURL}=require('node:url'),path=require('node:path');
const corpus=require('../evals/corpus.cjs');const {wordErrorRate,gradeText}=require('../evals/grade.cjs');
test('synthetic corpus declares family-separated reserved groups and exact sizes',()=>{
 for(const [kind,count]of Object.entries({asr:100,routing:100,coding:50,screens:50,resumes:50})){assert.equal(corpus[kind].length,count);assert.equal(new Set(corpus[kind].map(x=>x.id)).size,count);const families=new Map();for(const row of corpus[kind]){if(families.has(row.family))assert.equal(families.get(row.family),row.split);families.set(row.family,row.split);}assert.ok(corpus[kind].some(x=>x.split==='reserved'));}
});
test('routing corpus exercises actual queue decisions and preserves follow-up constraints',async()=>{
 const {QuestionQueue}=await import(pathToFileURL(path.resolve(__dirname,'../renderer/question-queue.js')).href);
 for(const item of corpus.routing){let now=0;const queue=new QuestionQueue({now:()=>now});for(const text of item.segments){queue.push(text,'system','eval');now+=100;}now+=6000;assert.equal(queue.status({sessionId:'eval'}).reason,item.expected,item.id);if(item.required)assert.ok(queue.pending.text.includes(item.required));}
});
test('ASR word-error grading counts edits instead of using substring success',()=>{
 assert.equal(wordErrorRate('do not retry','do retry'),1/3);assert.equal(wordErrorRate('Redis cache','redis cache'),0);assert.equal(wordErrorRate('',''),0);assert.equal(wordErrorRate('HTTP 401','HTTP 403'),.5);
});
test('literal rubric reports missing evidence and forbidden claims explicitly',()=>{
 const item=corpus.resumes[0];assert.equal(gradeText(item,'ExampleCo 0, 10%').passed,true);assert.equal(gradeText(item,'Google employee, 90%').passed,false);
});


test('screen grading preserves negation instead of treating retry-401 text as a substring match',()=>{
 const {gradeStructured}=require('../evals/grade.cjs');const item=corpus.screens[0];assert.equal(gradeStructured(item,JSON.stringify({token:item.token,retryLimit:item.retry,retry401:false}),'screens').passed,true);assert.equal(gradeStructured(item,JSON.stringify({token:item.token,retryLimit:item.retry,retry401:true}),'screens').passed,false);
});


test('ASR numeric adjudication removes thousands grouping without changing decimal commas or identifiers',()=>{
 const {normalizeNumericGrouping}=require('../evals/grade.cjs');assert.equal(normalizeNumericGrouping('100,000 and 12,5 and foo_bar 1,234.50'),'100000 and 12,5 and foo_bar 1234.50');assert.equal(normalizeNumericGrouping('do not use 50'),'do not use 50');
});


test('coding evaluation enforces declared input preservation in addition to output',()=>{
 const {gradeCodeResults}=require('../evals/sandbox.cjs');const cases=[{input:[3,1],expected:[1,3],preserveInput:true}];assert.equal(gradeCodeResults([{output:[1,3],after:[1,3]}],cases),false);assert.equal(gradeCodeResults([{output:[1,3],after:[3,1]}],cases),true);assert.equal(gradeCodeResults([{output:[1,3],after:[1,3]}],[{...cases[0],preserveInput:false}]),true);
});
