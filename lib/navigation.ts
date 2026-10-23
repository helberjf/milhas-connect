export type WorkspaceView = "calculator" | "compare" | "history" | "quotes" | "fuel";

export const WORKSPACE_HASHES: Record<WorkspaceView, string> = {
  calculator: "#calculadora", compare: "#comparar", history: "#historico",
  quotes: "#orcamentos", fuel: "#combustivel",
};

export function resolveWorkspaceView(search: string, hash: string): WorkspaceView {
  const match = (Object.entries(WORKSPACE_HASHES) as [WorkspaceView, string][])
    .find(([, value]) => value === hash);
  if (match) return match[0];
  return new URLSearchParams(search).has("orcamento") ? "quotes" : "calculator";
}
