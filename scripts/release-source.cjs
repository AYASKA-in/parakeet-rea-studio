const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const output = path.join(root, 'dist'); fs.mkdirSync(output, { recursive: true });
const stage = fs.mkdtempSync(path.join(output, 'source-stage-'));
const files = [];
function collect(relative) {
  const absolute = path.join(root, relative);
  const stat = fs.lstatSync(absolute);
  if (stat.isSymbolicLink()) throw new Error(`Source release refuses symbolic links: ${relative}`);
  if (stat.isDirectory()) { for (const name of fs.readdirSync(absolute)) collect(path.join(relative, name)); }
  else files.push(relative);
}
for (const directory of ['electron','renderer','scripts','tests','docs','.github','evals','build']) collect(directory);
for (const file of ['package.json','package-lock.json','README.md','LICENSE','CONTRIBUTING.md','SECURITY.md','THIRD_PARTY_NOTICES.md','.gitignore','.gitattributes','native/TimerPolicy.cs']) collect(file);
const secretPatterns = [/AIza[\w-]{20,}/, /AQ\.[\w-]{30,}/, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /(?:apiKey|api_key)\s*[:=]\s*["'][\w.-]{32,}["']/];
const hashes = {};
for (const relative of files.sort()) {
  if (/(?:^|[\\/])(?:\.env[^\\/]*|settings\.json|workspace\.json|overlay\.json|.*\.(?:pem|key|log|wav|exe|node|asar))$/i.test(relative)) throw new Error(`Private/runtime file is not permitted: ${relative}`);
  const binary=/\.(?:png|ico)$/i.test(relative);
  let content = fs.readFileSync(path.join(root, relative), binary ? undefined : 'utf8');
  if(/\.png$/i.test(relative) && !content.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new Error(`Invalid PNG documentation asset: ${relative}`);
  if(/\.ico$/i.test(relative) && !content.subarray(0,4).equals(Buffer.from([0,0,1,0])))throw new Error('Invalid ICO documentation/build asset: '+relative);
  if (!binary && secretPatterns.some(pattern => pattern.test(content))) throw new Error(`Possible secret detected in ${relative}; source archive was not produced.`);
  const destination = path.join(stage, relative); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, content);
  hashes[relative.replaceAll('\\','/')] = crypto.createHash('sha256').update(content).digest('hex');
}
let sourceRevision=null,sourceDirty=null;
if(fs.existsSync(path.join(root,'.git'))) {
  try {sourceRevision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();sourceDirty=Boolean(execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim());}catch{ /* A new/uncommitted checkout has no revision yet. */ }
}
const manifest = { name: pkg.name, version: pkg.version, license: pkg.license, sourceRevision, sourceDirty, createdAt: new Date().toISOString(), files: hashes, excluded: ['research','node_modules','dist','test-results','.git','credentials','local user data'] };
fs.writeFileSync(path.join(stage,'release-manifest.json'), JSON.stringify(manifest,null,2));
fs.writeFileSync(path.join(output,'release-manifest.json'), JSON.stringify(manifest,null,2));
const zip = path.join(output,`Parakeet-Studio-${pkg.version}-source.zip`);
if (fs.existsSync(zip)) fs.unlinkSync(zip);
const quote = value => `'${value.replaceAll("'","''")}'`;
execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.IO.Compression; Add-Type -AssemblyName System.IO.Compression.FileSystem; $taskStageRoot=${quote(stage)}; $taskArchive=[IO.Compression.ZipFile]::Open(${quote(zip)},[IO.Compression.ZipArchiveMode]::Create); try { foreach($taskInput in [IO.Directory]::EnumerateFiles($taskStageRoot,'*',[IO.SearchOption]::AllDirectories)) { $taskEntry=$taskInput.Substring($taskStageRoot.Length+1).Replace([char]92,[char]47); [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($taskArchive,$taskInput,$taskEntry,[IO.Compression.CompressionLevel]::Optimal) | Out-Null } } finally { $taskArchive.Dispose() }`],{windowsHide:true,stdio:'pipe'});
const artifacts = [zip, path.join(output,`Parakeet-Studio-${pkg.version}-portable.exe`)].filter(file=>fs.existsSync(file));
fs.writeFileSync(path.join(output,'SHA256SUMS.txt'), artifacts.map(file=>`${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}  ${path.basename(file)}`).join('\n')+'\n');
console.log(`Source release: ${path.basename(zip)} (${files.length} allowlisted files, MIT). Research, user data and credentials excluded.`);
