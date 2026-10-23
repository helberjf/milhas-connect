const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const file = path.join(__dirname, '..', 'index.html');
const html = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
const code = html.match(/<script id="search-core">([\s\S]*?)<\/script>/)?.[1] || '';
const context = vm.createContext({});
vm.runInContext(code, context);
const core = context.PesquisaMilhas || {};
const base = { origin: 'GRU', destination: 'LIS', trip: 'round', departure: '2026-12-10', returnDate: '2026-12-20', flexOut: 0, flexBack: 0, adults: 1, cabin: 'Economica', payment: 'both', currency: 'BRL', companies: ['latam', 'tap'], stops: 'any', baggage: 'Verificar franquia', notes: '' };
test('núcleo disponível para validar e gerar pesquisa', () => {
  assert.equal(typeof core.validate, 'function');
  assert.equal(typeof core.buildPrompt, 'function');
});
test('rejeita origem igual, data inexistente e volta anterior', () => {
  assert.match(core.validate({ ...base, destination: 'GRU' }, '2026-10-22').join(' '), /origem|destino/i);
  assert.match(core.validate({ ...base, departure: '2026-02-30' }, '2026-10-22').join(' '), /data/i);
  assert.match(core.validate({ ...base, returnDate: '2026-12-01' }, '2026-10-22').join(' '), /volta/i);
});
test('rejeita seleção vazia, datas passadas e flexibilidade excessiva', () => {
  assert.ok(core.validate({ ...base, companies: [] }, '2026-10-22').length);
  assert.ok(core.validate({ ...base, departure: '2026-10-01' }, '2026-10-22').length);
  assert.ok(core.validate({ ...base, flexOut: 8 }, '2026-10-22').length);
});
test('ida simples ignora data de volta e aceita aeroportos digitados em minúsculas', () => {
  assert.equal(core.validate({ ...base, origin: 'gru', destination: 'lis', trip: 'oneway', returnDate: '' }, '2026-10-22').length, 0);
});
test('flexibilidade cruza mês e elimina datas passadas', () => {
  assert.deepEqual(Array.from(core.dateRange('2026-11-01', 2, '2026-10-31')), ['2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03']);
});
test('contagem flexível exclui volta anterior à ida', () => {
  assert.equal(core.combinationCount({ ...base, departure: '2026-12-10', returnDate: '2026-12-10', flexOut: 1, flexBack: 1 }, '2026-10-22'), 6);
});
test('roteiro inclui apenas sites selecionados, taxas e limites de ação', () => {
  const prompt = core.buildPrompt(base, '2026-10-22');
  assert.match(prompt, /latamairlines\.com/);
  assert.match(prompt, /flytap\.com/);
  assert.doesNotMatch(prompt, /qatarairways\.com|smiles\.com\.br/);
  assert.match(prompt, /taxas/i);
  assert.match(prompt, /não.*(emitir|reservar|comprar)/i);
  assert.match(prompt, /CAPTCHA/);
  assert.match(prompt, /2026-12-10/);
});
test('comparação não trata moedas de programas diferentes como equivalentes', () => {
  const prompt = core.buildPrompt({ ...base, payment: 'miles', companies: ['iberia', 'qatar'] }, '2026-10-22');
  assert.match(prompt, /Iberia Club/);
  assert.match(prompt, /Privilege Club/);
  assert.match(prompt, /não.*compar.*(programas|milhas)/i);
});
test('roteiro prioriza pontos e separa oferta incompleta de resgate confirmado', () => {
  const prompt=core.buildPrompt({...base,companies:['latam','azul','smiles']},'2026-10-22');
  assert.match(prompt,/PRIMEIRO.*(milhas|pontos)/);
  assert.match(prompt,/taxas não confirmadas/);
  assert.match(prompt,/Smiles & Money.*somente.*Smiles/);
  assert.match(prompt,/não.*(prova|significa).*não opera/i);
  assert.match(prompt,/no máximo 5/);
});
test('aeroportos alternativos são explícitos, únicos e incluídos na cobertura', () => {
  const data={...base,origin:'JDO',destination:'VCP',alternatives:'gru, CGH,GRU',brazilianOnly:true};
  assert.deepEqual(Array.from(core.destinations(data)),['VCP','GRU','CGH']);
  assert.equal(core.validate(data,'2026-10-22').length,0);
  assert.match(core.buildPrompt(data,'2026-10-22'),/VCP, GRU, CGH/);
  assert.match(core.buildPrompt(data,'2026-10-22'),/LATAM Brasil, Azul e GOL/);
  assert.ok(core.validate({...base,alternatives:'GRU'},'2026-10-22').length);
  assert.ok(core.validate({...base,alternatives:'São Paulo'},'2026-10-22').length);
  assert.ok(core.validate({...base,companies:['toString']},'2026-10-22').length);
});
test('roteiro usa cotação informada por programa e exige custo estimado separado do dinheiro da emissão',()=>{
  const prompt=core.buildPrompt({...base,companies:['latam','azul','smiles'],milePrices:{latam:26,smiles:15,azul:15}},'2026-10-22');
  assert.match(prompt,/LATAM Pass: R\$ 26,00/);
  assert.match(prompt,/Smiles: R\$ 15,00/);
  assert.match(prompt,/Azul Fidelidade: R\$ 15,00/);
  assert.match(prompt,/travel-points-calculate\.vercel\.app/);
  assert.match(prompt,/custo estimado/i);
  assert.match(prompt,/não.*(desembolso|dinheiro).*integral/i);
  assert.ok(core.validate({...base,milePrices:{latam:-26}},'2026-10-22').length);
});
test('códigos de cidade expandem origem e chegada, sem ampliar aeroportos individuais',()=>{
  assert.deepEqual(Array.from(core.origins({...base,origin:'sao'})),['GRU','CGH','VCP']);
  assert.deepEqual(Array.from(core.destinations({...base,destination:'rio'})),['GIG','SDU']);
  assert.deepEqual(Array.from(core.origins({...base,origin:'GRU'})),['GRU']);
  assert.deepEqual(Array.from(core.destinations({...base,destination:'gig'})),['GIG']);
  assert.equal(core.locationInfo('rio').type,'city');
  assert.equal(core.locationInfo('rio').name,'Rio de Janeiro');
});
test('expansão deduplica destinos e detecta sobreposição com a origem',()=>{
  const data={...base,origin:'JDO',destination:'SAO',alternatives:'GRU, RIO, SDU'};
  assert.deepEqual(Array.from(core.destinations(data)),['GRU','CGH','VCP','GIG','SDU']);
  assert.equal(core.validate(data,'2026-10-23').length,0);
  assert.ok(core.validate({...base,origin:'SAO',destination:'GRU'},'2026-10-23').length);
  assert.ok(core.validate({...base,origin:'SDU',destination:'RIO'},'2026-10-23').length);
  assert.equal(core.validate({...base,origin:'sao',destination:'rio'},'2026-10-23').length,0);
});
test('escopo conta pares reais de aeroportos e instrui cobertura de cidade por site',()=>{
  const data={...base,origin:'SAO',destination:'RIO',trip:'oneway',flexOut:1};
  const scope=core.searchScope(data,'2026-10-23');
  assert.equal(scope.routeCount,6);
  assert.equal(scope.combinations,18);
  const prompt=core.buildPrompt(data,'2026-10-23');
  assert.match(prompt,/SAO.*São Paulo.*GRU, CGH, VCP/);
  assert.match(prompt,/RIO.*Rio de Janeiro.*GIG, SDU/);
  assert.match(prompt,/18 combinações/);
  assert.match(prompt,/todos os aeroportos/i);
  assert.match(prompt,/pesquisar separadamente/i);
  assert.match(prompt,/não.*(garantir|presumir).*todos/i);
});
test('outros agrupamentos cadastrados e códigos ainda não catalogados continuam utilizáveis',()=>{
  for(const [code,airports] of Object.entries({BHZ:['CNF','PLU'],BUE:['AEP','EZE'],PAR:['CDG','ORY'],TYO:['HND','NRT']}))assert.deepEqual(Array.from(core.destinations({...base,destination:code})),airports);
  assert.deepEqual(Array.from(core.origins({...base,origin:'XYZ'})),['XYZ']);
  assert.equal(core.validate({...base,origin:'XYZ'},'2026-10-23').length,0);
  assert.match(core.buildPrompt({...base,origin:'XYZ'},'2026-10-23'),/não cadastrados.*(cidade|agrupamento)/i);
});
