import { COMPANY_OPTIONS, PROFITABILITY_OPTIONS } from "@/lib/constants";
import type { FilterState } from "@/types";
import { Icon } from "@/components/icon";

export function FilterBar({ filters, visibleCount, totalCount, onChange }: {
  filters: FilterState; visibleCount: number; totalCount: number; onChange: (patch: Partial<FilterState>) => void;
}) {
  return <details className="panel filter-panel">
    <summary><span><Icon name="filter" size={17} />Filtrar emissões</span><span className="filter-count">{visibleCount} de {totalCount}<Icon name="chevron" size={16} /></span></summary>
    <div className="filter-fields">
      <label className="form-field"><span>Programa de fidelidade</span><select value={filters.company} onChange={(e) => onChange({ company: e.target.value as FilterState["company"] })}><option value="all">Todos os programas</option>{COMPANY_OPTIONS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
      <label className="form-field"><span>Buscar emissão</span><input type="search" placeholder="Nome ou destino" value={filters.search} onChange={(e) => onChange({ search: e.target.value })} /></label>
      <label className="form-field"><span>Resultado financeiro</span><select value={filters.profitability} onChange={(e) => onChange({ profitability: e.target.value as FilterState["profitability"] })}>{PROFITABILITY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
    </div>
  </details>;
}
