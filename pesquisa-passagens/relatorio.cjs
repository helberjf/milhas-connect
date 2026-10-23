const fs=require('node:fs/promises');
const path=require('node:path');
const programKeys={'LATAM Pass':'latam','Azul Fidelidade':'azul','Smiles':'smiles',latam:'latam',azul:'azul',smiles:'smiles'};
const cents=value=>Math.round((value+Number.EPSILON)*100);
const brl=value=>typeof value==='number' && Number.isFinite(value)?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value):'não informado';
const integer=value=>new Intl.NumberFormat('pt-BR').format(value);
const escape=value=>String(value ?? '').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function link(url,label) {
  try{const parsed=new URL(url);if(!['http:','https:'].includes(parsed.protocol))return escape(label);}
  catch{return escape(label);}
  return `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(label)} ↗</a>`;
}
function valueOffer(offer,quotes) {
  if(!Number.isSafeInteger(offer.points) || offer.points<0)throw new Error('Quantidade de pontos inválida.');
  const key=programKeys[offer.program],rate=key?quotes.per1000?.[key]:undefined;
  if(rate!==undefined && (!Number.isFinite(rate) || rate<0))throw new Error('Cotação inválida.');
  const ratePer1000=rate>0?rate:null;
  const milesCost=ratePer1000===null?null:Math.round(offer.points*cents(ratePer1000)/1000)/100;
  const cashValid=typeof offer.cashRequired==='number' && Number.isFinite(offer.cashRequired) && offer.cashRequired>=0 && (offer.currency || 'BRL')==='BRL';
  const estimatedTotal=milesCost===null || !cashValid || offer.taxesVerified!==true?null:(cents(milesCost)+cents(offer.cashRequired))/100;
  return {...offer,ratePer1000,milesCost,estimatedTotal};
}
function getCoverage(report) {
  const programs=report.programs || ['LATAM Pass','Azul Fidelidade','Smiles'];
  const expected=[...new Set(programs)].flatMap(program=>[...new Set(report.trip.destinations)].map(destination=>({program,destination})));
  const rows=expected.map(pair=>{
    const entries=(report.coverage || []).filter(item=>(programKeys[item.program] || item.program)===(programKeys[pair.program] || pair.program) && (item.destinations || [item.destination]).includes(pair.destination) && item.date===report.trip.departure);
    const entry=entries.at(-1);
    return {...pair,...entry,destination:pair.destination,finished:Boolean(entry && ['observed','no_results'].includes(entry.state))};
  });
  const pending=rows.filter(row=>!row.finished);
  return {complete:pending.length===0,expected:expected.length,completed:rows.length-pending.length,pending,rows};
}
function dateTime(value) {
  if(!value || Number.isNaN(Date.parse(value)))return 'horário exato não registrado';
  return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}).format(new Date(value))+' (Brasília)';
}
function cashLabel(offer) {
  if(typeof offer.cashRequired!=='number' || !Number.isFinite(offer.cashRequired))return 'dinheiro não confirmado';
  try{return new Intl.NumberFormat('pt-BR',{style:'currency',currency:offer.currency || 'BRL'}).format(offer.cashRequired);}
  catch{return escape(offer.cashRequired+' '+(offer.currency || 'moeda não informada'));}
}
function offerRow(offer,report) {
  const feeNote=offer.taxBreakdown?Object.entries(offer.taxBreakdown).map(([key,value])=>`${({boarding:'Embarque',redemption:'Resgate'})[key] || key}: ${cashLabel({...offer,cashRequired:value})}`).join(' · '):'';
  return `<tr><td><strong>${escape(offer.program)}</strong>${escape(offer.operator)}<small>${escape(offer.fare)}</small></td>
<td><strong>${escape(offer.destination)} · ${offer.connections?.length?'via '+escape(offer.connections.map(item=>item.airport).join('/')):'direto'}</strong>${escape(offer.flights?.join(' + ') || 'Número não registrado')}<small>${link(offer.source,'Ver fonte')}</small></td>
<td><strong>${escape(offer.departureTime)} → ${escape(offer.arrivalTime)}</strong>${Math.floor(offer.durationMinutes/60)}h${String(offer.durationMinutes%60).padStart(2,'0')}<small>${escape((offer.connections || []).map(item=>`${item.airport}: espera de ${item.minutes} min`).join('; '))}</small></td>
<td><strong>${integer(offer.points)} ${offer.program==='Azul Fidelidade'?'pontos':'milhas'}</strong>+ ${cashLabel(offer)}<small>${escape(feeNote)}</small><small>${escape(offer.baggage)}</small>${offer.taxesVerified!==true?'<small>Taxas não confirmadas</small>':''}</td>
<td>${offer.ratePer1000===null?'Sem cotação':brl(offer.ratePer1000)} / milheiro<small>Milhas: ${offer.milesCost===null?'não calculado':brl(offer.milesCost)}</small><strong class="price">${offer.estimatedTotal===null?'Total não confirmado':brl(offer.estimatedTotal)}</strong></td>
<td>${escape(offer.eligibility)}<small>${escape(offer.caveat || '')}</small><small>${offer.checkedAt?dateTime(offer.checkedAt):'Conferido em '+escape(report.searchedOn || '')+'; minuto não registrado.'}</small></td></tr>`;
}
function renderReport(report,quotes) {
  const coverage=getCoverage(report),trip=report.trip;
  const offers=(report.offers || []).map(offer=>valueOffer(offer,quotes)).sort((a,b)=>(a.estimatedTotal ?? Infinity)-(b.estimatedTotal ?? Infinity));
  const best=offers.find(offer=>offer.estimatedTotal!==null);
  const status={observed:'Oferta observada',no_results:'Sem disponibilidade na consulta',technical_error:'Erro técnico',not_completed:'Consulta não concluída'};
  const rows=offers.filter(offer=>offer.taxesVerified===true).map(offer=>offerRow(offer,report)).join('');
  const incompleteRows=offers.filter(offer=>offer.taxesVerified!==true).map(offer=>offerRow(offer,report)).join('');
  const alternative=report.fareAlternative?valueOffer({...report.fareAlternative,operator:'LATAM Brasil',destination:'GRU'},quotes):null;
  const coverageRows=coverage.rows.map(row=>`<tr><td>${escape(row.program)}</td><td>${escape(trip.origin)} → ${escape(row.destination)}</td><td><strong>${escape(status[row.state] || 'Não consultado')}</strong>${escape(row.note || 'Sem resultado válido registrado.')}<small>${row.checkedAt?dateTime(row.checkedAt):'Conferência registrada em '+escape(report.searchedOn || '')}${row.source?' · '+link(row.source,'Fonte'):''}</small></td></tr>`).join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>JDO → São Paulo · relatório e custo das milhas</title><style>
*{box-sizing:border-box}body{margin:0;background:#f6f5f0;color:#172c2d;font:14px/1.6 system-ui,Segoe UI,sans-serif}main{max-width:1400px;margin:auto;padding:32px 28px 55px}a{color:#245c49;text-underline-offset:3px}.top{display:flex;justify-content:space-between;gap:16px}.brand{font-weight:800;font-size:22px}.badge{font-size:12px;border:1px solid #b0c5b0;border-radius:20px;padding:4px 12px;background:#eaf1e9}h1{font:40px/1.2 Georgia,serif;margin:30px 0 14px}h2{font-size:19px;margin:26px 0 12px}.muted,small{color:#617370}small{display:block;font-size:11px;margin-top:5px}.table-wrap{overflow:auto;border:1px solid #dce2db;border-radius:14px;background:white}table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;padding:15px;border-bottom:1px solid #e6eae2;vertical-align:top}th{background:#eaf1e9;font-size:11px;text-transform:uppercase}tr:last-child td{border-bottom:0}td strong{display:block}.price{color:#245c49;font-size:18px;white-space:nowrap}.note{background:#eaf1e9;border-left:4px solid #245c49;border-radius:8px;padding:16px 20px;margin:18px 0}.pending{background:#fff7eb;border-left-color:#b67a39}.quote-grid{display:flex;gap:18px;flex-wrap:wrap}.quote-grid span{background:#fff;border:1px solid #dce2db;padding:10px 16px;border-radius:8px}.actions{display:flex;gap:20px;flex-wrap:wrap;margin-top:25px}footer{border-top:1px solid #dce2db;margin-top:30px;padding-top:16px;font-size:12px;color:#617370}@media(max-width:600px){main{padding:20px 14px}h1{font-size:31px}td,th{padding:11px}}@media print{body{background:white}main{padding:0}.actions{display:none}.table-wrap{overflow:visible}td,th{padding:8px}}
</style></head><body><main><div class="top"><span class="brand">milhas.</span><span class="badge">${coverage.complete?'Consultas concluídas':'Pesquisa parcial'} · ${coverage.completed}/${coverage.expected}</span></div>
<h1>Juazeiro do Norte → Campinas ou São Paulo</h1><p><strong>${escape(trip.departure.split('-').reverse().join('/'))} · só ida · ${escape(trip.adults)} adulto(s) · econômica</strong><br>Destinos: ${escape(trip.destinations.join(', '))}. Horários locais. Atualização: ${dateTime(report.updatedAt)}.</p>
<h2>Cotações da sua calculadora</h2><div class="quote-grid"><span>LATAM Pass: <strong>${brl(quotes.per1000.latam)} / 1.000</strong></span><span>Smiles: <strong>${brl(quotes.per1000.smiles)} / 1.000</strong></span><span>Azul: <strong>${brl(quotes.per1000.azul)} / 1.000</strong></span></div><p class="muted">${link(quotes.source,'Fonte: sua calculadora')} · Campos visíveis no Chrome em ${dateTime(quotes.capturedAt)}. São valores editáveis da sua sessão; os padrões do repositório não foram usados como substitutos.</p>
<div class="note"><strong>Custo estimado = (milhas ÷ 1.000 × cotação) + dinheiro obrigatório.</strong> Esse valor inclui o custo atribuído aos pontos. Na emissão, o desembolso adicional é apenas o dinheiro indicado na oferta se você já tem o saldo necessário; este cálculo não compra milhas nem garante sua aquisição pela cotação informada.</div>
<h2>Ofertas com pontos e taxas conferidos</h2><div class="table-wrap"><table id="offers"><thead><tr><th>Programa / operadora</th><th>Destino / voos</th><th>Horário / duração</th><th>Resgate + dinheiro</th><th>Custo estimado</th><th>Condição / conferência</th></tr></thead><tbody>${rows || '<tr><td colspan="6">Nenhuma oferta com valores registrados.</td></tr>'}</tbody></table></div>
${best?`<div class="note"><strong>Menor custo estimado entre as ofertas verificadas:</strong> ${escape(best.program)} para ${escape(best.destination)}, ${integer(best.points)} pontos/milhas + ${brl(best.cashRequired)}, equivalente a <strong>${brl(best.estimatedTotal)}</strong> pelas cotações acima. Compare também aeroporto, horário e bagagem.</div>`:''}
${incompleteRows?`<h2>Ofertas com taxas pendentes</h2><div class="table-wrap"><table><tbody>${incompleteRows}</tbody></table></div>`:''}
${alternative?`<p><strong>Com mala despachada de 23 kg:</strong> a LATAM Standard do voo das 03h foi observada por ${integer(alternative.points)} milhas + ${cashLabel(alternative)}, custo estimado: <strong>${alternative.estimatedTotal===null?'Total não confirmado':brl(alternative.estimatedTotal)}</strong>. ${alternative.checkedAt?dateTime(alternative.checkedAt):'Conferida na primeira rodada de 22/10/2026; precisa de reconfirmação antes da emissão.'}</p>`:''}
<h2>Cobertura das consultas</h2><div class="note ${coverage.complete?'':'pending'}">${coverage.complete?`As ${coverage.expected} combinações de programa e destino têm resultado válido registrado para ${escape(trip.departure)}. Não há consultas pendentes nesta cobertura.`:`Foram concluídas ${coverage.completed} de ${coverage.expected} combinações. Faltam: ${escape(coverage.pending.map(row=>row.program+' → '+row.destination).join('; '))}. Erro técnico não é ausência de voos.`}</div><div class="table-wrap"><table id="coverage"><thead><tr><th>Programa</th><th>Rota</th><th>Resultado e evidência</th></tr></thead><tbody>${coverageRows}</tbody></table></div>
<h2>Limites e reprodução</h2><p>Nos sites oficiais, configure só ida, JDO, o destino da linha, 12/11/2026, 1 adulto, econômica e pontos/milhas. Abra a tarifa e o resumo para conferir taxas. Tarifas de clube/titular exigem elegibilidade. Os links podem depender da sessão e os valores podem mudar.</p><ul>${(report.limitations || []).map(note=>`<li>${escape(note)}</li>`).join('')}</ul><div class="actions"><a href="index.html">← Formulário e roteiro</a><a href="resultado-pesquisa.json" download>Dados da pesquisa</a><a href="cotacoes-milhas.json" download>Cotações registradas</a></div><footer>Pesquisa pelo ChatGPT no Chrome. Nenhuma passagem foi reservada ou emitida. Nenhum saldo, credencial ou identificador de conta é publicado.</footer></main></body></html>`;
}
async function generate(directory=__dirname) {
  const report=JSON.parse(await fs.readFile(path.join(directory,'resultado-pesquisa.json'),'utf8'));
  const quotes=JSON.parse(await fs.readFile(path.join(directory,'cotacoes-milhas.json'),'utf8'));
  const coverage=getCoverage(report);
  report.complete=coverage.complete;
  report.valuation={currency:'BRL',quoteSource:quotes.source,quoteCapturedAt:quotes.capturedAt,formula:'(pontos / 1000 * milheiro) + dinheiro obrigatório',offers:report.offers.map(offer=>{const value=valueOffer(offer,quotes);return {program:value.program,destination:value.destination,flights:value.flights,ratePer1000:value.ratePer1000,milesCost:value.milesCost,estimatedTotal:value.estimatedTotal};})};
  await fs.writeFile(path.join(directory,'resultado-pesquisa.json'),JSON.stringify(report,null,2)+'\n','utf8');
  await fs.writeFile(path.join(directory,'relatorio.html'),renderReport(report,quotes),'utf8');
  return coverage;
}
if(require.main===module)generate().then(value=>console.log(JSON.stringify({report:'relatorio.html',completed:value.completed,expected:value.expected,complete:value.complete}))).catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={valueOffer,getCoverage,renderReport,generate};
