# Robô local do Milhas Connect

O site coloca pesquisas na fila. Este auxiliar consulta a fila, executa o Codex CLI autenticado e usa o Playwright MCP da Microsoft para pesquisar os sites oficiais num perfil Chrome exclusivo. O resultado estruturado volta ao site automaticamente. O computador precisa ficar ligado, conectado e com o auxiliar aberto. A hospedagem Vercel não opera o Chrome deste computador.

## Preparação

1. Instale Node.js 22 e Google Chrome. Abra o aplicativo Codex e entre na conta ChatGPT. O CLI precisa oferecer `--ignore-user-config`, `--output-schema`, `--ephemeral` e a opção `features.shell_tool=false`.
2. Na pasta do projeto, execute `npm install` para instalar as dependências já declaradas pelo projeto.
3. Execute `node scripts/robot-setup.mjs`. Informe a origem HTTPS do site, um nome para este computador e o token de auxiliar provisionado junto ao site. O token é digitado sem aparecer na tela. Ele não é a senha do painel.
4. Execute `node scripts/robot-status.mjs --check`. O diagnóstico verifica Codex, autenticação, Chrome, Playwright MCP e acesso à API. Não abre navegador nem pesquisa tarifas.
5. Abra **Iniciar Milhas Connect.cmd**. Faça uma pesquisa no site e mantenha a janela do auxiliar aberta. Ctrl+C encerra o auxiliar e os processos de pesquisa iniciados por ele.

Se a configuração já foi provisionada em `.robot-data/config.json`, o lançador pode ser aberto diretamente. O token não deve ser enviado por argumento de linha de comando, URL, prompt do Codex ou mensagem de chat. Para provisionamento automatizado, `node scripts/robot-setup.mjs --stdin` aceita JSON por entrada padrão, sem ecoar o conteúdo. Não grave a entrada num arquivo versionado.

Configuração local, com valores ilustrativos (não copie o token de exemplo):

```json
{
  "siteUrl": "https://seu-site.vercel.app",
  "workerToken": "token-fornecido-na-configuracao",
  "robotId": "meu-computador",
  "pollSeconds": 15,
  "jobTimeoutMinutes": 30
}
```

`codexPath` é opcional, absoluto. O auxiliar procura primeiro no PATH e depois nas pastas de instalação do aplicativo Codex no Windows. A configuração permite HTTP somente para localhost. Polling: 5–300 segundos; limite por pesquisa: 1–120 minutos. O padrão é 15 segundos e 30 minutos. Apenas uma pesquisa executa por vez; um bloqueio local também impede abrir o mesmo perfil simultaneamente pelo comando de login.

## Login, CAPTCHA e intervenção

Execute `node scripts/robot-login.mjs` com o auxiliar parado para abrir as companhias no perfil exclusivo. Opcionalmente selecione programas: `node scripts/robot-login.mjs latam smiles`. Faça login/2FA/CAPTCHA diretamente na janela e feche-a quando terminar. Depois abra o lançador e repita a pesquisa pelo painel. Senhas e códigos não são solicitados pelo auxiliar.

O perfil fica em `.robot-data/chrome-profile`. Ele não usa nem copia o perfil cotidiano, cookies ou abas pessoais do Chrome. Se login/CAPTCHA aparecer durante uma consulta, o resultado deve indicar atenção necessária; a pesquisa não tenta contornar esse controle. Intervenções que dependam da página aberta podem exigir repetir a consulta depois do login. O robô pesquisa disponibilidade e detalhes, sem reservar, emitir ou pagar.

## Resultado e cobertura

O pesquisador recebe somente os parâmetros da viagem, o esquema de resultado e as ferramentas permitidas do navegador. O processo não recebe token do auxiliar, senha do painel, credenciais do banco ou chaves API herdadas do ambiente. Shell, outros aplicativos, plugins e ferramentas de execução de código do navegador são desativados. Um intermediário MCP limita as ferramentas, bloqueia navegação explícita a arquivos e domínios externos e ações com rótulos explícitos de reserva/pagamento. Isso limita a interface disponível; a interpretação das páginas ainda depende do agente.

