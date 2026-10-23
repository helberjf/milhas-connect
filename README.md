# Calculadora de Milhas

Aplicação web em Next.js para operação de venda de passagens emitidas com milhas.

O projeto permite comparar múltiplas emissões, calcular custo das milhas, custo total, lucro bruto, comissão, lucro líquido, margens, venda mínima, aplicar filtros, salvar snapshots locais e exportar dados em CSV.

## Principais funcionalidades

- edição do valor do milheiro por companhia aérea
- múltiplas opções de emissão com comparação automática
- ranking ordenado por maior lucro líquido
- destaque visual para a melhor opção atual
- filtros por companhia, nome e status financeiro
- calculadora rápida separada do comparador
- histórico local com snapshots restauráveis
- exportação de opções atuais para CSV
- exportação do histórico para CSV
- persistência automática em `localStorage`
- restauração de dados padrão
- limpeza de todas as opções
- fórmulas exibidas na interface

## Tecnologias usadas

- Next.js `16.2.2`
- React `19.2.4`
- TypeScript
- App Router
- Tailwind CSS `4`

## Estrutura de pastas

```text
calculadora-milhas/
├─ app/
│  ├─ favicon.ico
│  ├─ globals.css
│  ├─ layout.tsx
│  └─ page.tsx
├─ components/
│  ├─ action-bar.tsx
│  ├─ empty-state.tsx
│  ├─ filter-bar.tsx
│  ├─ formula-section.tsx
│  ├─ history-section.tsx
│  ├─ milheiro-form.tsx
│  ├─ option-form-card.tsx
│  ├─ options-list.tsx
│  ├─ page-header.tsx
│  ├─ quick-calculator.tsx
│  ├─ ranking-list.tsx
│  └─ summary-cards.tsx
├─ lib/
│  ├─ calculations.ts
│  ├─ constants.ts
│  ├─ csv.ts
│  ├─ defaults.ts
│  ├─ filters.ts
│  ├─ formatters.ts
│  └─ storage.ts
├─ types/
│  └─ index.ts
├─ .gitignore
├─ eslint.config.mjs
├─ next-env.d.ts
├─ next.config.ts
├─ package-lock.json
├─ package.json
├─ postcss.config.mjs
├─ README.md
└─ tsconfig.json
```

## Como instalar

```bash
npm install
```

## Como rodar

```bash
npm run dev
```

Abra `http://localhost:3000`.

## Persistência local

O projeto salva automaticamente no `localStorage`:

- valores dos milheiros
- opções de emissão
- calculadora rápida
- filtros
- histórico de snapshots

Ao abrir a aplicação, os dados salvos são recarregados. Se não houver dados prévios, a interface inicia com os valores padrão do projeto.

## Exportação CSV

A exportação é feita no front-end, sem bibliotecas externas, usando `Blob` e download automático.

### Exportação de opções

O CSV das opções inclui:

- nome
- companhia
- milhas
- valor do milheiro
- custo das milhas
- taxa
- custo total
- venda
- tipo de comissão
- comissão informada
- comissão em reais
- lucro bruto
- lucro líquido
- margem bruta
- margem líquida
- venda mínima

### Exportação de histórico

O CSV do histórico inclui:

- id do snapshot
- nome do snapshot
- data/hora
- quantidade de opções
- melhor opção
- lucro líquido total
- margem líquida média

## Fórmulas usadas

- `custo das milhas = (milhas / 1000) * valor do milheiro`
- `custo total = custo das milhas + taxa`
- `lucro bruto = venda - custo total`
- `comissão em reais`
  - `fixed`: valor informado
  - `percent`: `(venda * percentual) / 100`
- `lucro líquido = lucro bruto - comissão em reais`
- `margem bruta = (lucro bruto / venda) * 100`, quando `venda > 0`
- `margem líquida = (lucro líquido / venda) * 100`, quando `venda > 0`
- `venda mínima = custo total`

## Dados iniciais

### Milheiros

- `smiles = 16`
- `latam = 26`
- `azul = 18`
- `outro = 0`

### Opções iniciais

1. `Opção 1`
   - companhia: `smiles`
   - milhas: `46000`
   - taxa: `0`
   - venda: `800`
   - comissão: fixa `0`

2. `Opção 2`
   - companhia: `smiles`
   - milhas: `8280`
   - taxa: `690`
   - venda: `800`
   - comissão: fixa `0`

3. `Opção 3`
   - companhia: `latam`
   - milhas: `24183`
   - taxa: `50`
   - venda: `800`
   - comissão: fixa `0`

### Calculadora rápida

- companhia: `latam`
- milhas: `0`
- taxa: `0`
- venda: `0`
- comissão: fixa `0`

## Pesquisa de passagens com pontos

A ferramenta local completa está em [pesquisa-passagens](pesquisa-passagens/README.md). Abra `pesquisa-passagens/Iniciar Milhas.cmd` para usar o formulário, gerar o roteiro para o ChatGPT e consultar o relatório. A ferramenta usa os valores por milheiro informados no formulário para estimar o custo dos resgates em reais. Consulte a documentação da subpasta para atualizar as cotações, registrar novas pesquisas e gerar novamente o relatório. A execução local não exige publicar alterações na calculadora.

## Melhorias futuras

- agrupamento de histórico por cliente ou rota
- exportação PDF
- cenários com ida e volta separadas
- importação CSV
- autenticação e sincronização em nuvem
