import { Icon } from "@/components/icon";
import { COMPANY_OPTIONS } from "@/lib/constants";
import { formatBRL, formatMiles, formatPercent } from "@/lib/formatters";
import type { CalculatedFlightOption, CommissionType, CompanyKey, FlightOption } from "@/types";

type Props = {
  options: CalculatedFlightOption[]; isFiltered: boolean;
  onNew: () => void; onClearFilters: () => void;
  onUpdate: (id: string, patch: Partial<FlightOption>) => void;
  onRemove: (id: string) => void;
};

const numberFields = [
  { key: "miles", label: "Pontos", step: "1" },
  { key: "cashAmount", label: "Taxas (R$)", step: "0.01" },
  { key: "saleAmount", label: "Venda (R$)", step: "0.01" },
  { key: "commissionValue", label: "Comissão", step: "0.01" },
] as const;

export function DirectCompare({ options, isFiltered, onNew, onClearFilters, onUpdate, onRemove }: Props) {
  function numeric(value: string) { const number = Number(value.replace(",", ".")); return Number.isFinite(number) ? Math.max(0, number) : 0; }
  if (!options.length) return <section className="panel empty-workspace">
    <span className="empty-illustration"><Icon name={isFiltered ? "filter" : "compare"} size={31} /></span>
    <h2>{isFiltered ? "Nenhuma emissão com esses filtros." : "Qual será o seu próximo destino?"}</h2>
    <p>{isFiltered ? "Tente outro programa ou limpe os filtros para ver suas emissões." : "Calcule uma emissão e adicione à comparação. Assim fica mais fácil escolher a melhor opção."}</p>
    <button className="button button-primary" onClick={isFiltered ? onClearFilters : onNew}><Icon name={isFiltered ? "filter" : "plus"} size={17} />{isFiltered ? "Limpar filtros" : "Calcular primeira emissão"}</button>
  </section>;
  return <div className="comparison-grid">
    {options.map((option, index) => <article className={`panel comparison-card ${index === 0 ? "best-option" : ""}`} key={option.id}>
      {index === 0 && <div className="best-ribbon"><Icon name="spark" size={14} />Melhor resultado por lucro líquido</div>}
      <div className="comparison-card-header">
        <span className={`company-label ${option.company}`}><i className={`company-dot ${option.company}`} />{option.companyLabel}</span>
        <button className="icon-button danger-icon" onClick={() => onRemove(option.id)} aria-label={`Remover ${option.name}`} title="Remover emissão"><Icon name="trash" size={17} /></button>
      </div>
      <h2>{option.name || "Emissão sem nome"}</h2>
      <p className="option-miles">{formatMiles(option.miles)} pontos <span>+ {formatBRL(option.cashAmount)} em taxas</span></p>
      <div className="comparison-cost"><span>Custo total</span><strong>{formatBRL(option.totalCost)}</strong></div>
      <div className="comparison-metrics"><div><span>Valor de venda</span><strong>{formatBRL(option.saleAmount)}</strong></div><div><span>Lucro líquido</span><strong className={option.netProfit < 0 ? "negative" : "positive"}>{formatBRL(option.netProfit)}</strong></div><div><span>Margem líquida</span><strong>{formatPercent(option.netMargin)}</strong></div></div>
      <details className="edit-emission">
        <summary><Icon name="edit" size={15} />Editar emissão<Icon name="chevron" size={15} /></summary>
        <div className="edit-fields">
          <label className="form-field"><span>Nome da emissão</span><input value={option.name} onChange={(e) => onUpdate(option.id, { name: e.target.value })} /></label>
          <label className="form-field"><span>Programa</span><select value={option.company} onChange={(e) => onUpdate(option.id, { company: e.target.value as CompanyKey })}>{COMPANY_OPTIONS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
          {numberFields.map((field) => <label className="form-field" key={field.key}><span>{field.label}{field.key === "commissionValue" ? option.commissionType === "percent" ? " (%)" : " (R$)" : ""}</span><input type="number" min="0" step={field.step} inputMode={field.step === "1" ? "numeric" : "decimal"} value={option[field.key] || ""} onChange={(e) => onUpdate(option.id, { [field.key]: numeric(e.target.value) })} /></label>)}
          <label className="form-field"><span>Tipo de comissão</span><select value={option.commissionType} onChange={(e) => onUpdate(option.id, { commissionType: e.target.value as CommissionType })}><option value="fixed">Fixa em reais</option><option value="percent">Percentual</option></select></label>
          <dl className="option-details"><div><dt>Custo dos pontos</dt><dd>{formatBRL(option.milesCost)}</dd></div><div><dt>Lucro bruto</dt><dd>{formatBRL(option.grossProfit)}</dd></div><div><dt>Comissão em reais</dt><dd>{formatBRL(option.commissionAmount)}</dd></div><div><dt>Margem bruta</dt><dd>{formatPercent(option.grossMargin)}</dd></div></dl>
        </div>
      </details>
    </article>)}
  </div>;
}
