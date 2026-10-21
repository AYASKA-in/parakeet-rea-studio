// Conservative employment preflight. These source-line cues are not a full resume parser.
const escapeRegex=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const role=/\b(?:engineer|developer|analyst|manager|intern|scientist|architect|consultant|designer|director|officer|researcher)\b/iu;
const denial=/\b(?:(?:never|not|did not|didn't|have not|haven't|wasn't|weren't)\s+(?:worked|work|employed|been employed)|(?:not|never)\s+an?\s+(?:engineer|developer|analyst|manager|intern)|no employment)\b/iu;
const intention=/\b(?:target (?:company|employer)|applying (?:to|at)|interview(?:ing)? (?:at|with)|seeking (?:work|employment)|wish to work|aspire to work|client:)\b/iu;
function groundingAssessment(question,resume) {
 const match=String(question||'').match(/\b(?:did I (?:ever )?work (?:at|for)|have I (?:ever )?worked (?:at|for)|have I been employed (?:at|by)|my (?:employment|experience|role) at)\s+([^?!\n]{1,100})/i);
 if(!match)return {missingEmployer:null,status:'not-applicable',evidenceLines:[],conflictLines:[]};
 const employer=match[1].replace(/["']/g,'').trim().replace(/[.。]+$/u,'').normalize('NFKC');
 if(!employer)return {missingEmployer:null,status:'not-applicable',evidenceLines:[],conflictLines:[]};
 const pattern=escapeRegex(employer),name=new RegExp('(?:^|[^\\p{L}\\p{N}_])'+pattern+'(?=$|[^\\p{L}\\p{N}_])','iu');
 const direct=new RegExp('(?:\\b(?:worked|employed|interned)\\s+(?:(?:at|for|by)\\s+)?'+pattern+'|\\b(?:employer|company)\\s*:\\s*'+pattern+'|\\b(?:engineer|developer|analyst|manager|intern|scientist|architect|consultant|designer|director|officer|researcher)(?:\\s+[\\p{L}-]+){0,3}\\s+(?:at|for|@)\\s+'+pattern+')(?=$|[^\\p{L}\\p{N}_])','iu');
 const lines=String(resume||'').normalize('NFKC').split(/\r?\n/);
 const evidenceLines=[],conflictLines=[];let inExperience=false;
 for(let i=0;i<lines.length;i++){
  const line=lines[i].trim();
  if(/^(?:(?:professional|work)\s+)?(?:experience|employment|work history)\s*:?$/i.test(line))inExperience=true;
  if(/^(?:skills|education|projects|certifications|summary|objective)\s*:?$/i.test(line))inExperience=false;
  if(!name.test(line))continue;
  if(denial.test(line)){conflictLines.push(i+1);continue;}
  if(intention.test(line))continue;
  const header=new RegExp('^'+pattern+'(?:\\s*[|—–-].*)?$','iu').test(line);
  const nearby=lines.slice(i+1,i+3).join(' ');
  if(direct.test(line) || inExperience && header && role.test(nearby) && /\b(?:19|20)\d{2}\b/u.test(nearby))evidenceLines.push(i+1);
 }
 const status=conflictLines.length&&evidenceLines.length?'conflicting':evidenceLines.length?'supported':'unsupported';
 return {missingEmployer:status==='supported'?null:employer,status,evidenceLines:evidenceLines.slice(0,20),conflictLines:conflictLines.slice(0,20)};
}
module.exports={groundingAssessment};
