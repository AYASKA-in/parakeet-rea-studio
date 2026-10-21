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
 let value;try { const raw=String(text).trim(),fence=raw.match(/^```(?:json)?\s*\n([\s\S]*?)```$/i);value=JSON.parse(fence?fence[1]:raw);if(!value||Array.isArray(value)||typeof value!=='object')throw new Error('object required'); }catch{return {passed:false,reason:'Invalid structured answer'};}
 const expected=item.expected || (kind==='screens'?{token:item.token,retryLimit:item.retry,retry401:false}:{company:'ExampleCo '+item.id.split('-').at(-1),latencyImprovementPercent:10+Number(item.id.split('-').at(-1)),unlistedEmploymentConfirmed:false});
 const mismatched=Object.keys(expected).filter(key=>!require('node:util').isDeepStrictEqual(value?.[key],expected[key]));const allowed=new Set([...Object.keys(expected),...Object.keys(item.textChecks||{})]);if(item.allowExtraFields!==true)for(const key of Object.keys(value))if(!allowed.has(key))mismatched.push('extra:'+key);for(const [key,terms]of Object.entries(item.textChecks||{})){const text=String(value?.[key]||'').toLowerCase();if(!terms.some(term=>text.includes(term)))mismatched.push(key);}return {passed:!mismatched.length,mismatched,observed:Object.fromEntries([...Object.keys(expected),...Object.keys(item.textChecks||{})].map(key=>[key,typeof value?.[key]==='string'?value[key].slice(0,300):typeof value?.[key]==='number'||typeof value?.[key]==='boolean'?value[key]:null])),scope:'Structured extraction fields only; not a general semantic or conversational-quality grade.'};
}
module.exports.gradeStructured=gradeStructured;

function normalizeNumericGrouping(text) { return String(text).replace(/\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/g,number=>number.replaceAll(',','')); }
module.exports.normalizeNumericGrouping=normalizeNumericGrouping;

function criticalTokenMissing(tokens,text,{numericGrouping=false,caseSensitive=false}={}){const normalize=value=>{const normalized=(caseSensitive?String(value).normalize('NFKC'):String(value).normalize('NFKC').toLowerCase()).replace(/\s+/g,' ').trim();return numericGrouping?normalizeNumericGrouping(normalized):normalized;};const answer=normalize(text),word=char=>Boolean(char)&&/[\p{L}\p{N}_]/u.test(char);return tokens.filter(token=>{const target=normalize(token);let start=0,index;while((index=answer.indexOf(target,start))!==-1){const left=index===0||!word(target[0])||!word(answer[index-1]),right=index+target.length===answer.length||!word(target.at(-1))||!word(answer[index+target.length]);if(left&&right)return false;start=index+1;}return true;});}
module.exports.criticalTokenMissing=criticalTokenMissing;
