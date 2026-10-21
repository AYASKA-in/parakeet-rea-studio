// Replay frozen 16 kHz mono PCM without using the microphone or speakers.
async function replayPcm(pcm,{send,assertHealthy=()=>{},wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),now=()=>performance.now()}={}){
 if(!(pcm instanceof Uint8Array)||!pcm.byteLength||pcm.byteLength%2)throw new Error('Expected nonempty 16-bit PCM bytes.');
 if(typeof send!=='function')throw new Error('PCM sender required.');
 let lastFrameSentAt;
 for(let offset=0;offset<pcm.byteLength;offset+=6400){
  assertHealthy();send(pcm.subarray(offset,offset+6400));lastFrameSentAt=now();await wait(200);
 }
 assertHealthy();return {lastFrameSentAt};
}
module.exports={replayPcm};
