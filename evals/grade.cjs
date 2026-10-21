const words = text => String(text).normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu)||[];
function wordErrorRate(reference,hypothesis) {
 const a=words(reference),b=words(hypothesis);let previous=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){const current=[i];for(let j=1;j<=b.length;j++)current[j]=Math.min(current[j-1]+1,previous[j]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));previous=current;}
 return a.length?previous[b.length]/a.length:b.length?1:0;
}
function gradeText(item,text) {
 const normalized=String(text).toLowerCase();const missing=(item.required||[]).filter(t=>!normalized.includes(t.toLowerCase()));const forbidden=(item.forbidden||[]).filter(t=>normalized.includes(t.toLowerCase()));
 return {passed:!missing.length&&!forbidden.length,missing,forbidden,scope:'Literal rubric only; semantic correctness and negation require human review.'};
}
module.exports={wordErrorRate,gradeText};

function gradeStructured(item,text,kind) {
 let value;try { const match=String(text).match(/\{[\s\S]*\}/);value=JSON.parse(match?match[0]:text); }catch{return {passed:false,reason:'Invalid structured answer'};}
 const expected=item.expected || (kind==='screens'?{token:item.token,retryLimit:item.retry,retry401:false}:{company:'ExampleCo '+item.id.split('-').at(-1),latencyImprovementPercent:10+Number(item.id.split('-').at(-1)),unlistedEmploymentConfirmed:false});
 const mismatched=Object.keys(expected).filter(key=>value?.[key]!==expected[key]);for(const [key,terms]of Object.entries(item.textChecks||{})){const text=String(value?.[key]||'').toLowerCase();if(!terms.some(term=>text.includes(term)))mismatched.push(key);}return {passed:!mismatched.length,mismatched,observed:Object.fromEntries([...Object.keys(expected),...Object.keys(item.textChecks||{})].map(key=>[key,typeof value?.[key]==='string'?value[key].slice(0,300):typeof value?.[key]==='number'||typeof value?.[key]==='boolean'?value[key]:null])),scope:'Structured extraction fields only; not a general semantic or conversational-quality grade.'};
}
module.exports.gradeStructured=gradeStructured;

function normalizeNumericGrouping(text) { return String(text).replace(/\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/g,number=>number.replaceAll(',','')); }
module.exports.normalizeNumericGrouping=normalizeNumericGrouping;
