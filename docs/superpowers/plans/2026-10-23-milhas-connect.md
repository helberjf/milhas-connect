# Milhas Connect Implementation Plan

**Goal:** Criar uma plataforma independente na Vercel, conectada a um robô local, preservando a calculadora existente.

**Architecture:** Next.js mantém o painel e uma API autenticada. Serviço de domínio controla fila e resultados usando armazenamento com versão e PostgreSQL. Um processo local consulta a fila, executa Codex com navegador MCP e retorna resultados estruturados. O navegador automatizado usa perfil exclusivo.

**Tech Stack:** Next.js 16, React 19, Node.js 22+, PostgreSQL/Neon, Codex CLI e Playwright MCP.

- [x] Copiar o repositório para milhas-connect e retirar o remote original.
- [x] Definir contratos de pesquisas, resultados e protocolo HTTP em lib/platform/types.ts e docs/protocolo-robo.md.
- [x] Implementar e testar validação, armazenamento, autenticação, leases, cancelamento, repetição de pesquisas e alertas.
- [x] Implementar painel responsivo com pesquisa, estados reais, conexão do robô, ofertas, calculadora compartilhada e propostas.
- [x] Implementar e testar auxiliar local com configuração, polling, heartbeats, execução real via CLI e envio idempotente de resultados.
- [x] Configurar banco independente e projeto Vercel na conta confirmada, sem alterar a aplicação anterior.
- [ ] Verificar testes, lint, tipos, build, fluxos no navegador e a comunicação do auxiliar com o site publicado.
- [ ] Entregar URL, iniciador local, instruções de acesso e limites observados na verificação.
