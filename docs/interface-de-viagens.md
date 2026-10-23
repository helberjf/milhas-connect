# Interface de viagens

A tela inicial é a calculadora de emissões. Escolha Smiles, LATAM Pass, Azul ou outro programa, preencha os pontos e as taxas e acompanhe o custo total em tempo real. Os valores do milheiro ficam logo abaixo e são definidos pelo usuário; não representam cotações automáticas.

Expanda **Venda e comissão** para informar o preço ao cliente e calcular lucro e margem. O botão **Adicionar à comparação** leva o cenário para **Comparar emissões**, onde é possível editar, remover, filtrar, exportar CSV e salvar comparações. **Histórico** permite restaurar comparações e exportar os registros salvos.

O menu **Ferramentas de viagem** reúne orçamentos de passagens e consumo de combustível. No celular, a navegação fica no menu hambúrguer. Links antigos de orçamento continuam funcionando com o parâmetro `?orcamento=`. Os endereços `#calculadora`, `#comparar`, `#historico`, `#orcamentos` e `#combustivel` abrem diretamente cada área.

Agenda pessoal, medicamentos, leitura e Pomodoro foram retirados. As chaves de armazenamento dos cálculos, comparações, histórico e tema continuam compatíveis com a versão anterior. Trocar de área mantém os formulários em andamento; recarregar mantém os dados já persistidos pelo aplicativo.

## Verificação

- `npm test`: navegação direta e compatibilidade de links de orçamento. Requer Node.js 22.6 ou posterior para a execução direta de TypeScript.
- `npx eslint app components lib types tests/navigation.test.mjs`: análise dos arquivos da aplicação.
- `npx tsc --noEmit`: tipos.
- `npm run build`: build de produção.

Os fluxos de cálculo, edição, filtro, CSV, salvamento e restauração de histórico, recarga, links de orçamento, navegação por teclado, temas e menu móvel foram conferidos no navegador. O caso de referência usa 10.000 pontos LATAM a R$ 26 por milheiro e R$ 50 de taxas: custo de R$ 310. Com venda de R$ 500 e comissão de 10%, o lucro líquido é R$ 140.
