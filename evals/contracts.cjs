const {isDeepStrictEqual}=require('node:util');
const languages=['python','javascript','sql'];
function languageFor(row){return row.evaluation||'python';}
function assertJson(value){
 let encoded;try{encoded=JSON.stringify(value);}catch{}
 if(encoded===undefined||!isDeepStrictEqual(JSON.parse(encoded),value))throw new Error('Fixture values must be lossless JSON.');
}
function validateCase(row,kind){
 if(!row||!/^[a-zA-Z0-9_-]{1,100}$/.test(row.id||'')||!/^[a-zA-Z0-9_-]{1,100}$/.test(row.family||'')||!['development','reserved'].includes(row.split))throw new Error('Invalid fixture identity or split.');
 if(kind==='asr'){if(typeof row.text!=='string'||!row.text||!Array.isArray(row.critical)||row.critical.some(token=>typeof token!=='string'||!token))throw new Error('Invalid speech fixture contract.');return row;}
 if(!['coding','screens','resumes'].includes(kind)||typeof row.question!=='string'||!row.question.trim()||row.question.length>10000)throw new Error('Invalid question contract.');
 if(kind==='coding'||row.evaluation){
  if(!languages.includes(languageFor(row))||!Array.isArray(row.tests)||!row.tests.length||row.tests.length>500)throw new Error('Invalid executable fixture contract.');
  for(const item of row.tests){assertJson(item.expected);if(languageFor(row)==='sql'){if(typeof item.setup!=='string'||!item.setup.trim())throw new Error('SQL setup required.');assertJson(item.rows||[]);}else{assertJson(item.input);if(item.preserveInput!==undefined&&typeof item.preserveInput!=='boolean')throw new Error('Input-preservation flag must be boolean.');}}
 }else if(row.expected!==undefined){if(!row.expected||Array.isArray(row.expected)||typeof row.expected!=='object'||!Object.keys(row.expected).length)throw new Error('Expected structured fields required.');assertJson(row.expected);}
 return row;
}
function extractSolution(text,language){
 if(!languages.includes(language))throw new Error('Unsupported evaluation language.');
 const tag=language==='javascript'?'(?:javascript|js)':language==='python'?'(?:python|py)?':'sql';
 const found=String(text).match(new RegExp('```'+tag+'\\s*\\n([\\s\\S]*?)```','i'));
 if(!found||!found[1].trim()||found[1].length>100000)throw new Error('Missing or invalid requested fenced '+language+' code block.');
 return found[1];
}
module.exports={validateCase,languageFor,extractSolution};
