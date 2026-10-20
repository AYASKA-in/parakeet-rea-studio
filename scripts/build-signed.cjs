const {spawnSync}=require('node:child_process');
if(!process.env.CSC_LINK && !process.env.WIN_CSC_LINK)throw new Error('Signing credentials are not configured. Use build:win for an explicitly unsigned build.');
const result=spawnSync(process.execPath,[require.resolve('electron-builder/cli'), '--win','portable','--x64','--config.win.signAndEditExecutable=true','--config.win.signExecutable=true','--config.forceCodeSigning=true'],{stdio:'inherit',env:process.env,windowsHide:true});
if(result.error)throw result.error;process.exitCode=result.status??1;
