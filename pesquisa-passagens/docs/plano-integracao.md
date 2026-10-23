# Cotação e conclusão da pesquisa — 22/10/2026

Objetivo autorizado: salvar toda a ferramenta local nesta subpasta do repositório, aplicar os valores por milheiro visíveis na sessão do site da calculadora e concluir as consultas restantes antes de atualizar o relatório.

Desenho: ferramenta independente em `pesquisa-passagens`, sem alterar a calculadora publicada. Cotação é um registro dos campos visíveis no Chrome, com fonte e horário, distinguido dos padrões do repositório. Custo estimado = pontos / 1.000 × valor do milheiro + dinheiro obrigatório. Só ofertas com taxas conferidas entram na comparação de custo completo. Valores históricos conservam a data de observação.

Plano de execução nesta sessão:
- [x] Conferir site, código de cálculo e diferenças entre cotação salva no navegador e valores padrão.
- [x] Copiar HTML, servidor, iniciador, scripts, roteiro, testes, documentação e relatório para esta pasta. Não copiar sessões locais de execução.
- [x] Retomar LATAM JDO–VCP, LATAM JDO–CGH e Azul JDO–CGH usando consultas válidas de 12/11/2026. LATAM VCP/CGH terminou sem disponibilidade; Azul CGH teve tarifa e taxas conferidas. Cobertura: 9/9.
- [x] Testar cálculo monetário, arredondamento, cotação ausente e completude da cobertura. Implementar geração reproduzível do relatório a partir dos dados JSON.
- [x] Incluir cotações e fórmula no roteiro futuro; acrescentar os resultados concluídos e custos estimados ao relatório.
- [x] Executar testes, revisar arquivos e interface; servir a pasta do repositório no endereço local já utilizado e conferir o relatório final.

Critérios: valores corretos por programa, taxas sem duplicação, dados de nove combinações de programa/destino, ausência de preços inventados, script/roteiro completos dentro do repositório. Se um controle de acesso exigir ação humana, solicitar apenas essa intervenção enquanto as demais etapas continuam.

Verificação final: 24 testes Node passaram; ESLint do repositório passou. Revisão independente encontrou dois casos limite (total ausente renderizado como zero e moeda estrangeira somada a BRL), ambos corrigidos e cobertos por testes. Interface conferida no navegador: valores 26/15/15, roteiro com cotações, invalidação do link após edição, relatório com 5 ofertas, 9 linhas de cobertura e custos R$ 390,97 / 567,78 / 709,68 / 742,08 / 1.438,68. Servidor ativo a partir desta subpasta em 127.0.0.1:8765. Captura visual: relatorio-preview.png na pasta superior.
