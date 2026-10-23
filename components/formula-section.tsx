import { Icon } from "@/components/icon";

const formulas = [
  ["Custo dos pontos", "(pontos ÷ 1.000) × valor do milheiro"],
  ["Custo total", "custo dos pontos + taxas e complemento"],
  ["Lucro bruto", "venda − custo total"],
  ["Comissão", "valor fixo ou percentual da venda"],
  ["Lucro líquido", "lucro bruto − comissão"],
  ["Margem líquida", "(lucro líquido ÷ venda) × 100"],
];
export function FormulaSection() {
  return <details className="formula-section">
    <summary><span><Icon name="info" size={16} />Como os valores são calculados?</span><Icon name="chevron" size={15} /></summary>
    <div className="formula-grid">{formulas.map(([title, formula]) => <div key={title}><h3>{title}</h3><p>{formula}</p></div>)}</div>
  </details>;
}
