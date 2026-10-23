# Verificação de publicação — 23/10/2026

- Projeto: https://milhas-connect.vercel.app — Vercel `helberjfs-projects/milhas-connect`.
- Repositório independente e privado: https://github.com/helberjf/milhas-connect, branch `main`, conectado ao deploy automático.
- Banco novo: Neon `milhas-connect-db`, plano gratuito, separado das aplicações anteriores.
- Testes: 76 passando. Lint e build de produção aprovados. Auditoria npm sem vulnerabilidades conhecidas na verificação.
- Navegador: login protegido, criação de pesquisa persistida, detalhes, repetição, calculadora manual (13.161 × 26 ÷ 1.000 + 48,78 = R$ 390,97), tela móvel de 390 px e abertura do menu conferidos.
- Integração real: o auxiliar local autenticou na Vercel, recebeu a pesquisa GRU–LIS para 10/03/2027, abriu o site oficial LATAM pelo perfil Chrome dedicado e enviou resposta estruturada ao painel.
- Resultado observado: a busca em milhas exigiu login LATAM. O painel recebeu `attention_required`, fonte oficial, horário e orientação de acesso humano. Nenhuma oferta ou taxa foi inventada. A obtenção de tarifas após login depende dessa intervenção e ainda não foi verificada.
- A execução local exige o computador ligado, Chrome, Node e Codex autenticado com cota disponível. Use Iniciar Milhas Connect.cmd; para login humano, com o auxiliar parado, use Login das companhias.cmd.
- O repositório original travel-points-calculate permaneceu limpo em `a3e19059d54a8f0a93575907bb58ce07e6b1c0bd`.

A senha do painel fica somente no arquivo local ignorado `.platform-data/Acesso Milhas Connect.md`. Tokens e acesso ao banco não foram enviados ao Git. O teste real detectou e corrigiu host de ferramentas desativado e política de aprovação inadequada para o servidor de navegador exclusivo; regressões foram adicionadas. Filtros de ferramentas/domínios/ações e shell desativado permanecem aplicados.
