const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {spawn, execFile} = require('node:child_process');
const {promisify} = require('node:util');
const execute = promisify(execFile);

function findClaude() {
  const npmBase=path.join(process.env.APPDATA || path.join(os.homedir(),'AppData','Roaming'),'npm','node_modules','@anthropic-ai','claude-code');
  const executables=[path.join(npmBase,'bin','claude.exe'),path.join(os.homedir(),'.local','bin','claude.exe')];
  for(const command of executables) if(fs.existsSync(command)) return {command,prefix:[]};
  const cli=path.join(npmBase,'cli.js');
  if(fs.existsSync(cli)) return {command:process.execPath,prefix:[cli]};
  return null;
}

async function diagnoseClaude() {
  const cli=findClaude();
  if(!cli) return {installed:false,loggedIn:false};
  try {
    const {stdout}=await execute(cli.command,[...cli.prefix,'auth','status'],{windowsHide:true,timeout:15000,maxBuffer:128*1024});
    const auth=JSON.parse(stdout);
    return {installed:true,loggedIn:Boolean(auth.loggedIn),method:auth.authMethod || null};
  } catch { return {installed:true,loggedIn:false}; }
}

const psQuote=value=>"'"+value.replace(/'/g,"''")+"'";

async function launchInteractive(job) {
  // Somente caminhos locais gerados pelo servidor entram no comando. O roteiro
  // segue em arquivo JSON, nunca é interpolado em PowerShell ou cmd.exe.
  const runner=path.join(__dirname,'iniciar-claude.cjs');
  const argumentLine=`"${runner}" "${job.jobFile}"`;
  const command=`Start-Process -FilePath ${psQuote(process.execPath)} -ArgumentList ${psQuote(argumentLine)} -WindowStyle Normal`;
  await execute('powershell.exe',['-NoProfile','-Command',command],{windowsHide:true,timeout:15000});
}

async function openBrowser(url) {
  // URL fixa do serviço local; nunca recebida do formulário.
  await execute('powershell.exe',['-NoProfile','-Command',`Start-Process ${psQuote(url)}`],{windowsHide:true,timeout:10000});
}

function runClaude(cli,args) {
  return new Promise((resolve,reject)=>{
    const child=spawn(cli.command,[...cli.prefix,...args],{stdio:'inherit',windowsHide:false});
    child.on('error',reject); child.on('exit',(code,signal)=>resolve({code,signal}));
  });
}
module.exports={findClaude,diagnoseClaude,launchInteractive,openBrowser,runClaude};
