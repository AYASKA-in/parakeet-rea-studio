// No cloud calls: exercise the actual evaluation CLI against a loopback provider.
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');
(async()=>{
 const output=path.join(root,'test-results','eval-pipeline-'+Date.now());await fs.mkdir(output,{recursive:true});
 const report={syntheticOnly:true,cloudRequests:0,scenarios:[]};let server,current,requests=0;const sockets=new Set();
 try{
  server=http.createServer(async(req,res)=>{
   let raw='';for await(const chunk of req)raw+=chunk;
   requests++;assert.ok(!raw.includes('[-1,0,2,2,10]'),'Hidden expected results leaked into provider prompt');
   if(current==='unavailable'){res.writeHead(503);res.end('Synthetic unavailability');return;}
   await new Promise(resolve=>setTimeout(resolve,80));
   const code=current==='wrong'?'function solve(x){return x.sort();}':require('../evals/v08.cjs').coding[0].reference;
   const text=current==='format'?code:'```javascript\n'+code+'\n```';
   res.setHeader('content-type','application/json');res.end(JSON.stringify({choices:[{message:{content:text},finish_reason:'stop'}]}));
  });
  server.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const receipts=[];
  for(current of ['correct','wrong','format','unavailable']){
   const before=new Set(await fs.readdir(path.join(root,'test-results')));const beforeRequests=requests;
   const child=spawn(process.execPath,['scripts/evaluate.cjs','--live','--kind=coding','--provider=openai','--base-url=http://127.0.0.1:'+server.address().port+'/v1','--model=synthetic-pipeline','--suite=realtime','--split=development','--case=js-numeric-sort','--max-calls=1'],{cwd:root,env:{...process.env,PARAKEET_EVAL_API_KEY:'local-only'},windowsHide:true,stdio:['ignore','pipe','pipe']});
   let log='';child.stdout.on('data',chunk=>{log+=chunk;});child.stderr.on('data',chunk=>{log+=chunk;});
   const exit=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});
   const fresh=(await fs.readdir(path.join(root,'test-results'))).filter(name=>name.startsWith('eval-coding-')&&!before.has(name));
   assert.equal(fresh.length,1,log);const receipt=JSON.parse(await fs.readFile(path.join(root,'test-results',fresh[0],'report.json'),'utf8'));const row=receipt.cases[0];
   assert.equal(receipt.attempted,1);assert.equal(requests-beforeRequests,1,'Never retry a synthetic provider case');
   assert.equal(row.outcome,current==='correct'?'pass':current==='unavailable'?'provider-error':'incorrect');
   assert.equal(exit,current==='correct'?0:1);
   if(current!=='unavailable'){assert.ok(row.providerMs>=70);assert.ok(row.elapsedMs>=row.providerMs);assert.ok(row.gradingMs>=0);}
   receipts.push(receipt);report.scenarios.push({name:current,passed:true,outcome:row.outcome,receipt:fresh[0]});
  }
  const summary=require('../evals/report.cjs').qualitySummary(receipts);assert.equal(summary.groups[0].attempted,4);assert.equal(summary.groups[0].passed,1);assert.equal(summary.groups[0].outcomes['provider-error'],1);
  await fs.writeFile(path.join(output,'summary.json'),JSON.stringify(summary,null,2));report.passed=true;console.log('PASS actual CLI pipeline: JavaScript success, wrong code, missing fence, 503 without retry and complete summary denominators.');
 }catch(error){report.passed=false;report.failure=error.stack;process.exitCode=1;console.error(error.stack);}
 finally{for(const socket of sockets)socket.destroy();if(server)await new Promise(resolve=>server.close(resolve));await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(output);}
})();
