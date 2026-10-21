const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
if(process.platform!=='win32')throw Error('The Windows timer helper must be built on Windows.');
const root=path.resolve(__dirname,'..'),source=path.join(root,'native/TimerPolicy.cs'),output=path.join(root,'native/TimerPolicy.exe'),pkgPath=path.join(root,'package.json'),pkg=require(pkgPath);
if(!/^\d+\.\d+\.\d+$/.test(pkg.version)||pkg.version.split('.').some(x=>Number(x)>65535))throw Error('Timer helper requires a valid three-part Windows product version.');
if(fs.existsSync(output)&&fs.statSync(output).mtimeMs>=Math.max(fs.statSync(source).mtimeMs,fs.statSync(__filename).mtimeMs,fs.statSync(pkgPath).mtimeMs)){console.log('Windows timer helper is current.');process.exit(0);}
const compiler=path.join(process.env.WINDIR||'C:\\Windows','Microsoft.NET/Framework64/v4.0.30319/csc.exe');
if(!fs.existsSync(compiler))throw Error('The Windows .NET Framework C# compiler is required to build the timer helper. Packaged users do not need a compiler.');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'parakeet-timer-metadata-')),metadata=path.join(directory,'AssemblyInfo.cs');
try{
 const fields={AssemblyTitle:'Parakeet Studio timer policy',AssemblyDescription:'Owned-process timer policy helper',AssemblyProduct:pkg.productName,AssemblyCompany:'Parakeet Studio contributors',AssemblyVersion:pkg.version+'.0',AssemblyFileVersion:pkg.version+'.0',AssemblyInformationalVersion:pkg.version};
 fs.writeFileSync(metadata,Object.entries(fields).map(([key,value])=>'[assembly: System.Reflection.'+key+'Attribute('+JSON.stringify(value)+')]').join('\n'));
 execFileSync(compiler,['/nologo','/target:exe','/platform:x64','/optimize+','/out:'+output,source,metadata],{windowsHide:true,stdio:'pipe'});console.log('Built Windows timer helper with product/version metadata from original source.');
}finally{if(fs.existsSync(metadata))fs.unlinkSync(metadata);fs.rmdirSync(directory);}
