# Milhas — pesquisa com ChatGPT

Abra **Iniciar Milhas.cmd** e acesse [o formulário local](http://127.0.0.1:8765/). O HTML também funciona aberto como arquivo, sem servidor.

1. Preencha origem, destino e eventuais destinos alternativos com códigos de cidade ou aeroporto. Escolha só ida ou ida e volta, datas e flexibilidade.
2. Selecione os programas. **Pontos primeiro** consulta resgates antes de usar dinheiro como referência. É possível pesquisar apenas pontos ou apenas dinheiro.
3. Para repetir o caso solicitado, clique em **Carregar teste: JDO → Campinas ou São Paulo · 12/11/2026**. Ele configura JDO → SAO (GRU/CGH/VCP), só ida, 1 adulto, econômica, sem flexibilidade, LATAM/Azul/Smiles e operadoras brasileiras.
4. Clique em **Preparar pesquisa no ChatGPT** e depois no link **Abrir mensagem no ChatGPT desktop**. No aplicativo, clique em **Enviar**, com o Chrome conectado. Também é possível copiar o roteiro diretamente para a conversa atual e enviar.

O link oficial `codex://new?prompt=…` preenche o editor; **não envia a mensagem nem inicia a pesquisa sozinho**. O estado `awaiting_send` significa apenas mensagem preparada. Este formulário não afirma que uma janela aberta corresponde a uma consulta executada. Veja a [documentação oficial de links do aplicativo](https://learn.chatgpt.com/docs/reference/commands) e a [conexão com Chrome](https://learn.chatgpt.com/docs/chrome-extension). O navegador conectado está disponível no aplicativo desktop; substituir o auxiliar por Codex CLI não dá ao CLI acesso a essa sessão do Chrome.

O fluxo atual usa ChatGPT. O servidor não procura, autentica nem executa Claude. `claude-local.cjs` e `iniciar-claude.cjs` são arquivos legados da primeira versão e não são chamados pelo formulário ou pelo iniciador atual.

O roteiro editado é preservado ao preparar a mensagem. Mudanças no formulário, nova geração, edição do texto ou limpeza invalidam o link anterior. TXT usa o texto do editor; JSON contém os campos do formulário. O retorno é omitido em viagens só de ida.

## Qualidade dos resultados

### Cidades com vários aeroportos

**SAO** reconhece São Paulo (GRU, CGH e VCP) e **RIO** reconhece Rio de Janeiro (GIG e SDU), tanto na origem quanto na chegada. Digitar em minúsculas também funciona. O catálogo inclui ainda BHZ, BUE, PAR, LON, ROM, MIL, TYO, YTO e CHI. A lista completa fica no formulário em **Cidades com vários aeroportos**.

O roteiro orienta selecionar a opção da cidade / todos os aeroportos no site, conferir os aeroportos efetivamente incluídos e pesquisar separadamente os que faltarem. A abrangência pode variar por companhia, modalidade e composição atual do agrupamento. A base local usa a [lista pública da IATA de 2022](https://www.iata.org/contentassets/c33c192da39a42fcac34cb5ac81fd2ea/ads_ab_2022_02-joint-iata-atpco-notification-ccd-list.pdf); ela não pretende listar todo aeroporto geograficamente próximo. Códigos ainda não cadastrados continuam aceitos, com instrução para verificar se representam aeroporto ou cidade antes da busca.

Um código individual continua específico: **GRU** não se transforma em SAO. Os aeroportos são deduplicados: SAO + GRU cobre três aeroportos, sem repetir Guarulhos. O formulário impede origem e destino com aeroporto sobreposto. Em SAO → RIO, o escopo de referência tem **6 pares de aeroportos** por data/modalidade/programa. Uma consulta agrupada só encerra a cobertura dos pares que de fato incluiu. No resultado, mostrar sempre os aeroportos reais dos voos e eventuais trocas de aeroporto na ida, volta ou conexão.

O JSON exportado e as preparações em `.milhas-sessoes` preservam os códigos escolhidos e o campo `scope`, com aeroportos resolvidos, agrupamentos e contagem de combinações. O reconhecimento é compartilhado pelo formulário, roteiro e servidor no núcleo `search-core` do HTML.

### Conferência das ofertas

- Consultar todos os programas e destinos selecionados em pontos primeiro; depois, dinheiro como referência quando solicitado.
- Conferir taxas de embarque, resgate e sobretaxas antes de destacar uma oferta. Quantidade de pontos sem taxas completas fica em pendências.
- Identificar programa, operadora, horários, bagagem, fonte, horário da consulta e condição de clube/titular.
- Usar “Smiles & Money” apenas na Smiles; na Azul, “pontos Azul + reais”.
- Não equiparar moedas de programas diferentes. Menos pontos de outro programa não comprova melhor custo financeiro.
- Entregar no máximo cinco opções úteis, escolha prática e cobertura real. Erro técnico não significa que a empresa não opera a rota.
- Login, 2FA ou CAPTCHA são resolvidos pelo usuário no navegador. Nunca pedir credenciais no formulário. Não reservar, emitir ou pagar.

Veja [o relatório desta pesquisa](relatorio.html) e [os dados estruturados](resultado-pesquisa.json). São uma fotografia da consulta, não atualização automática de preços. A cobertura é calculada a partir do resultado válido de cada combinação de programa, destino e data.

## Cotações e relatório reproduzível

Esta pasta contém a ferramenta completa, independente da aplicação Next.js da pasta superior. Não precisa executar `npm install` nem publicar o site para usá-la.

Os campos visíveis na sessão do usuário em [Calculadora de Milhas](https://travel-points-calculate.vercel.app/), em 22/10/2026 às 21:01 (Brasília), mostravam **LATAM Pass R$ 26, Smiles R$ 15 e Azul R$ 15 por 1.000 pontos**. São valores editáveis de referência da sessão, não uma cotação oficial ou uma API de mercado. Os padrões do repositório (Smiles 16 e Azul 18) diferiam dessa sessão. O registro da leitura está em `cotacoes-milhas.json`.

O formulário começa com esses valores e permite alterá-los antes de gerar o roteiro. A página local não lê o armazenamento privado do site publicado; não há sincronização automática. Campo em branco ou zero significa custo não informado.

O relatório usa `(pontos / 1.000 × custo do milheiro do programa) + dinheiro obrigatório`, com centavos e taxas somadas uma única vez. O custo atribuído aos pontos fica separado do dinheiro exigido na emissão. Somente valores com taxas conferidas e cotação conhecida entram na escolha de menor custo estimado.

Para atualizar o relatório após novas consultas, registre a evidência em `resultado-pesquisa.json`, revise `cotacoes-milhas.json` e execute `node relatorio.cjs`. O gerador atualiza o HTML, os custos estruturados e o indicador de cobertura. Apenas `observed` e `no_results` para a data exata contam como consultas concluídas. Um erro técnico continua pendente.

## Dados locais e execução

O auxiliar usa Node.js, sem dependências de npm, e escuta apenas em `127.0.0.1:8765`. Exige token temporário e rejeita requisições vindas de outros sites. Preparações ficam em `.milhas-sessoes`; nenhuma senha ou cookie é coletado. O envio da mensagem à conta ChatGPT ocorre no aplicativo, após o usuário enviar. Os arquivos do relatório não contêm saldo nem identificadores da conta.

Mantenha a janela do auxiliar aberta. `Ctrl+C` encerra o serviço. Limpar o formulário não apaga arquivos locais nem interrompe uma pesquisa que já tenha sido enviada ao ChatGPT.

Execute `node --test tests/*.test.cjs` para verificar validação, destinos alternativos, prioridade de pontos, preparação para ChatGPT, preservação de edição e proteção do servidor. Os testes não consultam companhias aéreas nem usam contas externas.
