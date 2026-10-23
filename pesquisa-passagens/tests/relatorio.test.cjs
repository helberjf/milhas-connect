const {test}=require('node:test');
const assert=require('node:assert/strict');
let core={};try{core=require('../relatorio.cjs');}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
const quotes={per1000:{latam:26,smiles:15,azul:15}};
test('calcula milhas e total em reais com a cotação da sessão, incluindo taxas uma única vez',()=>{
  assert.equal(typeof core.valueOffer,'function');
  const latam=core.valueOffer({program:'LATAM Pass',points:13161,cashRequired:48.78,taxesVerified:true},quotes);
  assert.equal(latam.milesCost,342.19);assert.equal(latam.estimatedTotal,390.97);
  assert.equal(core.valueOffer({program:'Smiles',points:34600,cashRequired:48.78,taxesVerified:true},quotes).estimatedTotal,567.78);
  assert.equal(core.valueOffer({program:'Azul Fidelidade',points:43560,cashRequired:88.68,taxesVerified:true},quotes).estimatedTotal,742.08);
  assert.equal(core.valueOffer({program:'Azul Fidelidade',points:41400,cashRequired:88.68,taxesVerified:true},quotes).estimatedTotal,709.68);
});
test('cotação ausente ou taxas pendentes não geram custo total confirmado ou valor zero fictício',()=>{
  assert.equal(typeof core.valueOffer,'function');
  const base={program:'LATAM Pass',points:13161,cashRequired:48.78,taxesVerified:true};
  assert.equal(core.valueOffer(base,{per1000:{}}).estimatedTotal,null);
  assert.equal(core.valueOffer({...base,taxesVerified:false},quotes).estimatedTotal,null);
  assert.equal(core.valueOffer({...base,cashRequired:null},quotes).estimatedTotal,null);
  assert.throws(()=>core.valueOffer({...base,points:-1},quotes),/pontos/i);
  assert.throws(()=>core.valueOffer(base,{per1000:{latam:-26}}),/cotação/i);
});
test('cobertura exige nove combinações válidas; erro, rota ausente ou resultado de outra data não concluem pesquisa',()=>{
  assert.equal(typeof core.getCoverage,'function');
  const report={trip:{destinations:['VCP','GRU','CGH'],departure:'2026-11-12'},programs:['LATAM Pass','Azul Fidelidade','Smiles'],coverage:[]};
  report.coverage=report.programs.flatMap(program=>report.trip.destinations.map(destination=>({program,destination,date:'2026-11-12',state:'no_results'})));
  assert.equal(core.getCoverage(report).complete,true);
  assert.equal(core.getCoverage(report).expected,9);
  report.coverage[0].state='technical_error';assert.equal(core.getCoverage(report).complete,false);
  assert.equal(core.getCoverage(report).pending.length,1);
  report.coverage[0].state='no_results';report.coverage[0].date='2026-11-13';assert.equal(core.getCoverage(report).complete,false);
  report.coverage.shift();assert.equal(core.getCoverage(report).completed,8);
});
test('relatório escapa conteúdo de página e não transforma erro em conclusão',()=>{
  assert.equal(typeof core.renderReport,'function');
  const report={trip:{origin:'JDO',destinations:['VCP'],departure:'2026-11-12',adults:1},programs:['LATAM Pass'],offers:[],coverage:[{program:'LATAM Pass',destination:'VCP',date:'2026-11-12',state:'technical_error',note:'<script>alert(1)</script>'}]};
  const html=core.renderReport(report,quotes);
  assert.match(html,/Pesquisa parcial/);assert.doesNotMatch(html,/<script>alert\(1\)<\/script>/);
  assert.match(html,/&lt;script&gt;/);
});
test('alternativa com cotação ou taxas ausentes nunca aparece com custo zero',()=>{
  const report={trip:{origin:'JDO',destinations:['GRU'],departure:'2026-11-12',adults:1},offers:[],coverage:[],fareAlternative:{program:'LATAM Pass',points:15127,cashRequired:48.78,taxesVerified:true}};
  const withoutQuote=core.renderReport(report,{per1000:{smiles:15,azul:15}});
  assert.doesNotMatch(withoutQuote,/custo estimado de <strong>R\$\s*0,00/);
  assert.match(withoutQuote,/Total não confirmado/);
  report.fareAlternative.taxesVerified=false;
  assert.match(core.renderReport(report,quotes),/Total não confirmado/);
});
test('não soma taxas em moeda estrangeira como se fossem reais',()=>{
  assert.equal(core.valueOffer({program:'LATAM Pass',points:13161,cashRequired:48.78,currency:'USD',taxesVerified:true},quotes).estimatedTotal,null);
});
