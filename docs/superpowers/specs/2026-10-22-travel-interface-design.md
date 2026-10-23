# Interface focada em viagens

Organização aprovada pelo usuário em 22/10/2026.

A calculadora de emissão será a tela inicial. O formulário terá programa, quantidade de pontos, taxas e dados opcionais de venda e comissão. Um painel ao lado mostrará custo das milhas, custo total e resultados de venda em tempo real. Uma única seção permitirá editar os valores do milheiro.

A navegação principal terá Calculadora, Comparar emissões e Histórico. Orçamentos de passagens e consumo de combustível ficarão no dropdown Ferramentas de viagem, com menu hambúrguer em telas pequenas. Links existentes com o parâmetro orcamento abrirão a ferramenta de orçamentos automaticamente.

A comparação continuará permitindo adicionar, editar, remover, filtrar, ordenar por lucro, salvar cenários e exportar CSV. Histórico terá sua própria tela, com restauração, remoção e exportação. Os cálculos e chaves de localStorage existentes serão preservados.

Agenda pessoal, medicamentos, leitura e Pomodoro serão removidos. A pasta pesquisa-passagens, já existente e não rastreada pelo Git, permanecerá intacta.

Visual: superfícies claras, azul como cor principal, tipografia Manrope, bordas discretas, ícones vetoriais e espaços consistentes. O tema escuro continuará disponível e respeitará a preferência salva. Formulários terão rótulos persistentes, foco visível, resultados com estado vazio e layout sem rolagem horizontal no celular.

Validação: conferir navegação, cálculo conhecido, adição e edição no comparador, filtros, histórico, CSV, ferramentas secundárias, links de orçamento e persistência após recarregar. Executar TypeScript, ESLint nos arquivos da aplicação e build de produção. O lint global tem erros preexistentes de require() nos arquivos CJS da pasta pesquisa-passagens.
