// Deliberately uses the disposable runner's REAL user profile and installer registration.
// Refuses local/self-hosted use. It never installs into the developer's Windows account.
const fs=require('node:fs/promises'), path=require('node:path'), http=require('node:http'), assert=require('node:assert/strict');
const {execFile}=require('node:child_process'),{promisify}=require('node:util'),{_electron}=require('playwright');
const {disposableHost,contained,installationTarget}=require('./installer-acceptance-policy.cjs');
const run=promisify(execFile), pause=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 disposableHost(process.env,process.platform,process.argv.includes('--disposable-host'));
 const source=path.resolve(__dirname,'..'),version=require('../package.json').version;
 const target=installationTarget(process.env,Date.now()),exe=path.join(target.install,'Parakeet Studio.exe');
 const setup=path.join(source,'dist','Parakeet-Studio-'+version+'-setup.exe');
 const output=path.join(source,'test-results','install-lifecycle-'+Date.now());
 await fs.access(setup);await fs.mkdir(output,{recursive:true});await fs.mkdir(target.root);
 let app,profile,requests=0,attempted=false,authorized=false;
 const report={version,host:'GitHub-hosted disposable Windows VM',syntheticOnly:true,cloudRequests:0,narratorTested:false,startedAt:new Date().toISOString(),checks:[]};
 const server=http.createServer(async(req,res)=>{for await(const _ of req){}requests++;if(req.headers['x-goog-api-key']!=='synthetic-install-lifecycle-key'){res.writeHead(401).end();return;}authorized=true;res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({candidates:[{content:{parts:[{text:'Synthetic retained installation answer.'}]},finishReason:'STOP'}]}));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const env={...process.env};for(const name of ['PARAKEET_USER_DATA','PARAKEET_EVAL_API_KEY','ELECTRON_RUN_AS_NODE'])delete env[name];
 const safe=()=>{assert.ok(contained(process.env.RUNNER_TEMP,target.root));assert.ok(contained(target.root,target.install));assert.equal(path.dirname(exe).toLowerCase(),target.install.toLowerCase());};
 const powershell=async script=>JSON.parse((await run('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,env:{...env,PARAKEET_INSTALL_TARGET:target.install},timeout:30000})).stdout.trim());
 const entries=()=>powershell("$ErrorActionPreference='Stop';$taskRows=@();foreach($taskHive in @('HKCU','HKLM')){foreach($taskKey in @(Get-ChildItem ($taskHive+':\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall') -ErrorAction SilentlyContinue)){ $taskItem=Get-ItemProperty -LiteralPath $taskKey.PSPath; if($taskItem.DisplayName -like 'Parakeet Studio*'){$taskRows+= [pscustomobject]@{hive=$taskHive;version=$taskItem.DisplayVersion;command=$taskItem.UninstallString;icon=$taskItem.DisplayIcon}}}};ConvertTo-Json -InputObject @($taskRows) -Compress");
 const shortcuts=()=>powershell("$ErrorActionPreference='Stop';$taskShell=New-Object -ComObject WScript.Shell;$taskRows=@();foreach($taskLocation in @('DesktopDirectory','Programs')){$taskFile=Join-Path ([Environment]::GetFolderPath($taskLocation)) 'Parakeet Studio.lnk';$taskExists=Test-Path -LiteralPath $taskFile;$taskTarget=$null;if($taskExists){$taskTarget=$taskShell.CreateShortcut($taskFile).TargetPath};$taskRows+=[pscustomobject]@{location=$taskLocation;exists=$taskExists;target=$taskTarget}};ConvertTo-Json -InputObject @($taskRows) -Compress");
 const install=async()=>{safe();attempted=true;await run(setup,['/S','/currentuser','/D='+target.install],{env,windowsHide:true,timeout:150000});await fs.access(exe);};
 const uninstall=async()=>{safe();const names=await fs.readdir(target.install);const name=names.find(x=>/^Uninstall.*\.exe$/i.test(x));assert.ok(name,'Expected uninstaller missing');await run(path.join(target.install,name),['/S','/currentuser','_?='+target.install],{env,windowsHide:true,timeout:90000});for(let i=0;i<40;i++){try{await fs.access(exe);}catch{return;}await pause(250);}assert.fail('Installed application remains after uninstall');};
 const launch=async()=>{app=await _electron.launch({executablePath:exe,args:[],env,timeout:45000});assert.equal(await app.evaluate(({app})=>app.getVersion()),version);const page=await app.firstWindow();await page.waitForFunction(()=>document.querySelector('#connection-status')?.textContent!=='Checking connection');return page;};
 const close=async()=>{await app?.close();app=null;};
 try{
  assert.deepEqual(await entries(),[],'Fresh runner already has a Parakeet installation');
  assert.ok((await shortcuts()).every(x=>!x.exists),'Fresh runner already has Parakeet shortcuts');
  await install();
  const installed=await entries();assert.equal(installed.length,1);assert.equal(installed[0].hive,'HKCU');assert.equal(installed[0].version,version);assert.ok(installed[0].command.toLowerCase().includes(target.install.toLowerCase()));
  for(const shortcut of await shortcuts()){assert.equal(shortcut.exists,true);assert.equal(shortcut.target.toLowerCase(),exe.toLowerCase());}
  report.checks.push({name:'Per-user install, version, Start Menu and desktop shortcuts',passed:true});
  let page=await launch();profile=await app.evaluate(({app})=>app.getPath('userData'));
  assert.ok(contained(process.env.APPDATA,profile),'Application did not use the disposable account roaming profile');
  const initial=await page.evaluate(()=>window.copilot.loadWorkspace());assert.equal(initial.sessions.length,0);assert.ok(Object.values(initial.context).every(x=>!x),'Default profile is not empty; refusing to replace data');
  await page.evaluate(async baseUrl=>{const settings=await window.copilot.getSettings();await window.copilot.saveSettings({...settings,baseUrl,dataPolicy:'local',apiKey:'synthetic-install-lifecycle-key',encryptWorkspace:true});},'http://127.0.0.1:'+server.address().port+'/v1beta');
  await page.reload();await page.waitForFunction(()=>document.querySelector('#connection-status')?.textContent==='AI provider configured');
  await page.click('[data-view="context"]');await page.fill('#context-resume','SYNTHETIC_INSTALL_RETAINED_CONTEXT');await page.locator('#context-resume').blur();
  await page.waitForFunction(async()=>(await window.copilot.loadWorkspace()).context.resume==='SYNTHETIC_INSTALL_RETAINED_CONTEXT');
  await close();
  const before=await fs.readFile(path.join(profile,'workspace.json'),'utf8');assert.ok(before.includes('parakeet-workspace-dpapi-v1'));assert.ok(!before.includes('SYNTHETIC_INSTALL_RETAINED_CONTEXT'));
  await uninstall();assert.deepEqual(await entries(),[]);assert.ok((await shortcuts()).every(x=>!x.exists));assert.equal(await fs.readFile(path.join(profile,'workspace.json'),'utf8'),before);
  await fs.access(path.join(profile,'Local State'));await fs.access(path.join(profile,'settings.json'));
  report.checks.push({name:'Uninstall removes app, registration and shortcuts; retains encrypted profile and Local State',passed:true});
  await install();page=await launch();assert.equal(await app.evaluate(({app})=>app.getPath('userData')),profile);
  assert.equal((await page.evaluate(()=>window.copilot.loadWorkspace())).context.resume,'SYNTHETIC_INSTALL_RETAINED_CONTEXT');
  const result=await page.evaluate(()=>window.copilot.generate({requestId:'install-retention',question:'Explain the synthetic reinstall checkpoint'}));assert.equal(result.text,'Synthetic retained installation answer.');assert.equal(requests,1);assert.equal(authorized,true);
  await close();report.checks.push({name:'Reinstall restores context and DPAPI key; answers through loopback mock',passed:true});
  await uninstall();assert.deepEqual(await entries(),[]);assert.ok((await shortcuts()).every(x=>!x.exists));report.checks.push({name:'Second uninstall leaves no app registration or shortcuts',passed:true});report.passed=true;
 }catch(error){report.passed=false;report.failure=error.message;process.exitCode=1;}
 finally{
  await close().catch(()=>{});
  if(attempted){try{await fs.access(exe);await uninstall();}catch(error){if(error.code!=='ENOENT'){report.cleanupFailure=error.message;report.passed=false;process.exitCode=1;}}}
  await new Promise(r=>server.close(r));report.localMockRequests=requests;report.profileRetained=Boolean(profile);report.completedAt=new Date().toISOString();await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
