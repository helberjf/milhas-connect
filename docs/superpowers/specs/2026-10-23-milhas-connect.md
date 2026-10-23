# Milhas Connect — projeto independente

O usuário aprovou uma plataforma com robô executado neste computador, recebendo pesquisas do site e enviando resultados. Solicitou outro projeto na Vercel, mantendo a calculadora existente intacta.

## Separação

Novo diretório e repositório: milhas-connect. Nova identidade e publicação na Vercel. Não modificar, vincular ou publicar o projeto travel-points-calculate. A conta de destino confirmada é helberjf, equipe helberjfs-projects.

## Experiência

Painel privado com nova pesquisa, fila e estados reais, resultados, cálculo e comparação, histórico e estado do robô. Programa, pontos, dinheiro obrigatório, horários, bagagem, fonte e horário da consulta acompanham cada oferta. Valores do milheiro são compartilhados nas configurações. Ofertas sem taxas confirmadas ou referência de milheiro não recebem custo completo nem vencem comparações financeiras. Resultados podem alimentar a calculadora e o orçamento.

Buscas podem ser acompanhadas por um limite de custo e intervalo configurável. O auxiliar local agenda novas rodadas enquanto estiver conectado. Alertas aparecem no painel, associados à pesquisa real; execução offline aguarda reconexão.

## Comunicação e persistência

O site mantém a fila em PostgreSQL independente e autentica o proprietário por senha e cookie assinado. O robô recebe uma credencial própria e faz somente conexões de saída HTTPS. Nenhuma porta deste computador é exposta publicamente. As tarefas têm lease, heartbeat, limite de tentativas, cancelamento e resultados idempotentes. Conflitos de gravação usam versão e atualização condicional no banco. Arquivo local serve apenas ao desenvolvimento; produção exige banco persistente.

O auxiliar usa o Codex CLI já autenticado e Playwright MCP com perfil exclusivo para consultar os sites. Não aproveita automaticamente o navegador do ChatGPT. Login e CAPTCHA interrompem a consulta com estado de atenção, para o usuário resolver. Nunca reservar, emitir ou pagar. Não inventar tarifas ou transformar erro técnico em ausência de voos.

## Entrega e verificação

Criar projeto Vercel novo apenas na conta confirmada, sem contratar planos pagos. Credenciais ficam fora do Git e dos logs. Validar fila concorrente, expiração de lease, autorização, resultados incompletos, cálculo, reconexão, cancelamento e links. Conferir navegador em computador e celular. Executar testes, lint, tipos e build; fazer uma pesquisa de verificação e documentar qualquer intervenção real necessária.

