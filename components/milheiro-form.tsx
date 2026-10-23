import { COMPANY_OPTIONS } from "@/lib/constants";
import type { CompanyKey, MilePrices } from "@/types";
import { Icon } from "@/components/icon";

export function MilheiroForm({ milePrices, onChange }: {
  milePrices: MilePrices; onChange: (company: CompanyKey, value: string) => void;
}) {
  return <section className="panel mile-prices" aria-labelledby="mile-prices-title">
    <div className="mile-prices-intro">
      <span className="soft-icon"><Icon name="wallet" /></span>
      <div><h2 id="mile-prices-title">Seus valores do milheiro</h2><p>Custo a cada 1.000 pontos. Edite quando precisar.</p></div>
    </div>
    <div className="mile-prices-grid">
      {COMPANY_OPTIONS.map((company) => <label className="mile-price" key={company.key}>
        <span><i className={`company-dot ${company.key}`} />{company.label}</span>
        <div className="mile-price-input"><span>R$</span><input aria-label={`Valor do milheiro ${company.label}`} type="number" min="0" step="0.01" inputMode="decimal" value={milePrices[company.key] || ""} placeholder="0,00" onChange={(event) => onChange(company.key, event.target.value)} /></div>
      </label>)}
    </div>
    <p className="field-note"><Icon name="info" size={14} />Valores de custo informados por você, sem cotação automática.</p>
  </section>;
}
