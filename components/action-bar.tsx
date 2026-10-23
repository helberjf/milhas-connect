import { Icon } from "@/components/icon";

type Props = {
  snapshotName: string; onSnapshotNameChange: (value: string) => void;
  onSaveHistory: () => void; onExportOptions: () => void;
  canSaveHistory: boolean; canExportOptions: boolean;
  onClearOptions: () => void; onRestoreDefaults: () => void;
};
export function ActionBar({ snapshotName, onSnapshotNameChange, onSaveHistory, onExportOptions, canSaveHistory, canExportOptions, onClearOptions, onRestoreDefaults }: Props) {
  return <section className="panel save-scenario">
    <div><span className="soft-icon"><Icon name="save" /></span><div><h2>Guarde essa comparação</h2><p>Volte aos seus cenários sempre que precisar.</p></div></div>
    <form onSubmit={(e) => { e.preventDefault(); onSaveHistory(); }}>
      <input aria-label="Nome da comparação" placeholder="Nome da comparação (opcional)" value={snapshotName} onChange={(e) => onSnapshotNameChange(e.target.value)} />
      <button className="button button-primary" type="submit" disabled={!canSaveHistory}><Icon name="save" size={16} />Salvar no histórico</button>
    </form>
    <div className="scenario-secondary">
      <button className="text-button" onClick={onExportOptions} disabled={!canExportOptions}><Icon name="download" size={15} />Exportar emissões CSV</button>
      <details className="maintenance-options"><summary>Gerenciar dados<Icon name="chevron" size={13} /></summary><div><button className="text-button danger-text" onClick={onClearOptions} disabled={!canSaveHistory}>Limpar emissões atuais</button><button className="text-button danger-text" onClick={onRestoreDefaults}>Restaurar valores iniciais</button><p>Restaurar valores iniciais também limpa o histórico salvo.</p></div></details>
    </div>
  </section>;
}
