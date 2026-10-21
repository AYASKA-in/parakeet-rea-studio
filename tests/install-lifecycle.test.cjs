const test=require('node:test'),assert=require('node:assert/strict'),{disposableHost,contained,installationTarget}=require('../scripts/installer-acceptance-policy.cjs');
const env={GITHUB_ACTIONS:'true',RUNNER_OS:'Windows',RUNNER_ENVIRONMENT:'github-hosted',RUNNER_TEMP:'D:\\a\\_temp'};
test('installer acceptance refuses personal, self-hosted, non-Windows and implicit execution',()=>{
 for(const candidate of [{}, {...env,RUNNER_ENVIRONMENT:'self-hosted'}, {...env,GITHUB_ACTIONS:'false'}, {...env,RUNNER_OS:'Linux'}])assert.throws(()=>disposableHost(candidate,'win32',true),/disposable-host/);
 assert.throws(()=>disposableHost(env,'linux',true));assert.throws(()=>disposableHost(env,'win32',false));assert.doesNotThrow(()=>disposableHost(env,'win32',true));
});
test('installer paths cannot escape the disposable temporary root or require quoted NSIS /D arguments',()=>{
 for(const bad of ['..\\temp','C:relative','C:\\with spaces','\\\\server\\temp'])assert.throws(()=>disposableHost({...env,RUNNER_TEMP:bad},'win32',true));
 assert.equal(contained('D:\\a\\_temp','D:\\a\\_temp-malicious\\app'),false);
 assert.equal(contained('D:\\a\\_temp','D:\\a\\_temp\\..\\outside'),false);
 assert.equal(contained('D:\\a\\_temp','D:\\a\\_temp'),false);
 assert.equal(contained('D:\\a\\_temp','E:\\other'),false);
 const target=installationTarget(env,123);assert.equal(target.install,'D:\\a\\_temp\\parakeet-lifecycle-123\\installed');assert.throws(()=>installationTarget(env,'..\\outside'));
});

test('signed-resource verification refuses unsigned build modes and missing publisher identity',async()=>{
 const hook=require('../scripts/verify-signed-resources.cjs');
 await assert.rejects(()=>hook({electronPlatformName:'linux'}),/forced signed Windows/);
 await assert.rejects(()=>hook({electronPlatformName:'win32',packager:{forceCodeSigning:false,platformSpecificBuildOptions:{}}}),/forced signed Windows/);
 await assert.rejects(()=>hook({electronPlatformName:'win32',packager:{forceCodeSigning:true,platformSpecificBuildOptions:{signExecutable:false}}}),/forced signed Windows/);
 const previous=process.env.PARAKEET_SIGNER_THUMBPRINT;delete process.env.PARAKEET_SIGNER_THUMBPRINT;
 try{await assert.rejects(()=>hook({electronPlatformName:'win32',appOutDir:'unused',packager:{forceCodeSigning:true,platformSpecificBuildOptions:{signExecutable:true}}}),/Pinned publisher/);}
 finally{if(previous===undefined)delete process.env.PARAKEET_SIGNER_THUMBPRINT;else process.env.PARAKEET_SIGNER_THUMBPRINT=previous;}
});
