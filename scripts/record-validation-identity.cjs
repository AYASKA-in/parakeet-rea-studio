const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),version=require('../package.json').version;
const files=[`dist/Parakeet-Studio-${version}-portable.exe`,'dist/win-unpacked/resources/app.asar','dist/win-unpacked/resources/TimerPolicy.exe','scripts/verify-soak.cjs'];
const hashes=Object.fromEntries(files.map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
if(process.argv.length<3)throw Error('Supply run directories printed by verify-soak immediately after starting them.');
const results=fs.realpathSync(path.join(root,'test-results'))+path.sep;
for(const supplied of process.argv.slice(2)){const directory=fs.realpathSync(path.resolve(root,supplied));if(!directory.startsWith(results))throw Error('Run directory must stay inside test-results');const target=path.join(directory,'artifact-identity.json');if(fs.existsSync(target))throw Error('Refusing to overwrite a frozen identity receipt');fs.writeFileSync(target,JSON.stringify({at:new Date().toISOString(),hashes},null,2));console.log('Recorded frozen identity: '+directory);}
