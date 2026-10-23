const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {createMilhasServer}=require('../servidor.cjs');
let server,address,token,runsDir,launches=0;
before(async()=>{
  runsDir=await fs.mkdtemp(path.join(os.tmpdir(),'milhas-test-'));
  server=createMilhasServer({runsDir,launch:async()=>{launches++;},diagnose:async()=>{throw new Error('Claude não deve ser consultado');}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  address=`http://127.0.0.1:${server.address().port}`;
  token=(await (await fetch(address)).text()).match(/name="milhas-session" content="([a-f0-9]+)"/)[1];
});
after(async()=>{
  await new Promise(resolve=>server.close(resolve));
  assert.equal(path.dirname(path.resolve(runsDir)),path.resolve(os.tmpdir()));
  assert.ok(path.basename(runsDir).startsWith('milhas-test-'));
  await fs.rm(runsDir,{recursive:true,force:true});
});
const data={origin:'JDO',destination:'VCP',alternatives:'GRU, CGH',brazilianOnly:true,trip:'oneway',departure:'2099-12-10',returnDate:'',flexOut:0,flexBack:0,adults:1,cabin:'Econômica',currency:'BRL',payment:'both',companies:['latam','azul','smiles'],stops:'any',baggage:'Verificar franquia',notes:''};
const headers=()=>({'Content-Type':'application/json','X-Milhas-Token':token,Origin:address});
const post=(payload,extra={})=>fetch(address+'/api/research',{method:'POST',headers:{...headers(),...extra},body:JSON.stringify(payload)});
test('token e origem protegem a preparação local',async()=>{
  assert.equal((await post({data},{'X-Milhas-Token':''})).status,403);
  assert.equal((await post({data},{'X-Milhas-Token':'é'.repeat(64)})).status,403);
  assert.equal((await post({data},{Origin:'https://example.com'})).status,403);
});
test('valida rota, alternativas e sites antes de preparar',async()=>{
  assert.equal((await post({data:{...data,destination:'JDO'}})).status,422);
  assert.equal((await post({data:{...data,alternatives:['GRU']}})).status,422);
  assert.equal((await post({data:{...data,companies:['toString']}})).status,422);
});
test('prepara ChatGPT sem consultar ou abrir Claude e sem alegar início da pesquisa',async()=>{
  const response=await post({data}); assert.equal(response.status,201);
  const job=await response.json(); assert.equal(job.state,'awaiting_send');
  assert.equal(launches,0); assert.match(job.prompt,/PRIMEIRO.*milhas/);
  assert.match(job.prompt,/VCP, GRU, CGH/);
  const link=new URL(job.launchUrl);
  assert.equal(link.protocol,'codex:'); assert.equal(link.searchParams.get('prompt'),job.prompt);
  const saved=JSON.parse(await fs.readFile(path.join(runsDir,job.id,'viagem.json'),'utf8'));
  assert.equal(saved.provider,'chatgpt'); assert.equal(saved.prompt,job.prompt);
  const status=await (await fetch(address+'/api/jobs/'+job.id,{headers:headers()})).json();
  assert.equal(status.state,'awaiting_send');
});
test('preserva roteiro editado e permite preparar outra viagem sem janela fantasma',async()=>{
  const prompt='Pesquisar os pontos desta viagem. Observação editada: chegar antes das 15h.';
  const response=await post({data,prompt}); assert.equal(response.status,201);
  assert.equal((await response.json()).prompt,prompt);
  assert.equal((await post({data})).status,201);
  assert.equal(launches,0);
});
test('recusa roteiro vazio, excessivo ou não textual',async()=>{
  for(const prompt of ['',42,'x'.repeat(30001)]) assert.equal((await post({data,prompt})).status,422);
});
test('status distingue preparação de execução e não solicita login de Claude',async()=>{
  const response=await fetch(address+'/api/status',{headers:headers()}); assert.equal(response.status,200);
  const status=await response.json(); assert.equal(status.provider,'chatgpt'); assert.equal(status.automaticSubmission,false);
});
test('não lê caminhos arbitrários pelo endpoint de sessão',async()=>{
  assert.equal((await fetch(address+'/api/jobs/arquivo.json',{headers:headers()})).status,404);
});
test('preparação salva códigos de cidade e aeroportos resolvidos para o agente',async()=>{
  const response=await post({data:{...data,origin:'sao',destination:'rio',alternatives:''}});
  assert.equal(response.status,201);
  const job=await response.json();
  assert.deepEqual(job.scope.origins,['GRU','CGH','VCP']);
  assert.deepEqual(job.scope.destinations,['GIG','SDU']);
  assert.equal(job.scope.routeCount,6);
  const saved=JSON.parse(await fs.readFile(path.join(runsDir,job.id,'viagem.json'),'utf8'));
  assert.equal(saved.scope.originSelection,'SAO');
  assert.equal(saved.scope.destinationSelections[0],'RIO');
  assert.equal((await post({data:{...data,origin:'SAO',destination:'GRU',alternatives:''}})).status,422);
});
