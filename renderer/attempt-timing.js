// Renderer-local monotonic timings. No transcript, image or provider text is retained.
const stages = ['captureStartMs','captureEndMs','speechEndMs','finalTranscriptMs','requestMs','firstTextMs','firstUsefulTextMs','firstRenderedMs','completedMs','attemptEndMs','savedMs'];
export function createAttemptTiming({kind='typed',mode='balanced',network='standard',now=()=>performance.now(),speechEndedAt=null,finalAt=null}={}) {
 const started=now();
 const hasSpeech=kind==='audio' && Number.isFinite(speechEndedAt) && speechEndedAt>=0 && speechEndedAt<=started;
 const hasFinal=kind==='audio' && Number.isFinite(finalAt) && finalAt>=0 && finalAt<=started;
 const baseline=hasSpeech?speechEndedAt:hasFinal?finalAt:started;
 const metric={kind,mode,network,endpointSource:hasSpeech?'estimated-audio':hasFinal?'final-transcript':kind==='screen'?'capture-action':'request-start',outcome:'error',failureCategory:'none',save:'not-applicable',...Object.fromEntries(stages.map(stage=>[stage,null]))};
 if(hasSpeech)metric.speechEndMs=0;
 if(Number.isFinite(finalAt)&&finalAt>=baseline&&finalAt<=started)metric.finalTranscriptMs=finalAt-baseline;
 return {
  metric,
  mark(stage) {if(!stages.includes(stage))throw new Error('Unknown timing stage');if(metric[stage]===null)metric[stage]=Math.max(0,now()-baseline);return metric[stage];},
  finish(outcome='error',failureCategory='none') {metric.outcome=outcome;metric.failureCategory=failureCategory;if(outcome==='success')this.mark('completedMs');this.mark('attemptEndMs');return metric;}
 };
}
