# Armazenamento e autenticação da plataforma

O código deste documento pertence ao projeto separado `milhas-connect`. O robô local acessa a plataforma por HTTPS com uma credencial própria; senhas, cookies e perfis dos programas de viagem continuam no ambiente local do robô.

## Estado persistente

`lib/platform/store.mjs` exporta `createInitialState()`, `MemoryStore`, `FileStore`, `PostgresStore` e `createStore()`.

Todos os stores oferecem `read()` e `transact(mutator)`, ambas assíncronas. Uma leitura devolve uma cópia independente. O callback de uma transação recebe um rascunho, pode ser assíncrono, altera o estado no próprio objeto e devolve o resultado desejado. Uma exceção descarta a alteração. Objetos retidos pelo callback ou retornados por ele não dão acesso ao estado já confirmado.

O estado inicial usa `schemaVersion: 1` e contém configurações de preço do milheiro (`latam: 26`, `smiles: 15`, `azul: 15`), trabalhos, monitores, notificações, identificação e heartbeat do robô, chaves de idempotência e tentativas de autenticação. Nenhuma credencial é incluída nesse estado.

### Produção e Vercel

Configure `DATABASE_URL` ou `POSTGRES_URL` com a conexão Postgres compatível com `@neondatabase/serverless`; `DATABASE_URL` tem prioridade. `createStore()` escolhe `PostgresStore`, com `mode: 'postgres'`. A plataforma não usa armazenamento efêmero quando `VERCEL` está definido ou `NODE_ENV=production`: sem URL do banco, a criação do store falha com uma mensagem de configuração.

A primeira operação cria, se necessário, a tabela `milhas_connect_state`, com `id text PRIMARY KEY`, `version bigint` e `data jsonb`, e insere o documento inicial usando `ON CONFLICT DO NOTHING`. O usuário do banco precisa dessas permissões na inicialização. O identificador fixo do documento é `platform`. Todos os valores são parâmetros SQL.

Cada transação lê o documento e sua versão e grava com `UPDATE ... WHERE version = ...`. Se outra instância gravar primeiro, a transação refaz a leitura e executa novamente o callback. Há no máximo dez tentativas de gravação; depois disso, a operação falha sem sobrescrever a alteração concorrente.

**O callback pode executar mais de uma vez.** Gere identificadores, timestamps e valores aleatórios antes de chamar `transact`, ou aceite explicitamente sua regeneração. Não envie mensagens, consulte companhias, navegue, faça pagamentos ou produza outros efeitos externos dentro dele. Use o resultado da transação confirmada para decidir esses efeitos. Reservas de trabalho, validações de lease e consumo de idempotência devem acontecer no callback para considerar a versão atual do estado.

Falhas de conexão são propagadas e não acionam um fallback local. O store não registra URLs ou credenciais. Os testes usam um limite SQL determinístico para simular conflitos; validar as permissões e a conectividade de um banco real exige uma conexão configurada.

### Desenvolvimento local

Sem URL de banco, `createStore()` usa `FileStore` com `mode: 'local'` em `.platform-data/state.json`, relativo ao diretório atual. `PLATFORM_DATA_FILE` permite escolher outro caminho.

O arquivo é gravado em um temporário no mesmo diretório e substituído por rename somente após a serialização completa. Uma falha do callback ou da serialização preserva o documento anterior. Um JSON inválido já persistido provoca erro em vez de ser substituído pelo estado inicial.

Transações de instâncias que apontam para o mesmo caminho são serializadas dentro de um processo Node. Esse modo serve ao desenvolvimento com um processo; várias instâncias ou processos devem usar Postgres. `MemoryStore`, também com `mode: 'local'`, oferece a mesma interface para testes, com uma fila por instância, sem persistência.

## Credenciais do servidor

Configure as três variáveis somente no servidor, sem prefixo `NEXT_PUBLIC_`:

| Variável | Finalidade |
| --- | --- |
| `PLATFORM_PASSWORD` | Senha de alta entropia do proprietário, usada somente no login. |
| `PLATFORM_SESSION_SECRET` | Chave de assinatura HMAC-SHA256, com pelo menos 32 caracteres. |
| `PLATFORM_WORKER_TOKEN` | Credencial independente do robô, com pelo menos 32 caracteres. |

`isConfigured()` exige as três. Entradas vazias, não textuais ou acima de 8.192 caracteres são rejeitadas. `checkPassword()` e `isWorker()` comparam hashes SHA-256 de tamanho fixo usando `timingSafeEqual`. O robô envia `Authorization: Bearer <credencial>`; a senha do proprietário não substitui essa credencial. A aplicação deve manter valores diferentes para os três segredos.

O cliente recebe apenas um cookie de sessão após o login; as variáveis, a senha e o token do robô nunca devem ser devolvidos pela API ou incluídos em logs. O estado público do painel também deve omitir `authAttempts` e `idempotency`.

### Sessão do proprietário

`createSession(env, now)` gera um token assinado por HMAC-SHA256 com versão fixa, emissão, expiração e nonce criptograficamente aleatório. `verifySession(token, env, now)` valida a assinatura, os tipos e o prazo exato de 12 horas. Tokens futuros, expirados, alterados, malformados ou maiores que 2.048 caracteres falham na validação. Não existe escolha de algoritmo pelo cliente. Alterar a chave de assinatura invalida sessões existentes.

`SESSION_COOKIE_NAME` é `milhas-connect-session`. `sessionCookie(token)` produz um cookie com `Path=/`, `HttpOnly`, `SameSite=Strict` e `Max-Age=43200`; `Secure` é aplicado por padrão em produção. `sessionCookie('', 0)` limpa o cookie. `isOwner(request)` aceita somente um cookie com o nome exato e rejeita duplicatas. Cookies de outros nomes e bearer tokens não autenticam o proprietário.

`sameOrigin(request)` exige que o header `Origin` seja exatamente igual à origem completa da URL da requisição, incluindo protocolo e porta. Origem ausente, `null` ou inválida é rejeitada. A API deve aplicar essa verificação ao login e às mutações autenticadas por cookie. Requisições do robô usam bearer token e não dependem de `Origin`.

Limitação de tentativas de login, políticas de lease, autorização de rotas e filtragem do estado devolvido são responsabilidades da camada de serviço/API. Estes módulos fornecem as primitivas de comparação, assinatura e transação.
