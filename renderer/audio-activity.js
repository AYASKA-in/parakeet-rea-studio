// Concurrent source energy is not speaker identification.
export class AudioActivity {
 constructor(){this.reset();}
 reset(){this.sources={};this.overlapping=false;}
 update(source,level,now=performance.now()){if(!['microphone','system'].includes(source))return false;const item=this.sources[source]||{since:now,last:-Infinity};if(level>.048){if(now-item.last>300)item.since=now;item.last=now;}this.sources[source]=item;const a=this.sources.microphone,b=this.sources.system;const active=Boolean(a&&b&&now-a.last<300&&now-b.last<300&&now-Math.max(a.since,b.since)>=500);const began=active&&!this.overlapping;this.overlapping=active;return began;}
}
