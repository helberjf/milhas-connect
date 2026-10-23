# Milhas Connect

Plataforma privada de pesquisa de passagens com milhas, separada da calculadora original. O painel Next.js na Vercel mantém a fila e o histórico num banco Neon próprio. O auxiliar neste computador executa pesquisas nos sites oficiais e devolve os resultados por HTTPS.

## Uso

1. Acesse a URL publicada e entre com a senha provisionada. Neste computador, ela está no arquivo local ignorado `.platform-data/Acesso Milhas Connect.md`.
2. Abra **Iniciar Milhas Connect.cmd** e mantenha o computador ligado e conectado.
3. Crie uma pesquisa no site. Acompanhe fila, execução, cobertura e pendências no painel.
4. Compare ofertas, abra a calculadora ou prepare uma cotação. Valores de milheiro são compartilhados; cada pesquisa preserva os preços utilizados na criação.

Login, CAPTCHA e 2FA das companhias exigem intervenção humana. Com o auxiliar parado, `npm run robot:login` abre o perfil Chrome exclusivo. Depois repita a pesquisa. O robô não reserva, emite ou paga. Tarifas ausentes e taxas desconhecidas não são inventadas, nem entram como menor custo completo.

Alertas de rotas são verificados enquanto o auxiliar está conectado; avisos aparecem dentro do painel. Não há envio de email/WhatsApp. Comparações selecionadas ficam neste navegador; pesquisas, monitores e milheiros ficam no banco.

## Desenvolvimento

Requisitos: Node.js 22+, Chrome e Codex CLI autenticado na conta ChatGPT. Instale com `npm ci`, configure o ambiente e execute `npm run dev`.

Variáveis privadas do servidor:

- `DATABASE_URL`: banco PostgreSQL Neon independente.
- `PLATFORM_PASSWORD`: senha forte do painel.
- `PLATFORM_SESSION_SECRET`: segredo aleatório de pelo menos 32 caracteres.
- `PLATFORM_WORKER_TOKEN`: token aleatório de pelo menos 32 caracteres, diferente da senha.

Não use prefixo `NEXT_PUBLIC_` para esses valores. Produção exige banco durável; não existe fallback para arquivos temporários da Vercel. Em desenvolvimento sem banco, os dados ficam em `.platform-data/state.json`.

Comandos: `npm test`, `npm run lint`, `npm run build`, `npm run robot:setup`, `npm run robot:status`, `npm run robot:start`, `npm run robot:login`. O teste opcional `npm run robot:self-test` usa uma pequena chamada real ao Codex, sem abrir sites.

## Publicação e isolamento

Este repositório tem projeto Vercel, banco e credenciais próprios. O projeto original `travel-points-calculate` permanece independente. A conta CLI deste projeto fica em `.vercel-cli`, ignorada pelo Git; use `--global-config .vercel-cli --scope helberjfs-projects` ao operar a Vercel localmente.

A configuração do robô e seu perfil ficam em `.robot-data`, com proteção de acesso do usuário. Nunca envie essa pasta, `.platform-data`, `.env*` ou `.vercel-cli` ao Git. Segredos usados pelo auxiliar não são passados ao pesquisador do Codex. O uso depende das cotas dos serviços e da conta Codex.

Detalhes: [robô local](docs/robo-local.md), [protocolo HTTP](docs/protocolo-robo.md), [armazenamento e autenticação](docs/storage-auth.md), [painel](docs/painel.md).
