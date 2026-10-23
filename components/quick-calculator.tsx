import { useState } from "react";
import { Icon } from "@/components/icon";
import { COMPANY_OPTIONS } from "@/lib/constants";
import { formatBRL, formatMiles, formatPercent } from "@/lib/formatters";
import type { CalculatedFlightOption, CommissionType, CompanyKey, QuickCalculatorState } from "@/types";

type Props = {
  value: QuickCalculatorState; result: CalculatedFlightOption; name: string;
  onNameChange: (name: string) => void;
  onCompanyChange: (company: CompanyKey) => void;
  onNumberChange: (field: "miles" | "cashAmount" | "saleAmount" | "commissionValue", value: string) => void;
  onCommissionTypeChange: (value: CommissionType) => void;
  onAddToCompare: () => void; canAdd: boolean;
};

export function QuickCalculator({ value, result, name, onNameChange, onCompanyChange, onNumberChange, onCommissionTypeChange, onAddToCompare, canAdd }: Props) {
  const [showSale, setShowSale] = useState(value.saleAmount > 0 || value.commissionValue > 0);
  const hasValues = value.miles > 0 || value.cashAmount > 0;
  const hasSale = value.saleAmount > 0;
  return <div className="calculator-layout">
    <section className="panel calculator-panel" aria-labelledby="calculator-title">
      <div className="panel-heading">
        <div className="heading-with-icon"><span className="soft-icon"><Icon name="calculator" /></span><div><h2 id="calculator-title">Calcular uma emissão</h2><p>Preencha os dados. O resultado aparece na hora.</p></div></div>
        <span className="subtle-badge"><span />Ao vivo</span>
      </div>
      <div className="calculator-form">
        <fieldset className="program-fieldset">
          <legend>Programa de fidelidade</legend>
          <div className="program-options">
            {COMPANY_OPTIONS.map((company) => <label className={`program-option ${value.company === company.key ? "selected" : ""}`} key={company.key}>
              <input type="radio" name="loyalty-program" value={company.key} checked={value.company === company.key} onChange={() => onCompanyChange(company.key)} />
              <span className={`program-mark ${company.key}`} aria-hidden="true">{company.key === "smiles" ? "s" : company.key === "latam" ? "L" : company.key === "azul" ? "a" : <Icon name="plane" size={15} />}</span>
              <span>{company.key === "smiles" ? "Smiles" : company.key === "latam" ? "LATAM Pass" : company.key === "azul" ? "Azul" : "Outro"}</span>
              {value.company === company.key && <Icon name="check" size={13} className="program-check" />}
            </label>)}
          </div>
        </fieldset>
        <div className="form-grid">
          <label className="form-field"><span>Quantidade de pontos</span>
            <div className="input-affix suffix"><input type="number" min="0" step="1" inputMode="numeric" placeholder="Ex.: 25.000" value={value.miles || ""} onChange={(e) => onNumberChange("miles", e.target.value)} /><span>pts</span></div>
            <small>Pontos necessários para emitir a passagem.</small>
          </label>
          <label className="form-field"><span>Taxas e complemento</span>
            <div className="input-affix"><span>R$</span><input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0,00" value={value.cashAmount || ""} onChange={(e) => onNumberChange("cashAmount", e.target.value)} /></div>
            <small>Taxa de embarque e valor pago em dinheiro.</small>
          </label>
        </div>
        <div className="sale-section">
          <button className="disclosure-button" aria-expanded={showSale} aria-controls="sale-fields" onClick={() => setShowSale(!showSale)}>
            <span><Icon name="receipt" size={17} />Venda e comissão <small>Opcional</small></span><Icon name="chevron" size={17} className={showSale ? "rotate-chevron" : ""} />
          </button>
          <div id="sale-fields" hidden={!showSale} className="sale-fields">
            <p className="section-hint">Vai vender essa passagem? Informe os valores para calcular seu lucro.</p>
            <div className="form-grid">
              <label className="form-field"><span>Valor de venda</span><div className="input-affix"><span>R$</span><input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0,00" value={value.saleAmount || ""} onChange={(e) => onNumberChange("saleAmount", e.target.value)} /></div></label>
              <label className="form-field"><span>Tipo de comissão</span><select value={value.commissionType} onChange={(e) => onCommissionTypeChange(e.target.value as CommissionType)}><option value="fixed">Valor fixo em reais</option><option value="percent">Percentual da venda</option></select></label>
              <label className="form-field"><span>Comissão {value.commissionType === "percent" ? "(%)" : "(R$)"}</span><input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0,00" value={value.commissionValue || ""} onChange={(e) => onNumberChange("commissionValue", e.target.value)} /></label>
            </div>
          </div>
        </div>
        <label className="form-field emission-name"><span>Nome da emissão <small>Opcional</small></span><input type="text" placeholder="Ex.: São Paulo → Recife · ida" value={name} onChange={(e) => onNameChange(e.target.value)} /></label>
        <div className="calculator-bottom">
          <p><Icon name="compare" size={17} /><span>Salve esta opção para comparar com outras.</span></p>
          <button className="button button-primary" disabled={!canAdd || !hasValues} onClick={onAddToCompare}><Icon name="plus" size={17} />Adicionar à comparação</button>
        </div>
      </div>
    </section>
    <aside className="result-panel" aria-label="Resultado da emissão">
      <div className="result-header"><span className="result-eyebrow">RESUMO DA EMISSÃO</span><Icon name="plane" size={21} /></div>
      <div className="result-total">
        <span>Custo total da emissão</span>
        <output aria-live="polite" aria-atomic="true">{formatBRL(result.totalCost)}</output>
        <p>{hasValues ? `${formatMiles(value.miles)} pontos + ${formatBRL(value.cashAmount)} em taxas` : "Seu próximo destino começa com essa conta."}</p>
      </div>
      <div className="result-breakdown">
        <div><span>Custo dos pontos</span><strong>{formatBRL(result.milesCost)}</strong></div>
        <div><span>Taxas e complemento</span><strong>{formatBRL(value.cashAmount)}</strong></div>
        <div><span>Milheiro utilizado <i className={`company-dot ${value.company}`} /></span><strong>{formatBRL(result.milePrice)}</strong></div>
      </div>
      {hasSale ? <div className="sale-result">
        <div><span>Valor de venda</span><strong>{formatBRL(value.saleAmount)}</strong></div>
        <div><span>Comissão</span><strong>{formatBRL(result.commissionAmount)}</strong></div>
        <div className="net-result"><span>Lucro líquido</span><strong className={result.netProfit < 0 ? "result-loss" : ""}>{formatBRL(result.netProfit)}</strong></div>
        <p>Margem líquida de {formatPercent(result.netMargin)}</p>
        <details className="result-details"><summary>Ver todos os resultados</summary><div><span>Lucro bruto</span><strong>{formatBRL(result.grossProfit)}</strong></div><div><span>Margem bruta</span><strong>{formatPercent(result.grossMargin)}</strong></div><div><span>Custo sem comissão</span><strong>{formatBRL(result.breakevenSale)}</strong></div></details>
      </div> : <div className="result-tip"><Icon name="spark" size={18} /><p>Uma boa emissão começa com o custo real dos seus pontos.</p></div>}
      <div className="result-footnote"><Icon name="check" size={14} />Calculado automaticamente, sem complicação.</div>
    </aside>
  </div>;
}
