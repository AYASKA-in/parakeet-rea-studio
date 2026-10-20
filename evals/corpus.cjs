// Synthetic cases. Variants share families; counts are not independent trials.
const split = family => family % 5 === 0 ? 'reserved' : 'development';
const spoken = [
 ['Do not retry HTTP four oh one.', ['not','401']], ['The timeout is fifteen milliseconds, not fifty.', ['15','not','50']],
 ['Use PostgreSQL, Redis and Kubernetes.', ['postgresql','redis','kubernetes']], ['Return minus one for an empty array.', ['-1','empty']],
 ['The account ID is zero zero seven.', ['007']], ['Use OAuth two, not basic authentication.', ['oauth','not']],
 ['Preserve duplicate values in the output.', ['duplicate']], ['The cache time to live is sixty seconds.', ['60','seconds']],
 ['The memory limit is two hundred fifty six megabytes.', ['256']], ['Use binary search with logarithmic time.', ['binary','logarithmic']],
 ['The price is twelve point five zero.', ['12.50']], ['Do not sort the input in place.', ['not','in place']],
 ['The maximum length is one hundred thousand.', ['100000']], ['Allow negative numbers and zero.', ['negative','zero']],
 ['Use TypeScript, not JavaScript.', ['typescript','not','javascript']], ['The response must include the request ID.', ['request','id']],
 ['Use a case sensitive hash map.', ['case sensitive','hash']], ['The start date is August twenty twenty six.', ['august','2026']],
 ['First I said ten, correction, use twenty.', ['20']], ['The result must not exceed ninety nine.', ['not','99']]
];
const asr=spoken.flatMap(([text,critical],family)=>[-2,-1,0,1,2].map(rate=>({id:'asr-'+family+'-'+(rate+2),family:'asr-'+family,split:split(family),text,critical,rate,language:'en',source:'Windows synthetic speech; not accent/noise coverage'})));
const topics=['hash maps','binary search','database indexes','HTTP retries','request deadlines','deadlocks','thread pools','cache invalidation','rate limiting','SQL transactions','OAuth','TLS','message queues','load balancing','pagination','memory leaks','monitoring','idempotency','connection pools','test design','race conditions','data retention','encryption','DNS','circuit breakers'];
const routing=topics.flatMap((topic,family)=>[
 {id:'route-'+family+'-question',family:'route-'+family,split:split(family),segments:['Explain '+topic+'?'],expected:'ready'},
 {id:'route-'+family+'-statement',family:'route-'+family,split:split(family),segments:['We recently discussed '+topic+'.'],expected:'empty'},
 {id:'route-'+family+'-unfinished',family:'route-'+family,split:split(family),segments:['Explain '+topic+' using'],expected:'unfinished'},
 {id:'route-'+family+'-constraint',family:'route-'+family,split:split(family),segments:['Explain '+topic+'?','Do not assume unlimited resources.'],expected:'ready',required:'Do not assume unlimited resources.'}
]);
const algorithms=[
 ['reverse','Return the input array in reverse order.','def solve(x):\n return x[::-1]',x=>[...x].reverse()],
 ['sum','Return the sum of the input integer array.','def solve(x):\n return sum(x)',x=>x.reduce((a,b)=>a+b,0)],
 ['unique','Return unique integers in first-seen order.','def solve(x):\n return list(dict.fromkeys(x))',x=>[...new Set(x)]],
 ['positive','Return only the positive integers, preserving order.','def solve(x):\n return [v for v in x if v>0]',x=>x.filter(v=>v>0)],
 ['sorted','Return a sorted copy ascending; do not mutate input.','def solve(x):\n return sorted(x)',x=>[...x].sort((a,b)=>a-b)],
 ['squares','Return the square of each integer in order.','def solve(x):\n return [v*v for v in x]',x=>x.map(v=>v*v)],
 ['max','Return maximum integer, or None for empty input.','def solve(x):\n return max(x) if x else None',x=>x.length?Math.max(...x):null],
 ['prefix','Return inclusive running sums of the input integers.','def solve(x):\n r=[];s=0\n for v in x:\n  s+=v;r.append(s)\n return r',x=>{let s=0;return x.map(v=>s+=v);}],
 ['even','Return the count of even integers, including zero.','def solve(x):\n return sum(v%2==0 for v in x)',x=>x.filter(v=>v%2===0).length],
 ['frequency','Return a sorted array of [integer,count] pairs.','def solve(x):\n return [[v,x.count(v)] for v in sorted(set(x))]',x=>[...new Set(x)].sort((a,b)=>a-b).map(v=>[v,x.filter(y=>v===y).length])]
];
const inputs=[[],[0],[-3,0,2,2],[5,-1,5,9,0],[1000,-1000,7,7,2,1]];
const coding=algorithms.flatMap(([name,task,reference,expected],family)=>inputs.map((input,variant)=>({id:'code-'+name+'-'+variant,family:'code-'+family,split:split(family),question:task+' Implement Python solve(x). Return only one fenced Python code block. Do not read stdin or use external packages.',tests:inputs.map(x=>({input:x,expected:expected(x)})),focusInput:input,reference})));
const screens=Array.from({length:50},(_,i)=>({id:'screen-'+i,family:'screen-'+Math.floor(i/5),split:split(Math.floor(i/5)),dark:i%2===0,font:[13,16,24,18,14][i%5],width:i%3===0?960:1440,height:800,token:'ORBIT-'+(700+i),retry:1+i%9,question:'Read the release token and retry limit. Return one JSON object only with token (string), retryLimit (integer), retry401 (boolean).',required:['ORBIT-'+(700+i),String(1+i%9)],forbidden:[],expectedRetry401:false}));
const resumes=Array.from({length:50},(_,i)=>({id:'resume-'+i,family:'resume-'+Math.floor(i/5),split:split(Math.floor(i/5)),resume:'FICTIONAL PRACTICE RESUME\nEXPERIENCE\nEngineer at ExampleCo '+i+', 2022-2024.\nReduced request latency by '+(10+i)+'%.\nPROJECTS\nBuilt a Redis cache. No employment or degree beyond these facts is confirmed.',question:'Return one JSON object only: company (string), latencyImprovementPercent (integer), unlistedEmploymentConfirmed (boolean). Use only facts explicitly listed in this fictional resume.',required:['ExampleCo '+i,String(10+i)+'%'],forbidden:['Google employee','Amazon employee','PhD']}));
module.exports={asr,routing,coding,screens,resumes};
