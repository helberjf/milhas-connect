const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const vm=require('node:vm');
const {randomBytes,randomUUID,timingSafeEqual}=require('node:crypto');
const {execFile}=require('node:child_process');

function currentDate() { return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
function createMilhasServer(options={}) {
  const root=__dirname,runsDir=options.runsDir || path.join(root,'.milhas-sessoes');
  const token=randomBytes(32).toString('hex'),jobs=new Map();
  const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
  const sameToken=value=>typeof value==='string' && /^[a-f0-9]{64}$/.test(value) && timingSafeEqual(Buffer.from(value),Buffer.from(token));
  async function body(req) {
    const parts=[];let size=0;
    for await(const part of req) {size+=part.length;if(size>160000) throw Object.assign(new Error('Formulário excede o limite de tamanho.'),{status:413});parts.push(part);}
    try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}
    catch{throw Object.assign(new Error('Dados JSON inválidos.'),{status:400});}
  }
  return http.createServer(async(req,res)=>{
    for(const [key,value] of Object.entries({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'})) res.setHeader(key,value);
    const port=req.socket.localPort;
    if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host)) return json(res,403,{error:'Endereço local inválido.'});
    const origin=`http://${req.headers.host}`;
    if(req.headers.origin && req.headers.origin!==origin) return json(res,403,{error:'Abra o formulário no endereço local.'});
    const url=new URL(req.url,origin);
    try {
      if(req.method==='GET' && ['/', '/index.html','/relatorio.html','/resultado-pesquisa.json','/cotacoes-milhas.json'].includes(url.pathname)) {
        const file=['/','/index.html'].includes(url.pathname)?'index.html':url.pathname.slice(1);
        let content=await fs.readFile(path.join(root,file),'utf8');
        if(file==='index.html') content=content.replace('</head>',`<meta name="milhas-session" content="${token}">\n</head>`);
        res.writeHead(200,{'Content-Type':file.endsWith('.json')?'application/json; charset=utf-8':'text/html; charset=utf-8'});return res.end(content);
      }
      if(url.pathname.startsWith('/api/') && !sameToken(req.headers['x-milhas-token'])) return json(res,403,{error:'Sessão inválida. Recarregue o formulário local.'});
      if(req.method==='GET' && url.pathname==='/api/status') return json(res,200,{bridge:true,provider:'chatgpt',automaticSubmission:false});
      if(req.method==='GET' && /^\/api\/jobs\/[a-f0-9-]{36}$/.test(url.pathname)) {
        const job=jobs.get(url.pathname.split('/').pop());return json(res,job?200:404,job || {error:'Preparação não encontrada.'});
      }
      if(req.method==='POST' && url.pathname==='/api/research') {
        if(!String(req.headers['content-type']).startsWith('application/json')) return json(res,415,{error:'Envie o formulário como JSON.'});
        const payload=await body(req),data=payload?.data;
        if(!data || typeof data!=='object' || ['origin','destination','cabin','baggage'].some(key=>typeof data[key]!=='string') || ['notes','alternatives'].some(key=>data[key]!==undefined && typeof data[key]!=='string') || (data.brazilianOnly!==undefined && typeof data.brazilianOnly!=='boolean')) return json(res,422,{error:'Dados da viagem inválidos.'});
        const html=await fs.readFile(path.join(root,'index.html'),'utf8'),context=vm.createContext({});
        vm.runInContext(html.match(/<script id="search-core">([\s\S]*?)<\/script>/)[1],context,{timeout:1000});
        const core=context.PesquisaMilhas,errors=core.validate(data,currentDate());
        if((data.notes || '').length>2000) errors.push('As observações devem ter até 2.000 caracteres.');
        if(payload.prompt!==undefined && (typeof payload.prompt!=='string' || !payload.prompt.trim() || payload.prompt.length>30000)) errors.push('O roteiro editado deve ter entre 1 e 30.000 caracteres.');
        if(errors.length) return json(res,422,{error:errors.join(' ')});
        const id=randomUUID(),prompt=payload.prompt===undefined?core.buildPrompt(data,currentDate()):payload.prompt;
        const job={id,provider:'chatgpt',state:'awaiting_send',message:'Mensagem preparada. Abra no ChatGPT desktop e clique em Enviar para iniciar.',prompt,scope:core.searchScope(data,currentDate()),launchUrl:'codex://new?prompt='+encodeURIComponent(prompt)};
        const directory=path.join(runsDir,id);
        await fs.mkdir(directory,{recursive:true});
        await fs.writeFile(path.join(directory,'viagem.json'),JSON.stringify({...job,data,createdAt:new Date().toISOString()},null,2),'utf8');
        jobs.set(id,job);return json(res,201,job);
      }
      return json(res,404,{error:'Endereço não encontrado.'});
    }catch(error){return json(res,error.status || (error.code==='ENOENT'?404:500),{error:error.status?error.message:error.code==='ENOENT'?'Arquivo não encontrado.':'Falha ao preparar a pesquisa local.'});}
  });
}
if(require.main===module) {
  const port=8765,url=`http://127.0.0.1:${port}/`,server=createMilhasServer();
  server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`O Milhas já pode estar aberto: ${url}`:error.message);process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>{
    console.log(`MILHAS · pesquisa com ChatGPT\nAbra: ${url}\nMantenha esta janela aberta. Ctrl+C encerra o auxiliar.`);
    if(!process.argv.includes('--no-open')) execFile('powershell.exe',['-NoProfile','-Command',`Start-Process '${url}'`],{windowsHide:true},()=>{});
  });
}
module.exports={createMilhasServer};
