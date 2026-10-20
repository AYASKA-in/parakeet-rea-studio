const fs=require('node:fs');const path=require('node:path');const {execFileSync}=require('node:child_process');
if(process.platform!=='win32')throw Error('The Windows timer helper must be built on Windows.');
const root=path.resolve(__dirname,'..'),source=path.join(root,'native/TimerPolicy.cs'),output=path.join(root,'native/TimerPolicy.exe');
if(fs.existsSync(output)&&fs.statSync(output).mtimeMs>=Math.max(fs.statSync(source).mtimeMs,fs.statSync(__filename).mtimeMs)){console.log('Windows timer helper is current.');process.exit(0);}
const compiler=path.join(process.env.WINDIR||'C:\\Windows','Microsoft.NET/Framework64/v4.0.30319/csc.exe');
if(!fs.existsSync(compiler))throw Error('The Windows .NET Framework C# compiler is required to build the timer helper. Packaged users do not need a compiler.');
execFileSync(compiler,['/nologo','/target:exe','/platform:x64','/optimize+','/out:'+output,source],{windowsHide:true,stdio:'pipe'});console.log('Built Windows timer helper from original source.');
