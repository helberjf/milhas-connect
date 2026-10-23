const fs = require('node:fs/promises');
const path = require('node:path');
const readline = require('node:readline/promises');
const {findClaude,diagnoseClaude,runClaude}=require('./claude-local.cjs');

async function main() {
  const jobFile=path.resolve(process.argv[2] || '');
  const job=JSON.parse(await fs.readFile(jobFile,'utf8'));
  const statusFile=path.join(path.dirname(jobFile),'status.json');
  async function status(state,message) {
    const temporary=statusFile+'.tmp';
    await fs.writeFile(temporary,JSON.stringify({id:job.id,state,message,pid:process.pid,updatedAt:new Date().toISOString()}),'utf8');
    await fs.rename(temporary,statusFile);
  }
  process.title='Milhas — pesquisa com Claude';
  console.log('\nMILHAS · PESQUISA AUTOMÁTICA COM CLAUDE\n');
  console.log(`Viagem: ${job.data.origin} → ${job.data.destination}`);
  console.log('Esta janela mostra o agente. Responda aqui aos pedidos de acesso ao navegador.');
  console.log('O roteiro já será enviado. Não é necessário copiar ou colar.\n');
  const cli=findClaude();
  if(!cli) { await status('error','Claude Code não encontrado.'); throw new Error('Instale Claude Code antes de pesquisar.'); }
  try {
    const diagnostic=await diagnoseClaude();
    if(!diagnostic.loggedIn) {
      await status('waiting_login','Faça login na janela do Claude para continuar.');
      console.log('Primeira configuração: faça login com sua conta Claude.\n');
      const login=await runClaude(cli,['auth','login']);
      if(login.code!==0 || !(await diagnoseClaude()).loggedIn) throw new Error('Login não concluído. Clique em pesquisar novamente após entrar na conta.');
    }
    await status('agent_open','Claude iniciando. Confira a conexão do navegador e os pedidos de permissão na janela.');
    const prompt='Use a integração Claude in Chrome para abrir o navegador e executar esta pesquisa. Se a extensão não estiver conectada, ajude a configurar /chrome antes de alegar que pesquisou. Apresente os resultados nesta sessão. Não modifique os arquivos deste projeto.\n\n'+job.prompt;
    // spawn envia o roteiro como um argumento separado, sem shell e sem avaliar
    // aspas, quebras de linha, $(), &, comandos ou caminhos das observações.
    const result=await runClaude(cli,['--chrome','--name',`Milhas ${job.data.origin}-${job.data.destination}`,prompt]);
    if(result.code!==0) throw new Error('Claude encerrou com erro ou foi interrompido. Consulte esta janela.');
    await status('session_closed','Sessão do Claude encerrada. Confira nela os resultados e eventuais pendências.');
  } catch(error) { await status('error',error.message); throw error; }
}

main().catch(async error=>{
  console.error('\n'+error.message);
  if(process.stdin.isTTY) {
    const input=readline.createInterface({input:process.stdin,output:process.stdout});
    await input.question('\nPressione Enter para fechar esta janela.'); input.close();
  }
  process.exitCode=1;
});
