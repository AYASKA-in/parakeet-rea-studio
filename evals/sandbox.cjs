const {execFile}=require('node:child_process');
const {promisify}=require('node:util'),{randomUUID}=require('node:crypto');
const run=promisify(execFile);
const image=require('./sandbox-image.json').image;
const nodeImage=require('./node-sandbox-image.json').image;
function gradeCodeResults(actual,tests) {
 const equal=require('node:util').isDeepStrictEqual;
 return Array.isArray(actual)&&actual.length===tests.length&&tests.every((test,index)=>equal(actual[index]?.output,test.expected)&&(!test.preserveInput||equal(actual[index]?.after,test.input)));
}
async function evaluateContainer(image,command,tests,{timeoutMs=5000}={}) {
 if(!Number.isInteger(timeoutMs)||timeoutMs<250||timeoutMs>30000)throw new Error('Invalid evaluation deadline.');
 await run('docker',['image','inspect',image],{timeout:10000,maxBuffer:4096,windowsHide:true});
 const name='parakeet-eval-'+randomUUID();
 try{
  const id=(await run('docker',['create','--name',name,'--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--user','65534:65534','--memory','128m','--cpus','1','--pids-limit','32','--tmpfs','/tmp:rw,noexec,nosuid,size=16m',image,...command],{timeout:10000,maxBuffer:4096,windowsHide:true})).stdout.trim();
  if(!/^[a-f0-9]{64}$/.test(id))throw new Error('Invalid sandbox identity.');
  let result;
  try{result=await run('docker',['start','--attach',id],{timeout:timeoutMs,maxBuffer:32768,windowsHide:true});}
  catch(error){
   if(error.code==='ERR_CHILD_PROCESS_STDIO_MAXBUFFER'){const failure=new Error('Code execution exceeded its output budget.');failure.code='EVAL_OUTPUT_LIMIT';throw failure;}
   if(error.killed){const failure=new Error('Code execution exceeded its deadline.');failure.code='EVAL_TIMEOUT';throw failure;}
   result={stdout:error.stdout||''};
  }
  const state=JSON.parse((await run('docker',['inspect','--format','{{json .State}}',id],{timeout:5000,maxBuffer:4096,windowsHide:true})).stdout);
  if(state.Status!=='exited')throw new Error('Sandbox did not complete normally.');
  let actual;try{actual=JSON.parse(result.stdout);}catch{}
  return {passed:state.ExitCode===0&&gradeCodeResults(actual,tests),exitCode:state.ExitCode,scope:'Finite synthetic cases in a restricted container; not proof of arbitrary correctness or adversarial isolation.'};
 }finally{
  await run('docker',['rm','--force',name],{timeout:10000,windowsHide:true}).catch(()=>{});
 }
}
function validateCode(code,tests) {
 if(typeof code!=='string'||code.length>100000||!Array.isArray(tests)||tests.length>500)throw new Error('Invalid code evaluation input.');
}
async function evaluatePython(code,tests,options={}) {
 if(!/^python@sha256:[a-f0-9]{64}$/.test(image))throw new Error('Evaluation requires the pinned official Python image.');
 validateCode(code,tests);
 const harness=code+'\nimport json\n_inputs=json.loads('+JSON.stringify(JSON.stringify(tests.map(test=>test.input)))+')\n_results=[]\nfor _input in _inputs:\n _value=solve(_input);_results.append({"output":_value,"after":_input})\nprint(json.dumps(_results))\n';
 return evaluateContainer(image,['python','-I','-S','-u','-c',harness],tests,options);
}
async function evaluateJavaScript(code,tests,options={}) {
 if(!/^node@sha256:[a-f0-9]{64}$/.test(nodeImage))throw new Error('Evaluation requires the pinned official Node image.');
 validateCode(code,tests);
 const harness=code+'\n;(async()=>{const __inputs=JSON.parse('+JSON.stringify(JSON.stringify(tests.map(test=>test.input)))+');const __results=[];for(const __input of __inputs){const __value=await solve(__input);__results.push({output:__value,after:__input});}process.stdout.write(JSON.stringify(__results));})().catch(()=>{process.exitCode=1;});';
 return evaluateContainer(nodeImage,['node','--no-addons','--max-old-space-size=48','-e',harness],tests,options);
}
async function evaluateSql(query,tests,options={}) {
 if(typeof query!=='string'||query.length>100000||!/^\s*(?:SELECT|WITH)\b/i.test(query))return {passed:false,scope:'Only one read-only SQLite SELECT/WITH query is accepted.'};
 const code='import sqlite3\ndef solve(x):\n c=sqlite3.connect(":memory:")\n c.executescript(x["setup"])\n if x.get("rows"):\n  c.executemany("INSERT INTO employees VALUES (?,?)",x["rows"])\n c.execute("PRAGMA query_only=ON")\n c.set_progress_handler(lambda: 1,1000000)\n try:\n  return [list(row) for row in c.execute('+JSON.stringify(query)+').fetchall()]\n finally:\n  c.close()';
 return evaluatePython(code,tests.map(test=>({input:{setup:test.setup,rows:test.rows||[]},expected:test.expected})),options);
}
module.exports={evaluatePython,evaluateJavaScript,evaluateSql,gradeCodeResults};