Cada observação bem-sucedida do navegador recebe um `Milhas Connect observedAt` UTC gerado pelo computador. O pesquisador usa esse horário real ao registrar preços e cobertura. Fontes de ofertas precisam ser HTTPS nos domínios oficiais do programa. Campos nulos preservam dados ausentes. `points` e `cashRequired` são totais para todos os passageiros e todos os trechos; taxas não verificadas continuam pendentes. Uma falha técnica, bloqueio ou login nunca vira `no_results`.

Flexibilidade desloca ida e volta pelo mesmo número de dias, preservando a duração. Códigos de cidade são expandidos conforme o catálogo de referência; o agente confere a abrangência real da busca no site. São aceitas até 50 ofertas e 300 registros de cobertura, respeitando o limite de 2.000.000 bytes UTF-8 da API, com margem de 4.096 bytes para o envelope do robô. Resultado excessivo é rejeitado antes de virar envio pendente. Em escopos maiores ou com limite de tempo, a pesquisa pode ficar parcial e deve dizer precisamente o que falta. Os sites e interfaces podem mudar; não há garantia de acesso, disponibilidade ou conclusão de todos os programas em cada execução. O uso do Codex está sujeito aos limites da conta autenticada.

## Entrega, falhas e arquivos locais

O heartbeat ocorre a cada 20 segundos durante uma pesquisa e renova o lease de 120 segundos. Cancelamento no painel interrompe a árvore do processo iniciada pelo auxiliar. Se a conexão com o site fica sem heartbeat por 90 segundos, a execução é interrompida para evitar trabalhar com um lease vencido. O auxiliar não encerra processos do Chrome cotidiano nem outros processos encontrados pelo nome.

Antes de enviar um resultado/erro, o auxiliar salva o mesmo corpo e lease em `.robot-data/outbox.json`. Falha de rede mantém esse arquivo e o reenvia antes de aceitar outra pesquisa. Reenvio idempotente usa o mesmo lease e conteúdo. Token inválido (HTTP 401/403) mantém a caixa ativa até a configuração ser corrigida. Lease rejeitado/cancelado, pesquisa inexistente ou resultado recusado definitivamente (HTTP 409/404/413/422) salva primeiro uma cópia integral em `.robot-data/rejected-results`, com motivo e data; só então remove a caixa ativa e permite novas pesquisas. O estado/log e o diagnóstico avisam sobre os resultados preservados. A pasta aceita no máximo 100 rejeições; ao atingir esse limite, mantém a caixa ativa até os arquivos serem revisados/exportados, sem descartar dados. A fila do site trata leases expirados e reagenda trabalho conforme o protocolo.

`node scripts/robot-status.mjs` mostra processo, último estado, caixa de envio e requisitos. `--check` testa a conexão quando não há outro processo local ativo. `node scripts/robot-start.mjs --once` processa no máximo uma etapa para diagnóstico de integração. Esses comandos não exibem o token. A pasta `.robot-data` precisa estar ignorada pelo Git e protegida no Windows; o auxiliar tenta aplicar ACL somente ao usuário atual.

Arquivos locais: `config.json` (segredo), `worker.lock`, `status.json`, `outbox.json` (lease e resultado pendentes), `rejected-results` (até 100 cópias preservadas), `worker.log` e até uma rotação de log de aproximadamente 256 KB cada. Eventos e snapshots brutos do Codex não são gravados no log. Até dez diretórios de execução são mantidos em `.robot-data/runs`, com esquema, resultado e possíveis artefatos do navegador. Esses arquivos e o perfil podem conter informações privadas da sessão e devem permanecer neste computador. O workspace temporário e vazio do agente é removido no fim da execução.

## Verificação técnica

Execute `node --test tests/robot*.test.mjs`. Os testes cobrem validação de escopo e fontes, esquema estrito com nulos, persistência/reenvio/quarentena, cancelamento por heartbeat, timeout, limite de saída, ponte MCP e isolamento de argumentos/ambiente. O teste opcional `node scripts/robot-self-test.mjs` usa uma pequena chamada real ao Codex para conferir inicialização MCP e JSON estrito, sem solicitar navegador nem pesquisar tarifas. Testes locais controlados não comprovam disponibilidade ou acesso aos sites das companhias. A validação de tarifas reais requer execução observada no navegador e nunca usa tarifas de exemplo como resultado de produção.

Referências primárias: [Codex não interativo](https://learn.chatgpt.com/docs/non-interactive-mode), [MCP no Codex](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) e [perfil persistente do Playwright MCP](https://playwright.dev/mcp/configuration/user-profile).
