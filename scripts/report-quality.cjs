const fs=require('node:fs/promises'),path=require('node:path');
const {qualitySummary}=require('../evals/report.cjs');
(async()=>{
 const files=process.argv.slice(2).filter(arg=>arg.startsWith('--input=')).map(arg=>arg.slice(8));
 if(!files.length||files.length>100)throw new Error('Supply 1..100 --input=PATH evaluation receipts.');
 const receipts=[];
 for(const file of files){const stat=await fs.stat(file);if(stat.size>10*1024*1024)throw new Error('Receipt exceeds 10 MiB.');receipts.push(JSON.parse(await fs.readFile(file,'utf8')));}
 const report=qualitySummary(receipts);report.createdAt=new Date().toISOString();
 const folder=path.resolve(__dirname,'../test-results','quality-summary-'+Date.now());await fs.mkdir(folder,{recursive:true});
 const output=path.join(folder,'report.json');await fs.writeFile(output,JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));console.log('Local summary: '+output);
})().catch(error=>{console.error('Summary unavailable: '+String(error.message).replace(/(?:AIza|AQ\.)[\w.-]+/g,'[redacted]'));process.exitCode=1;});
