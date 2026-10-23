# Travel interface implementation plan

**Goal:** Simplificar o site existente para cálculo de milhas e ferramentas relacionadas a viagens.

**Architecture:** Manter cálculos e persistência em lib e centralizar o estado no componente Home existente. Componentes pequenos cuidam da navegação, formulário, resultados, comparação e histórico. Ferramentas secundárias ficam fora da tela inicial.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind 4, CSS e SVG.

- [ ] Registrar o estado inicial e verificar que o site atual não possui a navegação proposta.
- [ ] Criar navegação responsiva e sistema visual em components/travel-navigation.tsx, components/icon.tsx e app/globals.css. Adotar botões reais, aria-expanded no menu e fechamento com Escape e clique fora.
- [ ] Reorganizar components/quick-calculator.tsx, components/milheiro-form.tsx e components/direct-compare.tsx para oferecer cálculo ao vivo, uma única configuração do milheiro e comparação editável.
- [ ] Reorganizar app/page.tsx, components/action-bar.tsx, components/filter-bar.tsx e components/history-section.tsx, preservando as funções de cálculo e storage. Navegação deve manter os dados de formulários e detectar links de orçamento.
- [ ] Remover os quatro componentes pessoais e adaptar rótulos das ferramentas de viagens. Atualizar README.
- [ ] Verificar no navegador: 10.000 pontos LATAM a R$ 26 + R$ 50 de taxas = R$ 310; venda de R$ 500 e comissão de 10% = R$ 140 de lucro. Adicionar ao comparador, editar, filtrar, salvar e restaurar histórico; conferir persistência e dropdown.
- [ ] Executar npx tsc --noEmit, npx eslint app components lib types e npm run build. Revisar o diff e verificar layout nos tamanhos disponíveis no navegador.
