const {execFile,spawn}=require('node:child_process');const {promisify}=require('node:util');const run=promisify(execFile);
const image=require('./sandbox-image.json').image;
async function evaluatePython(code,tests,{timeoutMs=5000}={}) {
 if(!/^python@sha256:[a-f0-9]{64}$/.test(image))throw new Error('Evaluation requires the pinned official Python image.');
 if(typeof code!=='string'||code.length>100000)throw new Error('Invalid code evaluation input.');
 await run('docker',['image','inspect',image],{timeout:10000,maxBuffer:4096,windowsHide:true});
 const harness=code+'\nimport json\n_inputs=json.loads('+JSON.stringify(JSON.stringify(tests.map(test=>test.input)))+')\n_results=[]\nfor _input in _inputs:\n _value=solve(_input);_results.append({\"output\":_value,\"after\":_input})\nprint(json.dumps(_results))\n';
 let id;
 try {
  id=(await run('docker',['create','--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--user','65534:65534','--memory','128m','--cpus','1','--pids-limit','32','--tmpfs','/tmp:rw,noexec,nosuid,size=16m','--interactive',image,'python','-I','-S','-u','-c',harness],{timeout:10000,maxBuffer:4096,windowsHide:true})).stdout.trim();
  if(!/^[a-f0-9]{64}$/.test(id))throw new Error('Invalid sandbox identity.');
  const result=await run('docker',['start','--attach',id],{timeout:timeoutMs,maxBuffer:32768,windowsHide:true});
  const state=JSON.parse((await run('docker',['inspect','--format','{{json .State}}',id],{timeout:5000,maxBuffer:4096,windowsHide:true})).stdout);
  let actual;try{actual=JSON.parse(result.stdout);}catch{}
  return {passed:state.ExitCode===0&&gradeCodeResults(actual,tests),exitCode:state.ExitCode,scope:'Finite synthetic cases; not proof of arbitrary code correctness.'};
 }finally{if(id&&/^[a-f0-9]{64}$/.test(id))await run('docker',['rm','--force',id],{timeout:10000,windowsHide:true}).catch(()=>{});}
}
function gradeCodeResults(actual,tests) {
 const equal=require('node:util').isDeepStrictEqual;
 return Array.isArray(actual)&&actual.length===tests.length&&tests.every((test,index)=>equal(actual[index]?.output,test.expected)&&(!test.preserveInput||equal(actual[index]?.after,test.input)));
}
module.exports={evaluatePython,gradeCodeResults};

async function evaluateSql(query,tests,options={}) {
 if(typeof query!=='string'||query.length>100000||!/^\s*(?:SELECT|WITH)\b/i.test(query))return {passed:false,scope:'Only one read-only SQLite SELECT/WITH query is accepted.'};
 const code='import sqlite3\ndef solve(x):\n c=sqlite3.connect(":memory:")\n c.executescript(x["setup"])\n if x.get("rows"):\n  c.executemany("INSERT INTO employees VALUES (?,?)",x["rows"])\n c.execute("PRAGMA query_only=ON")\n c.set_progress_handler(lambda: 1,1000000)\n try:\n  return [list(row) for row in c.execute('+JSON.stringify(query)+').fetchall()]\n finally:\n  c.close()';
 return evaluatePython(code,tests.map(test=>({input:{setup:test.setup,rows:test.rows||[]},expected:test.expected})),options);
}
module.exports.evaluateSql=evaluateSql;
