// Verify the helper after electron-builder signs it during the extraResources copy.
// Do not add a second signature or rely solely on the final outer-EXE signature.
const path=require('node:path'),{spawnSync}=require('node:child_process');
module.exports=async context=>{
 if(context.electronPlatformName!=='win32'||!context.packager.forceCodeSigning||context.packager.platformSpecificBuildOptions.signExecutable===false)throw new Error('Extra-resource signing requires a forced signed Windows build.');
 if(!/^[a-f0-9]{40}$/i.test(process.env.PARAKEET_SIGNER_THUMBPRINT||''))throw new Error('Pinned publisher thumbprint missing.');
 const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-File',path.join(__dirname,'check-signatures.ps1'),'-Directory',context.appOutDir,'-Version',require('../package.json').version,'-TrustedPublisherThumbprint',process.env.PARAKEET_SIGNER_THUMBPRINT,'-HelperOnly'],{stdio:'inherit',windowsHide:true});
 if(result.error)throw result.error;if(result.status!==0)throw new Error('Signed helper failed pinned Authenticode/timestamp verification before packaging.');
};
