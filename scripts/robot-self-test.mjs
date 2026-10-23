import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { DATA_DIR, checkPrerequisites, protectDataDirectory, writePrivateJson } from '../robot/config.mjs';
import { buildInvocation, runOwnedProcess } from '../robot/executor.mjs';
import { RESULT_SCHEMA } from '../robot/contract.mjs';

// Never loads worker configuration or enqueues a job. --browser explicitly checks
// a blank page in the dedicated profile; the default does not open a browser.
let workspace;
try {
  await protectDataDirectory();
  const prerequisites = await checkPrerequisites({});
  workspace = await mkdtemp(path.join(os.tmpdir(), 'milhas-connect-self-test-'));
  const directory = path.join(DATA_DIR, 'self-test'); await mkdir(directory, { recursive: true, mode: 0o700 });
  const schemaPath = path.join(directory, 'result.schema.json'); const outputPath = path.join(directory, 'result.json');
  await rm(outputPath, { force: true });
  await writePrivateJson(schemaPath, RESULT_SCHEMA);
  const invocation = buildInvocation({ ...prerequisites, workspace, schemaPath, outputPath,
    profilePath: path.join(DATA_DIR, 'chrome-profile'), artifactsPath: path.join(directory, 'browser') });
  const expected = { summary: 'Teste de infraestrutura sem pesquisa de tarifas.', offers: [], coverage: [], attention: [] };
  const browser = process.argv.includes('--browser');
  const instruction = browser ? 'Use browser_snapshot uma vez na página atual do perfil exclusivo. Não navegue, não pesquise voos nem preencha dados. Depois retorne o JSON solicitado.' : 'Não use ferramentas. Não navegue, não abra navegador e não pesquise voos.';
  const execution = await runOwnedProcess(invocation, `Teste controlado de infraestrutura. ${instruction} Retorne exatamente este JSON no esquema fornecido: ${JSON.stringify(expected)}`, { timeoutMs: 60000 });
  assert.deepEqual(JSON.parse(await readFile(outputPath, 'utf8')), expected);
  if (browser) assert.ok(execution.browserCalls > 0, 'Nenhuma ferramenta do navegador foi executada.');
  console.log(browser ? 'Smoke confirmado: Codex executou uma ferramenta real do navegador dedicado e devolveu JSON estrito. Nenhuma tarifa foi consultada.' : 'Smoke confirmado: Codex autenticado e JSON estrito recebido. O acesso às ferramentas do navegador requer o teste --browser.');
} catch (error) {
  console.error(error.attention ? error.message : 'Smoke falhou: não foi recebido o JSON controlado esperado. Confira configuração/versão do Codex e conexão.');
  process.exitCode = 1;
} finally {
  if (workspace && path.dirname(path.resolve(workspace)) === path.resolve(os.tmpdir()) && path.basename(workspace).startsWith('milhas-connect-self-test-')) await rm(workspace, { recursive: true, force: true }).catch(() => {});
}
