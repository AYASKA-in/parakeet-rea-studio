// Serve only the public website, with the same project-path prefix as GitHub Pages.
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
const root=path.resolve(__dirname,'../docs/site'),prefix='/parakeet-rea-studio/';
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.txt':'text/plain','.xml':'application/xml'};
const server=http.createServer(async(req,res)=>{try{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(pathname==='/'){res.writeHead(302,{Location:prefix}).end();return;}
 if(!pathname.startsWith(prefix)){res.writeHead(404).end('Not found');return;}
 const target=path.resolve(root,pathname.slice(prefix.length)||'index.html');
 if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 const content=await fs.readFile(target);res.writeHead(200,{'Content-Type':(types[path.extname(target)]||'application/octet-stream')+(path.extname(target)==='.png'?'':'; charset=utf-8'),'Cache-Control':'no-store'});res.end(content);
 }catch{res.writeHead(404,{'Content-Type':'text/html; charset=utf-8'});res.end(await fs.readFile(path.join(root,'404.html')));}});
server.listen(Number(process.env.PARAKEET_SITE_PORT||0),'127.0.0.1',()=>console.log('Website preview: http://127.0.0.1:'+server.address().port+prefix));
module.exports=server;
