# Protocolo Milhas Connect v1

Base: /api/platform. JSON UTF-8, limite de 2.000.000 bytes por solicitação (4.096 bytes no login). Falhas: {error:string}; status HTTP 400, 401, 403, 404, 409, 413, 422, 429 ou 503. API nunca retorna credenciais, hashes ou lease de outro robô. Origin de mutações do painel deve coincidir com o site. Configuração secreta é local/ambiente, nunca Git ou URL.

## Painel

- POST /login {password}: define cookie HttpOnly/SameSite=Strict/Secure em produção; responde {ok:true}.
- POST /logout: limpa sessão.
- GET /session: {authenticated:boolean,configured:boolean}.
- GET /dashboard: Dashboard definido em lib/platform/types.ts.
- POST /jobs: SearchInput sem milePrices (o servidor usa os preços atuais); responde {job:ResearchJob} com HTTP 201. Header Idempotency-Key UUID identifica a solicitação, evitando duplicatas na repetição de rede.
- POST /jobs/:id/cancel e /jobs/:id/retry: {job:ResearchJob}.
- PUT /settings {milePrices:{latam,azul,smiles}}: {settings:{milePrices}}.
- POST /monitors {jobId,targetCost,intervalHours}: {monitor:Monitor}; intervalo de 1 a 168 horas, custo positivo.
- PATCH /monitors/:id {enabled:boolean}: {monitor:Monitor}.
- POST /notifications/read: {ok:true}.

## Robô (Authorization: Bearer WORKER_TOKEN)

- POST /robot/claim {robotId,version}: {job:null,retryAfterSeconds:15} ou {job:ResearchJob,leaseToken:string,retryAfterSeconds:15}. Atualiza heartbeat; cria rodadas de monitores devidas; retoma leases vencidos. Processar no máximo uma tarefa simultaneamente por auxiliar.
- POST /robot/heartbeat {robotId,version,jobId?:string,leaseToken?:string,message?:string}: {ok:true,cancelled:boolean}. Enviar a cada 20 segundos durante execução. Lease de 120 segundos.
- POST /robot/jobs/:id/result {robotId,leaseToken,result:ResearchResult}: {job:ResearchJob}. Repetir após falha de rede com o mesmo lease é idempotente. Ofertas só podem referir-se ao escopo da pesquisa. Campos e limites validados no servidor.
- POST /robot/jobs/:id/error {robotId,leaseToken,message,attention?:boolean}: {job:ResearchJob}. Erro de navegador/consulta nunca vira no_results.

## Semântica

SearchInput, Offer, Coverage e ResearchResult seguem lib/platform/types.ts. As ofertas representam totais para todos os passageiros e trechos solicitados. Conferir origem/destino reais, datas, programa, moeda, bagagem e condição de elegibilidade. Não somar taxas duas vezes. Custo completo somente com points >=0, cashRequired >=0 em BRL, taxesVerified=true e milheiro >0. URLs somente HTTPS nos domínios oficiais dos programas/companhias. Datas de checkedAt podem ser nulas quando ausentes, preservando pendência.

completed exige cobertura válida para todas as combinações de aeroporto/data/programa. partial indica ofertas com cobertura ainda incompleta. attention_required indica login, CAPTCHA ou intervenção indicada. failed é falha técnica sem resultado útil. A leitura do painel não anuncia tarifas históricas como consultas recentes.

O auxiliar não recebe senha do painel nem credenciais do banco. O agente de pesquisa não recebe WORKER_TOKEN. Configuração local contém siteUrl, workerToken, robotId, codexPath opcional, pollSeconds e jobTimeoutMinutes. O worker executa com shell=false; roteiro entra por stdin. Artefatos de execução e perfil do navegador ficam em .robot-data, ignorado no Git. Nunca reservar, emitir, pagar ou contornar CAPTCHA.
