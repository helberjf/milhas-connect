import { Icon } from "@/components/icon";
import { formatBRL, formatDateTime, formatPercent } from "@/lib/formatters";
import type { HistorySnapshot } from "@/types";

export function HistorySection({ history, onRestore, onRemove, onExport, onNew }: {
  history: HistorySnapshot[]; onRestore: (id: string) => void; onRemove: (id: string) => void;
  onExport: () => void; onNew: () => void;
}) {
  return <section>
    <div className="workspace-toolbar"><p><strong>{history.length}</strong> {history.length === 1 ? "comparação salva" : "comparações salvas"}</p><button className="button button-secondary" onClick={onExport} disabled={!history.length}><Icon name="download" size={16} />Exportar histórico</button></div>
    {!history.length ? <div className="panel empty-workspace"><span className="empty-illustration"><Icon name="history" size={31} /></span><h2>As boas escolhas merecem ser salvas.</h2><p>Adicione emissões ao comparador e use “Salvar no histórico” para guardar seus custos e resultados.</p><button className="button button-primary" onClick={onNew}><Icon name="plus" size={17} />Calcular uma emissão</button></div> :
    <div className="history-grid">{history.map((snapshot) => <article className="panel history-card" key={snapshot.id}>
      <div className="history-card-top"><span className="soft-icon"><Icon name="history" size={18} /></span><span className="subtle-badge">{snapshot.options.length} emissões</span></div>
      <h2>{snapshot.name}</h2><p className="history-date">{formatDateTime(snapshot.createdAt)}</p>
      <dl className="history-metrics"><div><dt>Melhor emissão</dt><dd>{snapshot.summary.bestOptionName || "Sem nome"}</dd></div><div><dt>Lucro líquido total</dt><dd>{formatBRL(snapshot.summary.totalNetProfit)}</dd></div><div><dt>Margem média</dt><dd>{formatPercent(snapshot.summary.averageNetMargin)}</dd></div></dl>
      <div className="history-actions"><button className="button button-secondary" onClick={() => onRestore(snapshot.id)}>Restaurar comparação<Icon name="arrow" size={16} /></button><button className="icon-button danger-icon" aria-label={`Remover comparação ${snapshot.name}`} onClick={() => onRemove(snapshot.id)}><Icon name="trash" size={17} /></button></div>
    </article>)}</div>}
  </section>;
}
