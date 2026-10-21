// Synthetic packaged fixture for native UIA/Narrator; no key, microphone capture, cloud, or automatic Narrator start.
const fs=require('node:fs/promises'),path=require('node:path'),{_electron}=require('playwright');
(async()=>{
 const root=path.resolve(__dirname,'..'),directory=path.join(root,'test-results','accessibility-'+Date.now()),profile=path.join(directory,'profile'),now=new Date().toISOString();
 const context={role:'Software Engineer',company:'Fictional practice team',resume:'Fictional candidate: built a small cache for a practice project.',jobDescription:'Practice only',notes:'Synthetic fixture. Microphone and cloud are off.'};
 const question='How does a hash map work?',answer='A hash map converts a key into a bucket index. It handles collisions by comparing keys within a bucket. Average lookup is O(1); worst-case lookup can be O(n).\n\n```python\ncounts = {}\nfor word in words:\n    counts[word] = counts.get(word, 0) + 1\n```';
 await fs.mkdir(profile,{recursive:true});
 await fs.writeFile(path.join(profile,'workspace.json'),JSON.stringify({context,sessions:[{id:'accessibility-fixture',title:'Synthetic hash map practice',createdAt:now,updatedAt:now,context,transcript:[{id:'turn-fixture',source:'system',text:question,createdAt:now}],exchanges:[{id:'answer-fixture',question,answer,style:'technical',status:'complete',createdAt:now}],durationMs:0}]}));
 const env={...process.env,PARAKEET_USER_DATA:profile};delete env.PARAKEET_EVAL_API_KEY;delete env.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({executablePath:path.join(root,'dist/win-unpacked/Parakeet Studio.exe'),args:[],env,timeout:45000}),page=await app.firstWindow();
 await page.waitForFunction(()=>document.querySelector('#connection-status')?.textContent!=='Checking connection');
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setTitle('Parakeet Studio — Accessibility acceptance (synthetic)'));
 const report={version:await app.evaluate(({app})=>app.getVersion()),syntheticOnly:true,cloudRequests:0,recordingStarted:false,narratorTested:false,acceptance:'Pending human spoken-output review; preparation is not a pass.',preparedAt:new Date().toISOString()};
 await fs.writeFile(path.join(directory,'report.json'),JSON.stringify(report,null,2));console.log('Accessibility fixture ready: '+directory);console.log('Keep recording off. Follow docs/EXTERNAL_ACCEPTANCE.md; close this test window when finished.');
 await new Promise(resolve=>app.once('close',resolve));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
