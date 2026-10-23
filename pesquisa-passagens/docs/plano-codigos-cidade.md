# Códigos de cidade na pesquisa — 23/10/2026

Objetivo solicitado: aceitar códigos de cidade como SAO e RIO na origem, no destino e nos destinos alternativos, com compreensão dos aeroportos agrupados.

Desenho: manter um catálogo único dentro do núcleo do HTML para preservar o uso como arquivo local. SAO referencia GRU/CGH/VCP; RIO referencia GIG/SDU. Acrescentar outros agrupamentos comuns documentados pela IATA. O catálogo é uma referência, não uma garantia sobre o filtro de cada companhia. O roteiro exige selecionar a opção da cidade/todos os aeroportos, conferir a abrangência e pesquisar separadamente os aeroportos que faltarem. Códigos individuais continuam específicos, sem ampliação automática para a cidade.

Funções do núcleo: `locationInfo`, `destinationSelections`, `origins`, `destinations` e `searchScope`. Deduplicar aeroportos após a expansão; impedir origem/destino sobrepostos. Contar pares origem/destino reais multiplicados pelas datas válidas. Incluir o escopo resolvido nos arquivos JSON e preparações do servidor. Mostrar os aeroportos reconhecidos junto aos campos e em uma lista de consulta.

Plano:
- [x] Escrever e executar testes que falham para SAO/RIO, normalização, deduplicação, sobreposição, contagem de pares e roteiro de contingência.
- [x] Implementar catálogo de 11 cidades, escopo e integração no formulário/servidor.
- [x] Atualizar roteiro e documentação, preservando os resultados históricos já conferidos.
- [x] Executar testes e conferir o formulário no navegador com SAO → RIO e código individual.

Verificação: 29 testes Node passaram. Revisão independente sem problemas importantes. Navegador confirmou SAO → RIO = 6 combinações por data, GRU → RIO = 2, bloqueio de SAO → GRU por sobreposição e JSON exportado com seleções SAO/RIO e aeroportos expandidos. Prévia: `../formulario-cidades-preview.png`. O formulário ficou novamente no teste solicitado JDO → SAO, pronto para gerar pesquisa. Nenhuma nova consulta aérea foi iniciada para as rotas usadas apenas na verificação da interface.

Fontes: [conceito de códigos de localidade IATA](https://www.iata.org/en/iata-repository/pressroom/fact-sheets/fact-sheet-iata-location-codes/) e [lista pública de cidades com múltiplos aeroportos, 2022](https://www.iata.org/contentassets/c33c192da39a42fcac34cb5ac81fd2ea/ads_ab_2022_02-joint-iata-atpco-notification-ccd-list.pdf). A composição atual exibida no site deve ser conferida durante cada consulta; não incluir aeroportos fora do pedido com base apenas em proximidade geográfica.
