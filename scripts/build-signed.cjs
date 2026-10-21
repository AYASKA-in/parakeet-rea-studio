const {spawnSync}=require('node:child_process');
if(!process.env.CSC_LINK && !process.env.WIN_CSC_LINK)throw new Error('Signing credentials are not configured. Use build:win for an explicitly unsigned build.');
if(!/^[a-f0-9]{40}$/i.test(process.env.PARAKEET_SIGNER_THUMBPRINT||''))throw new Error('Set PARAKEET_SIGNER_THUMBPRINT to the trusted publisher certificate thumbprint.');
const result=spawnSync(process.execPath,[require.resolve('electron-builder/cli'), '--win','portable','nsis','--x64','--config.win.signAndEditExecutable=true','--config.win.signExecutable=true','--config.forceCodeSigning=true'],{stdio:'inherit',env:process.env,windowsHide:true});
if(result.error)throw result.error;process.exitCode=result.status??1;
if(process.exitCode===0){const check=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-File',require('node:path').join(__dirname,'check-signatures.ps1'),'-Directory',require('node:path').resolve(__dirname,'../dist'),'-Version',require('../package.json').version,'-TrustedPublisherThumbprint',process.env.PARAKEET_SIGNER_THUMBPRINT],{stdio:'inherit',windowsHide:true});if(check.error)throw check.error;process.exitCode=check.status??1;}
