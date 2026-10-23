"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { bestOffer, CABIN_LABEL, date, dateTime, money, number, offerCost, PROGRAM_LABEL, safeSource, STATUS_LABEL, type PriceMode, type SelectedOffer } from "@/components/connect-model";
import type { MilePrices, Offer, ResearchJob } from "@/lib/platform/types";

export function ConnectEmpty({ icon = "search", title, description, action }: { icon?: "search" | "compare" | "bell" | "receipt" | "calculator"; title: string; description: string; action?: React.ReactNode }) {
  return <div className="cx-empty"><span className="cx-empty-icon"><Icon name={icon} size={29} /></span><h3>{title}</h3><p>{description}</p>{action}</div>;
}
export function ConnectStatus({ job }: { job: Pick<ResearchJob, "status"> }) {
  return <span className={`cx-badge cx-state-${job.status}`}><span />{STATUS_LABEL[job.status]}</span>;
}
export function ConnectPriceMode({ value, onChange }: { value: PriceMode; onChange: (value: PriceMode) => void }) {
  return <label className="cx-price-selector">Calcular com<select value={value} onChange={(event) => onChange(event.target.value as PriceMode)}><option value="snapshot">Milheiros da pesquisa</option><option value="current">Milheiros atuais</option></select></label>;
}
export function ConnectOfferCard({ job, offer, prices, best, compared, onCompare, onSelect, onQuote, onRemove }: {
  job: ResearchJob; offer: Offer; prices: MilePrices; best?: boolean; compared?: boolean;
  onCompare?: () => void; onSelect: () => void; onQuote: () => void; onRemove?: () => void;
}) {
  const cost = offerCost(offer, prices);
  const source = safeSource(offer.source);
  return <article className={`cx-card cx-offer ${best ? "cx-offer-best" : ""}`}>
    {best && <div className="cx-best-label"><Icon name="spark" size={14} />Menor custo completo desta seleção</div>}
    <div className="cx-offer-top"><span className="cx-program-label"><span className={`cx-program-dot ${offer.program}`} />{PROGRAM_LABEL[offer.program]}</span><div className="cx-offer-top-right">{offer.operator && <span>{offer.operator}</span>}{onRemove && <button className="cx-icon-button" onClick={onRemove} aria-label={`Remover oferta ${offer.origin} para ${offer.destination} da comparação`}><Icon name="close" size={16} /></button>}</div></div>
    <div className="cx-offer-route"><div><strong>{offer.origin}</strong><span>{date(offer.departure)}</span></div><span className="cx-offer-flight"><i /><Icon name="plane" size={19} /><i /></span><div><strong>{offer.destination}</strong><span>{offer.returnDate ? `Volta ${date(offer.returnDate)}` : "Somente ida"}</span></div></div>
    {(offer.departureTime || offer.arrivalTime) && <p className="cx-flight-times">{offer.departureTime ?? "—"} → {offer.arrivalTime ?? "—"}{offer.durationMinutes !== null && ` · ${Math.floor(offer.durationMinutes / 60)}h ${offer.durationMinutes % 60}min`}</p>}
    <div className="cx-offer-cost"><span>Custo estimado total</span><strong>{cost === null ? "A confirmar" : money(cost)}</strong><small>{number(offer.points)} pontos {offer.cashRequired !== null ? `+ ${offer.currency === "BRL" ? money(offer.cashRequired) : `${offer.currency} ${offer.cashRequired.toLocaleString("pt-BR")}`}` : "+ taxas a confirmar"}</small></div>
    {cost === null && <div className="cx-offer-pending"><Icon name="info" size={15} />{!offer.taxesVerified || offer.cashRequired === null ? "Taxas ainda não verificadas." : offer.currency !== "BRL" ? "Valor em moeda estrangeira. Conversão pendente." : "Defina um milheiro válido para calcular."}</div>}
    <dl className="cx-offer-facts"><div><dt><Icon name="user" size={14} />Passageiros</dt><dd>{job.input.adults} {job.input.adults === 1 ? "adulto" : "adultos"} · {CABIN_LABEL[job.input.cabin]}</dd></div><div><dt><Icon name="suitcase" size={14} />Bagagem</dt><dd>{offer.baggage || "Não informada"}</dd></div><div><dt><Icon name="shield" size={14} />Elegibilidade</dt><dd>{offer.eligibility || "Não informada · confirme no programa"}</dd></div></dl>
    <details className="cx-offer-details"><summary>Fonte e condições <Icon name="chevron" size={14} /></summary><div><p><strong>Verificada em:</strong> {dateTime(offer.checkedAt)}{!offer.checkedAt && " · consulta sem horário confirmado"}</p><p><strong>Voos:</strong> {offer.flights.length ? offer.flights.join(" · ") : "Não informados"}</p><p><strong>Milheiro usado:</strong> {money(prices[offer.program])}/1.000 pontos</p><p><strong>Condições:</strong> {offer.caveat || "Consulte as regras de alteração e cancelamento no programa."}</p>{source ? <a href={source} target="_blank" rel="noopener noreferrer">Abrir fonte oficial <Icon name="external" size={13} /></a> : <p>Fonte oficial indisponível. Confirme antes de cotar.</p>}</div></details>
    <div className="cx-offer-actions"><button className="cx-button cx-secondary" onClick={onSelect}><Icon name="calculator" size={15} />Simular</button><button className="cx-button cx-primary" onClick={onQuote}><Icon name="receipt" size={15} />Cotar</button>{onCompare && <button className={`cx-button cx-compare-add ${compared ? "is-added" : ""}`} onClick={onCompare} disabled={compared}><Icon name={compared ? "check" : "plus"} size={15} />{compared ? "Na comparação" : "Comparar"}</button>}</div>
  </article>;
}
export function ConnectJobDetail({ job, currentPrices, priceMode, onPriceMode, comparedIds, onCompare, onSelect, onQuote, onBack, onAction, busy }: {
  job: ResearchJob; currentPrices: MilePrices; priceMode: PriceMode; onPriceMode: (mode: PriceMode) => void; comparedIds: string[];
  onCompare: (selection: SelectedOffer) => void; onSelect: (selection: SelectedOffer) => void; onQuote: (selection: SelectedOffer) => void; onBack: () => void;
  onAction: (jobId: string, action: "cancel" | "retry") => void; busy: boolean;
}) {
  const prices = priceMode === "current" ? currentPrices : job.input.milePrices;
  const offers = job.result?.offers ?? [];
  const cheapest = bestOffer(offers, prices);
  const [program, setProgram] = useState("all");
  const sorted = offers.filter((offer) => program === "all" || offer.program === program).sort((a, b) => (offerCost(a, prices) ?? Infinity) - (offerCost(b, prices) ?? Infinity));
  const canCancel = job.status === "queued" || job.status === "running";
  const canRetry = ["failed", "partial", "attention_required", "cancelled"].includes(job.status);
  return <div className="cx-stack">
    <button className="cx-back" onClick={onBack}><Icon name="arrow" size={15} />Voltar às pesquisas</button>
    <section className="cx-card cx-detail-heading"><div><div className="cx-inline-heading"><h2>{job.input.origin} <Icon name="arrow" size={22} /> {job.input.destination}</h2><ConnectStatus job={job} /></div><p>{date(job.input.departure)}{job.input.returnDate && ` — ${date(job.input.returnDate)}`} · {job.input.adults} {job.input.adults === 1 ? "adulto" : "adultos"} · {CABIN_LABEL[job.input.cabin]}</p><small>Criada em {dateTime(job.createdAt)} · {job.attempts} {job.attempts === 1 ? "tentativa" : "tentativas"}{job.monitorId && " · pesquisa de monitoramento"}</small></div><div className="cx-actions">{canCancel && <button className="cx-button cx-secondary" disabled={busy} onClick={() => onAction(job.id, "cancel")}>Cancelar pesquisa</button>}{canRetry && <button className="cx-button cx-primary" disabled={busy} onClick={() => onAction(job.id, "retry")}><Icon name="refresh" size={15} />Tentar novamente</button>}</div></section>
    {(job.message || job.result?.summary) && <div className="cx-result-summary"><Icon name={job.status === "attention_required" || job.status === "failed" ? "alert" : "info"} size={19} /><div>{job.result?.summary && <p>{job.result.summary}</p>}{job.message && job.message !== job.result?.summary && <p>{job.message}</p>}</div></div>}
    {!!job.result?.attention.length && <div className="cx-alert cx-alert-warning"><Icon name="alert" size={20} /><div><strong>Ação necessária no computador</strong><ul>{job.result.attention.map((item, index) => <li key={index}>{item}</li>)}</ul></div></div>}
    <div className="cx-section-toolbar"><div><h2>Ofertas encontradas <span>{offers.length}</span></h2><p>Valores totais para os passageiros e trechos da pesquisa.</p></div><div className="cx-toolbar-controls"><label className="cx-sr-only" htmlFor="offer-program">Filtrar programa</label><select id="offer-program" value={program} onChange={(event) => setProgram(event.target.value)}><option value="all">Todos os programas</option>{job.input.programs.map((item) => <option key={item} value={item}>{PROGRAM_LABEL[item]}</option>)}</select><ConnectPriceMode value={priceMode} onChange={onPriceMode} /></div></div>
    <p className="cx-subtle-line">{priceMode === "snapshot" ? "Milheiros salvos quando a pesquisa entrou na fila." : "Recalculado com seus milheiros atuais. Os pontos e taxas são da consulta original."} As ofertas refletem o horário indicado na fonte.</p>
    {sorted.length ? <div className="cx-offer-grid">{sorted.map((offer) => <ConnectOfferCard key={offer.id} job={job} offer={offer} prices={prices} best={offer.id === cheapest?.id} compared={comparedIds.includes(`${job.id}:${offer.id}`)} onCompare={() => onCompare({ job, offer })} onSelect={() => onSelect({ job, offer })} onQuote={() => onQuote({ job, offer })} />)}</div> : <div className="cx-card"><ConnectEmpty icon="search" title={job.status === "queued" ? "Sua pesquisa está na fila" : job.status === "running" ? "O robô está pesquisando" : program !== "all" ? "Sem ofertas neste programa" : "Nenhuma oferta disponível"} description={job.status === "queued" ? "O auxiliar iniciará a consulta quando estiver conectado e livre. Você pode acompanhar o andamento aqui." : job.status === "running" ? "Os resultados aparecerão após o envio do robô. A página acompanha o andamento automaticamente." : "Confira a cobertura abaixo para distinguir ausência de disponibilidade de uma consulta não concluída."} /></div>}
    {!!job.result?.coverage.length && <section className="cx-card cx-coverage"><div className="cx-card-heading"><div><h2>Cobertura da pesquisa</h2><p>O que foi consultado em cada programa, aeroporto e data.</p></div></div><div className="cx-table-wrap"><table><thead><tr><th>Programa / rota</th><th>Datas</th><th>Situação</th><th>Verificação</th></tr></thead><tbody>{job.result.coverage.map((item, index) => <tr key={`${item.program}:${item.destination}:${item.departure}:${index}`}><td><strong>{PROGRAM_LABEL[item.program]}</strong><span>{item.origin} → {item.destination}</span></td><td>{date(item.departure)}{item.returnDate && <span>Volta {date(item.returnDate)}</span>}</td><td><span className={`cx-coverage-state ${item.state}`}>{({ observed: "Consultado", no_results: "Sem disponibilidade", technical_error: "Erro técnico", attention_required: "Intervenção necessária", not_completed: "Não concluído" })[item.state]}</span>{item.note && <span>{item.note}</span>}</td><td>{dateTime(item.checkedAt)}{safeSource(item.source) && <a href={safeSource(item.source)!} target="_blank" rel="noopener noreferrer">Fonte oficial <Icon name="external" size={12} /></a>}</td></tr>)}</tbody></table></div></section>}
  </div>;
}
