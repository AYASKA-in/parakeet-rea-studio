export function hasUsefulText(text){const plain=String(text).replace(/\x60{1,3}|[*#_>]/g,'').trim();return plain.length>=40&&/[\p{L}\p{N}]/u.test(plain);}
export function recoveryView({provider={},liveStates={},levels={},listening=false,starting=false,source='microphone',online=true,error=false,hasQuestion=true,progress={},now=Date.now()}={}){
 const labels={requesting:'Waiting for provider',retrying:'Retrying connection',complete:'Answer complete',quota:'Provider quota reached',cooldown:'Provider cooldown',authentication:'Check API key / permissions',cancelled:'Request cancelled',timeout:'Request timed out',connection:'Connection failed',error:'Request failed'};
 const wait=Math.max(0,Math.ceil(((provider.until||0)-now)/1000));
 const sources=(source==='both'?['microphone','system']:[source]).map(name=>{const active=listening||starting;return {name,label:name==='system'?'Call audio':'Microphone',state:!active?'off':liveStates[name]==='reconnecting'?'reconnecting':liveStates[name]==='gap'?'review':Number(levels[name])>.048?'active':'quiet'};});
 let progressStatus='';
 if(progress.active&&['requesting','retrying'].includes(provider.state)){
  if(provider.state==='retrying'&&wait)progressStatus=labels.retrying;
  else if(progress.hasText)progressStatus=Number(progress.silentMs)>=5000?'Answer paused — waiting for provider':'Receiving answer';
  else progressStatus=Number(progress.elapsedMs)>=5000?'Still waiting for provider — you can stop this request':'Waiting for provider';
 }
 return {canCancel:Boolean(progress.active),sources,status:!online?'Offline — check your connection':progressStatus||labels[provider.state]||'',wait,retry:!progress.active&&hasQuestion&&online&&!wait&&['quota','cooldown','timeout','connection','error','cancelled'].includes(provider.state),needsSettings:provider.state==='authentication',hasError:Boolean(error)};
}
