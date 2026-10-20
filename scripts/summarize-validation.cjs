const fs=require('node:fs/promises');const path=require('node:path');const crypto=require('node:crypto');const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');const percentile=(values,p)=>{const sorted=values.slice().sort((a,b)=>a-b);return sorted[Math.max(0,Math.ceil(sorted.length*p)-1)]||0;};
(async()=>{
 const version=require('../package.json').version;const runs=[];
 for(const name of process.argv.slice(2)){
  const directory=path.resolve(root,name);assert.ok(directory.startsWith(path.join(root,'test-results')+path.sep));
  const r=JSON.parse(await fs.readFile(path.join(directory,'report.json'),'utf8'));assert.equal(r.status,'passed');assert.equal(r.version,version);assert.ok(r.actualDurationMs>=r.minutesRequested*60000);
  const identity=JSON.parse(await fs.readFile(path.join(directory,'artifact-identity.json'),'utf8'));
  for(const [file,expected]of Object.entries(identity.hashes))assert.equal(crypto.createHash('sha256').update(await fs.readFile(path.join(root,file))).digest('hex'),expected,'Frozen artifact changed: '+file);
  assert.equal(r.appAsarSha256,identity.hashes['dist/win-unpacked/resources/app.asar']);assert.equal(r.harnessSha256,identity.hashes['scripts/verify-soak.cjs']);
  const workspace=JSON.parse(await fs.readFile(path.join(directory,'profile/workspace.json'),'utf8'));let notices;if(r.encryptedWorkspace){assert.equal(workspace.format,'parakeet-workspace-dpapi-v1');assert.ok(Array.isArray(r.savedNotices),'Encrypted run must retain sanitized status notices from its decoded durable workspace');notices=r.savedNotices;}else notices=workspace.sessions.flatMap(s=>s.transcript||[]).filter(x=>x.source==='status').map(x=>x.text);
  const unexpectedNotices=notices.filter(x=>/Audio warning:|Audio interruption:|Transcription failed|recovery failed|stopped before buffered|timing warning:/i.test(x));assert.deepEqual(unexpectedNotices,[],'Unexpected saved audio warning');
  const noticeCounts={total:notices.length,reconnecting:notices.filter(x=>/^Reconnecting/.test(x)).length,mockFinalDrainDeadline:notices.filter(x=>/Final transcription did not arrive before the drain deadline/.test(x)).length};
  const steady=r.samples.filter(x=>x.elapsedMs>=600000);assert.ok(steady.length>0);
  const channels=r.source==='both'?2:1;const deliveryRatio=r.audioBytes/(r.actualDurationMs/1000*16000*2*channels);
  // Declared before final completion: broad throughput, not proof of sample-exact losslessness.
  assert.ok(deliveryRatio>=.95,`Continuous PCM below 95% expected: ${deliveryRatio}`);assert.equal(r.missingSavedIds.length,0);assert.equal(r.errors.length,0);assert.equal(r.reviewActions.length,r.faults.length);
  const mean=xs=>xs.reduce((n,x)=>n+x.workingSetMiB,0)/xs.length;
  runs.push({source:r.source,durationMinutes:r.actualDurationMs/60000,startedAt:r.startedAt,endedAt:r.endedAt,audioFrames:r.audioFrames,audioPayloadMiB:r.audioBytes/1048576,continuousDeliveryRatio:deliveryRatio,finalizedTurns:r.transcripts,providerAnswers:r.answers,injectedDisconnects:r.faults.length,explicitReviews:r.reviewActions.length,missingSavedFinals:r.missingSavedIds.length,unexpectedErrors:r.errors.length,noticeCounts,steadyWorkingSetMiBP50:percentile(steady.map(x=>x.workingSetMiB),.5),steadyWorkingSetMiBP95:percentile(steady.map(x=>x.workingSetMiB),.95),peakWorkingSetMiB:Math.max(...r.samples.map(x=>x.workingSetMiB)),electronCpuSumP95:percentile(steady.map(x=>x.electronCpuSum),.95),lastVsEarlySteadyWorkingSetMiB:mean(steady.slice(-10))-mean(steady.slice(0,10)),finalWorkspaceBytes:r.samples.at(-1).workspaceBytes});
 }
 assert.equal(runs.length,2,'Supply both final 60/120-minute reports');
 const hashes={};for(const file of [`dist/Parakeet-Studio-${version}-portable.exe`,'dist/win-unpacked/resources/app.asar','dist/win-unpacked/resources/TimerPolicy.exe','scripts/verify-soak.cjs'])hashes[file]=crypto.createHash('sha256').update(await fs.readFile(path.join(root,file))).digest('hex');
 const summary={version,at:new Date().toISOString(),scope:'Concurrent real wall-clock runs, synthetic audio, loopback provider, hidden windows, 100 sessions, no cloud calls; no semantic quality claim.',runs,hashes};await fs.writeFile(path.join(root,'test-results',`validation-${version}.json`),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
