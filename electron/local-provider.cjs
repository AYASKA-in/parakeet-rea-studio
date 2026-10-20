const { requireDataPolicy } = require('./safety.cjs');
const { readBoundedJson } = require('./response.cjs');
async function checkLocalProvider(profile,key,{fetchImpl=fetch,signal}={}) {
  requireDataPolicy(profile);
  if(profile.provider!=='openai'||profile.dataPolicy!=='local')throw new Error('Save an OpenAI-compatible loopback provider in Local server mode before this check.');
  const response=await fetchImpl(profile.baseUrl+'/models',{headers:key?{Authorization:'Bearer '+key}:{},redirect:'error',signal});
  if(!response.ok)throw new Error('Local model discovery failed (HTTP '+response.status+'). Check the saved server URL and its model endpoint.');
  const result=await readBoundedJson(response,65536);if(!Array.isArray(result?.data))throw new Error('Local server returned an unsupported model-list format.');
  const ids=result.data.filter(row=>typeof row?.id==='string').map(row=>row.id);
  return {reachable:true,answerModelListed:ids.includes(profile.model),transcriptionModelListed:ids.includes(profile.transcriptionModel),scope:'Model listing only; test answer, WAV transcription and vision separately. The local server may still forward to a cloud service.'};
}
module.exports={checkLocalProvider};
