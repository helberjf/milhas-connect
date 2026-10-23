# Formulário e roteiro de pesquisa de passagens

## Integração vigente com a calculadora — 22/10/2026

Ferramenta completa salva em `projects/travel-points-calculate/pesquisa-passagens`. Cotações da sessão: LATAM 26, Smiles 15 e Azul 15 reais por milheiro, editáveis no formulário e incluídas no roteiro. Gerador `relatorio.cjs` calcula os custos e a cobertura a partir dos JSON. As nove consultas de resgate foram concluídas; relatório atualizado com cinco ofertas. Plano e verificação desta etapa: [plano-integracao.md](plano-integracao.md). As seções seguintes preservam o histórico da implementação.

## Atualização vigente — ChatGPT e pontos primeiro, 22/10/2026

Por solicitação do usuário após avaliar o relatório: o fluxo padrão passa a preparar pesquisa no ChatGPT desktop, usando Chrome conectado. O link oficial preenche o editor e o usuário envia no app; o servidor registra `awaiting_send`, sem alegar execução. Nenhum processo Claude é iniciado. As seções abaixo registram o histórico anterior.

Implementação atual: destinos alternativos explícitos e deduplicados; restrição opcional a LATAM Brasil/Azul/GOL; preset do teste JDO → VCP/GRU/CGH em 12/11/2026; pontos primeiro e dinheiro secundário; no máximo cinco opções úteis, taxas conferidas, fonte/hora e cobertura parcial honesta. Edições manuais seguem para o link preparado; alterações invalidam links antigos inclusive durante respostas assíncronas.

Verificação: testes do núcleo e do servidor, revisão independente do frontend com cenários de edição e respostas pendentes, além de consultas reais no Chrome. Relatório e dados estruturados entregues separadamente. Não há emissão de bilhetes.

Formato aprovado pelo usuário em 22/10/2026: HTML local, sem instalação.

## Design

Um único index.html, com CSS e JavaScript incorporados, funciona sem internet para preparar a pesquisa. O agente que receber o roteiro precisa ter navegação habilitada para consultar preços reais. Não há integração automática nem coleta de credenciais.

Campos: aeroportos IATA, ida ou ida e volta, datas, flexibilidade de até sete dias para cada trecho, passageiros adultos, cabine, pagamento em dinheiro/milhas/ambos, companhias, conexões, bagagem e observações. Origem e destino podem ser invertidos. Dez programas disponíveis: LATAM Pass, Azul Fidelidade, Smiles, TAP Miles&Go, Iberia Club, AAdvantage, Qatar Privilege Club, Air Europa SUMA, Copa ConnectMiles e Avianca LifeMiles.

Saída: roteiro editável e copiável, download TXT e briefing JSON. Sem abertura automática de múltiplos sites. Os links oficiais ficam disponíveis individualmente. Dados permanecem apenas na página, sem envio ou armazenamento persistente.

O roteiro limita a pesquisa às datas e sites selecionados; separa moeda e programa, exige taxas, valores totais e por passageiro, fontes e horário da consulta. Pesquisa flexível considera apenas pares de datas válidos e informa cobertura incompleta. Login/CAPTCHA exige intervenção humana; não emitir, reservar ou pagar.

## Plano de execução

- [x] Criar testes do núcleo: datas inválidas, intervalo flexível, aeroporto idêntico, ausência de sites e instruções geradas.
- [x] Construir HTML acessível e responsivo com formulário, painel de roteiro e downloads.
- [x] Escrever roteiro reutilizável e instruções de uso em Markdown.
- [x] Executar testes com node --test tests/formulario.test.cjs: 8 testes passaram.
- [x] Verificar a interface em navegador via HTTP local: ida e volta, só ida com retorno desabilitado, flexibilidade, seleção de dois sites, atualização de roteiro, controles de TXT/JSON e reset. Prévia aberta no Codex.

Limite da verificação: navegador integrado não aceita file://. O fluxo foi testado por HTTP local, sem dependências externas. O arquivo deve ser aberto pelo usuário em navegador comum para uso sem servidor.

## Evolução solicitada: iniciar a pesquisa automaticamente

O usuário pediu que o preenchimento também inicie o agente e abra o navegador. O computador tem Chrome e Claude Code instalados; o CLI ainda precisa de login. Os links de ChatGPT e Claude Desktop documentados apenas preenchem o editor e não enviam a tarefa. A implementação usará o caminho oficial `claude --chrome` para abrir uma sessão interativa com o roteiro inicial.

- Criar servidor Node em 127.0.0.1:8765; iniciar pelo arquivo Iniciar Milhas.cmd.
- Formulário ganha botão Pesquisar automaticamente com Claude e estado de configuração/sessão.
- Token temporário por sessão do auxiliar e checagem de origem impedem disparos por outros sites. Aceitar apenas rotas fixas e viagens válidas.
- Gerar roteiro no servidor com o mesmo núcleo do HTML. Salvar viagem e roteiro localmente em .milhas-sessoes, sem credenciais.
- Abrir terminal interativo para login/permissões e iniciar Claude Code com `--chrome` e mensagem inicial. Não desabilitar verificações ou permissões do agente.
- Informar honestamente se o agente está aguardando login, em execução ou com sessão encerrada. Não chamar sessão aberta de pesquisa concluída.
- Manter copiar/baixar como alternativa quando o usuário abrir apenas o HTML.
- Testar o despacho com lançador substituído, sem iniciar buscas reais ou usar conta externa no teste. Verificar interface e conexão local. Autenticação e extensão requerem configuração direta do usuário.

Implementado: servidor.cjs, claude-local.cjs, iniciar-claude.cjs, Iniciar Milhas.cmd e botão no HTML. O auxiliar encontrou a instalação nativa do Claude e confirmou login pendente. Os 18 testes do formulário e do servidor passaram; a interface confirmou conexão com o auxiliar, aviso de login, validação antes da pesquisa e funcionamento do modo somente roteiro. Abertura da sessão real e consultas aéreas não foram executadas com dados fictícios; dependem do login e da extensão do usuário.

Sem repositório Git prévio neste diretório; entregar arquivos diretamente, sem criar branches ou commits.
