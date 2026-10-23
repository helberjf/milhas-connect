"use client";

import { useRef, useState, type FormEvent } from "react";
import { Icon } from "@/components/icon";
import { CABIN_LABEL, localToday, PROGRAM_LABEL, PROGRAMS, validateSearch } from "@/components/connect-model";
import type { SearchInput } from "@/lib/platform/types";

export function ConnectSearchForm({ online, onSubmit, busy }: {
  online: boolean; busy: boolean; onSubmit: (input: Omit<SearchInput, "milePrices">, key: string) => Promise<boolean>;
}) {
  const [input, setInput] = useState<Omit<SearchInput, "milePrices">>({ origin: "", destination: "", alternatives: [], departure: "", returnDate: null, tripType: "roundtrip", adults: 1, cabin: "economy", baggage: "carry_on", flexDays: 0, programs: [...PROGRAMS], notes: "" });
  const [alternatives, setAlternatives] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [today] = useState(localToday);
  const key = useRef<string | null>(null);
  function update(patch: Partial<typeof input>) { key.current = null; setInput((current) => ({ ...current, ...patch })); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const normalized = { ...input, alternatives: [...new Set(alternatives.split(/[,;\s]+/).map((item) => item.trim().toUpperCase()).filter(Boolean))], returnDate: input.tripType === "roundtrip" ? input.returnDate : null };
    const nextErrors = validateSearch(normalized, today);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) { document.getElementById(`search-${Object.keys(nextErrors)[0]}`)?.focus(); return; }
    key.current ??= crypto.randomUUID();
    if (await onSubmit(normalized, key.current)) key.current = null;
  }
  function error(name: string) { return errors[name] ? <small className="cx-field-error" id={`error-${name}`}>{errors[name]}</small> : null; }
  return <div className="cx-search-layout">
    <form className="cx-card cx-search-form" onSubmit={submit} noValidate>
      <div className="cx-card-heading"><span className="cx-icon-tile"><Icon name="search" /></span><div><h2>Para onde vamos?</h2><p>Defina a viagem. Seu robô pesquisa os programas selecionados.</p></div></div>
      <fieldset className="cx-trip-toggle" disabled={busy}><legend className="cx-sr-only">Tipo de viagem</legend><label className={input.tripType === "roundtrip" ? "is-active" : ""}><input type="radio" name="tripType" checked={input.tripType === "roundtrip"} onChange={() => update({ tripType: "roundtrip" })} />Ida e volta</label><label className={input.tripType === "oneway" ? "is-active" : ""}><input type="radio" name="tripType" checked={input.tripType === "oneway"} onChange={() => update({ tripType: "oneway" })} />Somente ida</label></fieldset>
      <div className="cx-form-grid">
        <label className="cx-field">Origem <span className="cx-airport-input"><Icon name="plane" size={17} /><input id="search-origin" placeholder="GRU" value={input.origin} onChange={(event) => update({ origin: event.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) })} maxLength={3} autoComplete="off" required aria-invalid={Boolean(errors.origin)} aria-describedby={errors.origin ? "error-origin" : undefined} /></span><small>Código do aeroporto · ex.: GRU</small>{error("origin")}</label>
        <label className="cx-field">Destino <span className="cx-airport-input"><Icon name="plane" size={17} /><input id="search-destination" placeholder="LIS" value={input.destination} onChange={(event) => update({ destination: event.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) })} maxLength={3} autoComplete="off" required aria-invalid={Boolean(errors.destination)} aria-describedby={errors.destination ? "error-destination" : undefined} /></span><small>Código do aeroporto · ex.: LIS</small>{error("destination")}</label>
        <label className="cx-field">Ida<input id="search-departure" type="date" min={today} value={input.departure} onChange={(event) => update({ departure: event.target.value })} required aria-invalid={Boolean(errors.departure)} aria-describedby={errors.departure ? "error-departure" : undefined} />{error("departure")}</label>
        <label className="cx-field">Volta<input id="search-returnDate" type="date" min={input.departure || today} value={input.returnDate ?? ""} onChange={(event) => update({ returnDate: event.target.value || null })} disabled={input.tripType === "oneway"} required={input.tripType === "roundtrip"} aria-invalid={Boolean(errors.returnDate)} aria-describedby={errors.returnDate ? "error-returnDate" : undefined} />{error("returnDate")}</label>
        <label className="cx-field">Passageiros adultos<select id="search-adults" value={input.adults} onChange={(event) => update({ adults: Number(event.target.value) })}>{Array.from({ length: 9 }, (_, index) => <option key={index} value={index + 1}>{index + 1} {index === 0 ? "adulto" : "adultos"}</option>)}</select>{error("adults")}</label>
        <label className="cx-field">Cabine<select value={input.cabin} onChange={(event) => update({ cabin: event.target.value as SearchInput["cabin"] })}>{Object.entries(CABIN_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="cx-field">Bagagem<select value={input.baggage} onChange={(event) => update({ baggage: event.target.value as SearchInput["baggage"] })}><option value="carry_on">Bagagem de mão</option><option value="checked_23kg">Despachada · 23 kg</option></select></label>
        <label className="cx-field">Flexibilidade<select value={input.flexDays} onChange={(event) => update({ flexDays: Number(event.target.value) })}><option value={0}>Datas exatas</option><option value={1}>Até 1 dia antes ou depois</option><option value={2}>Até 2 dias antes ou depois</option><option value={3}>Até 3 dias antes ou depois</option></select></label>
      </div>
      <fieldset className="cx-program-fieldset"><legend>Programas para pesquisar</legend><div className="cx-program-picker">{PROGRAMS.map((program) => <label key={program} className={input.programs.includes(program) ? "is-selected" : ""}><input id={program === "latam" ? "search-programs" : undefined} type="checkbox" checked={input.programs.includes(program)} onChange={(event) => update({ programs: event.target.checked ? [...input.programs, program] : input.programs.filter((item) => item !== program) })} /><span className={`cx-program-dot ${program}`} />{PROGRAM_LABEL[program]}</label>)}</div>{error("programs")}</fieldset>
      <details className="cx-advanced"><summary>Mais opções <Icon name="chevron" size={15} /></summary><div className="cx-form-grid"><label className="cx-field cx-full">Destinos alternativos<input id="search-alternatives" value={alternatives} placeholder="OPO, MAD" onChange={(event) => { key.current = null; setAlternatives(event.target.value.toUpperCase()); }} aria-invalid={Boolean(errors.alternatives)} aria-describedby={errors.alternatives ? "error-alternatives" : undefined} /><small>Até 4 aeroportos adicionais, separados por vírgula.</small>{error("alternatives")}</label><label className="cx-field cx-full">Observações<textarea value={input.notes} onChange={(event) => update({ notes: event.target.value })} rows={3} maxLength={1500} placeholder="Preferências de horários, conexões ou elegibilidade…" /><small>Informe apenas preferências. Nunca inclua senhas ou dados pessoais.</small></label></div></details>
      <div className="cx-form-footer"><span><Icon name="shield" size={16} />Somente pesquisa. Sem emissão automática.</span><button className="cx-button cx-primary" disabled={busy} type="submit"><Icon name={busy ? "clock" : "search"} size={17} />{busy ? "Adicionando…" : "Adicionar à fila"}<Icon name="arrow" size={17} /></button></div>
    </form>
    <aside className="cx-search-aside"><div className="cx-card cx-explain-card"><span className="cx-kicker">DO PEDIDO À MELHOR ESCOLHA</span><h3>A pesquisa começa aqui.</h3><ol className="cx-steps"><li><span>1</span><div><strong>Envie sua rota</strong><p>O pedido fica salvo na fila do site.</p></div></li><li><span>2</span><div><strong>Seu robô entra em ação</strong><p>Com o computador ligado, o auxiliar consulta os programas.</p></div></li><li><span>3</span><div><strong>Compare e faça a cotação</strong><p>As ofertas retornam com fonte, taxas e condições.</p></div></li></ol><div className={`cx-inline-status ${online ? "is-online" : ""}`}><span className="cx-status-dot" />{online ? "Robô conectado e pronto" : "Robô offline · pedidos ficam na fila"}</div></div><div className="cx-soft-note"><Icon name="info" size={19} /><p>Milhas e taxas representam o <strong>total de todos os passageiros e trechos</strong> da pesquisa. A disponibilidade pode mudar.</p></div></aside>
  </div>;
}

