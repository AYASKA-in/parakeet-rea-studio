const {timingSafeEqual}=require('node:crypto');
const version=value=>{if(!/^\d+\.\d+\.\d+$/.test(value||''))throw new Error('Use an exact stable-form version.');return value.split('.').map(Number);};
function compareVersions(a,b){a=version(a);b=version(b);for(let i=0;i<3;i++)if(a[i]!==b[i])return Math.sign(a[i]-b[i]);return 0;}
function verifyUpdateEvidence({actualSha256,expectedSha256,signatureStatus,publisherThumbprint,trustedThumbprint,targetVersion,encryptedProfile=false}={}){
 version(targetVersion);if(encryptedProfile&&compareVersions(targetVersion,'0.6.0')<0)throw new Error('Encrypted profiles cannot be opened by versions older than 0.6.0. Restore a compatible pre-upgrade backup instead.');
 if(!/^[a-f0-9]{64}$/i.test(actualSha256||'')||!/^[a-f0-9]{64}$/i.test(expectedSha256||'')||!timingSafeEqual(Buffer.from(actualSha256.toLowerCase()),Buffer.from(expectedSha256.toLowerCase())))throw new Error('Artifact SHA-256 verification failed.');
 if(!/^[a-f0-9]{40}$/i.test(trustedThumbprint||''))throw new Error('No trusted publisher is configured; automatic update is unavailable.');
 if(signatureStatus!=='Valid'||String(publisherThumbprint).toLowerCase()!==trustedThumbprint.toLowerCase())throw new Error('Artifact must have a valid signature from the pinned trusted publisher.');return {verified:true,targetVersion};}
module.exports={compareVersions,verifyUpdateEvidence};
