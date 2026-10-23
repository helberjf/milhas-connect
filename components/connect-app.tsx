"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Icon, type IconName } from "@/components/icon";
import { ConnectAlerts, ConnectJobList, ConnectOverview, ConnectRobot, ConnectSettings } from "@/components/connect-dashboard";
import { ConnectCalculator, ConnectComparison, ConnectQuotes } from "@/components/connect-finance";
import { ConnectJobDetail } from "@/components/connect-offers";
import { dateTime, readSelections, type PriceMode, type SelectedOffer, type Selection } from "@/components/connect-model";
import { ConnectSearchForm } from "@/components/connect-search-form";
import type { Dashboard, MilePrices, ResearchJob, SearchInput } from "@/lib/platform/types";

type View = "overview" | "search" | "jobs" | "compare" | "calculator" | "quotes" | "alerts" | "robot" | "settings";
const NAV: { id: View; label: string; icon: IconName }[] = [
  { id: "overview", label: "Visão geral", icon: "grid" }, { id: "search", label: "Nova pesquisa", icon: "search" }, { id: "jobs", label: "Minhas pesquisas", icon: "plane" },
  { id: "compare", label: "Comparação", icon: "compare" }, { id: "calculator", label: "Calculadora", icon: "calculator" }, { id: "quotes", label: "Cotações", icon: "receipt" }, { id: "alerts", label: "Alertas de rotas", icon: "bell" },
  { id: "robot", label: "Meu robô", icon: "robot" }, { id: "settings", label: "Milheiros", icon: "wallet" },
];
const HEADINGS: Record<View, { title: string; subtitle: string }> = {
  overview: { title: "Uma boa viagem começa com clareza.", subtitle: "Seu espaço para pesquisar, comparar e escolher com confiança." },
  search: { title: "Vamos encontrar seu próximo destino.", subtitle: "Uma pesquisa, vários programas. Tudo acompanhado por aqui." },
  jobs: { title: "Cada pesquisa, uma possibilidade.", subtitle: "Da fila aos resultados, acompanhe o que seu robô encontrou." },
  compare: { title: "A escolha fica mais fácil lado a lado.", subtitle: "Compare o custo completo e as condições de cada oferta." },
  calculator: { title: "Transforme pontos em números claros.", subtitle: "Simule o custo da emissão, a venda e o lucro líquido." },
  quotes: { title: "Uma boa oferta merece uma boa cotação.", subtitle: "Prepare uma proposta a partir dos dados da sua pesquisa." },
  alerts: { title: "Seu próximo destino, sempre no radar.", subtitle: "Salve rotas e acompanhe oportunidades dentro do seu orçamento." },
  robot: { title: "Seu computador. Seu auxiliar de viagem.", subtitle: "O robô pesquisa localmente e conecta os resultados ao seu painel." },
  settings: { title: "O valor dos seus pontos começa aqui.", subtitle: "Uma tabela compartilhada para pesquisar e comparar com clareza." },
};
const STORAGE_KEY = "milhas-connect:comparison:v1";

function Brand() {
  return <span className="cx-brand"><span className="cx-brand-mark"><Icon name="plane" size={23} /></span><span>milhas<span className="cx-brand-connect">connect<span className="cx-brand-dot">.</span></span></span></span>;
}
function Loading({ label = "Conectando seu painel…" }: { label?: string }) {
  return <div className="cx-loading" role="status"><span className="cx-loading-ring" /><p>{label}</p></div>;
}
function Login({ configured, error, busy, onLogin, onRetry }: { configured: boolean; error: string; busy: boolean; onLogin: (password: string) => void; onRetry: () => void }) {
  const [password, setPassword] = useState("");
  function submit(event: FormEvent) { event.preventDefault(); if (password && !busy) onLogin(password); }
  return <main className="cx-login"><section className="cx-login-story"><Brand /><div><span className="cx-kicker">SEUS PONTOS. NOVAS POSSIBILIDADES.</span><h1>Mais clareza.<br />Mais destinos.</h1><p>Da primeira pesquisa à próxima viagem,<br />todas as suas escolhas se conectam aqui.</p><div className="cx-login-orbit" aria-hidden="true"><span /><span /><Icon name="plane" size={65} /><i /><i /></div></div><p className="cx-login-story-footer"><Icon name="shield" size={16} />Sua plataforma de pesquisa e planejamento de viagens.</p></section><section className="cx-login-form-wrap"><div className="cx-login-mobile-brand"><Brand /></div><form onSubmit={submit} className="cx-login-form"><span className="cx-icon-tile"><Icon name="lock" size={23} /></span><span className="cx-kicker">BEM-VINDO AO MILHAS CONNECT</span><h2>Seu próximo destino<br />começa aqui.</h2><p>Acesse seu painel para acompanhar pesquisas, comparar ofertas e preparar cotações.</p>{!configured && <div className="cx-alert cx-alert-warning"><Icon name="info" size={19} /><div><strong>Configuração inicial pendente</strong><p>A senha de acesso precisa ser configurada no ambiente do site.</p></div></div>}{error && <div className="cx-alert cx-alert-error" role="alert"><Icon name="alert" size={18} /><p>{error}</p></div>}<label className="cx-field">Senha de acesso<input name="password" type="password" autoComplete="current-password" placeholder="Digite sua senha" required value={password} onChange={(event) => setPassword(event.target.value)} disabled={!configured} /></label><button className="cx-button cx-primary" type="submit" disabled={busy || !configured || !password}>{busy ? "Entrando…" : "Entrar no painel"}<Icon name="arrow" size={18} /></button>{!configured && <button type="button" className="cx-inline-button" onClick={onRetry} disabled={busy}>Verificar configuração novamente</button>}<div className="cx-login-security"><Icon name="shield" size={17} /><span>Acesso protegido. A sessão fica neste navegador.</span></div></form><footer>Milhas Connect <span>Menos dúvidas. Mais destinos.</span></footer></section></main>;
}

export function ConnectApp() {
  const [auth, setAuth] = useState<"checking" | "login" | "ready">("checking");
  const [configured, setConfigured] = useState(true);
  const [data, setData] = useState<Dashboard | null>(null);
  const [view, setView] = useState<View>("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState("");
  const pendingRef = useRef(false);
  const pollBusy = useRef(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const activeJobRef = useRef<string | null>(null);
  const [details, setDetails] = useState<Record<string, ResearchJob>>({});
  const detailRequests = useRef(new Map<string, Promise<ResearchJob>>());
  const [selections, setSelections] = useState<Selection[]>([]);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [selectionLoading, setSelectionLoading] = useState(false);
  const [selected, setSelected] = useState<SelectedOffer | null>(null);
  const [priceMode, setPriceMode] = useState<PriceMode>("snapshot");
  const main = useRef<HTMLElement>(null);

  const request = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(`/api/platform${path}`, { ...init, credentials: "same-origin", cache: "no-store", headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers } });
    const body = await response.json().catch(() => ({}));
    if (response.status === 401) { setAuth("login"); setData(null); setDetails({}); setSelected(null); }
    if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Não foi possível concluir. Tente novamente.");
    return body as T;
  }, []);
  const checkSession = useCallback(async () => {
    try { setError(""); const session = await request<{ authenticated: boolean; configured: boolean }>("/session"); setConfigured(session.configured); setAuth(session.authenticated ? "ready" : "login"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao conectar ao site."); setAuth("login"); }
  }, [request]);
  const loadJob = useCallback((id: string): Promise<ResearchJob> => {
    const inflight = detailRequests.current.get(id);
    if (inflight) return inflight;
    const result = request<{ job: ResearchJob }>(`/jobs/${encodeURIComponent(id)}`).then(({ job }) => { setDetails((current) => ({ ...current, [job.id]: job })); return job; }).finally(() => { detailRequests.current.delete(id); });
    detailRequests.current.set(id, result);
    return result;
  }, [request]);
  const refresh = useCallback(async () => {
    if (pollBusy.current) return;
    pollBusy.current = true;
    try { const next = await request<Dashboard>("/dashboard"); setData(next); if (activeJobRef.current) await loadJob(activeJobRef.current); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível atualizar o painel."); }
    finally { pollBusy.current = false; }
  }, [loadJob, request]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void checkSession(); }, 0);
    return () => window.clearTimeout(timer);
  }, [checkSession]);
  useEffect(() => {
    const timer = window.setTimeout(() => { try { setSelections(readSelections(localStorage.getItem(STORAGE_KEY))); } catch { /* Comparison remains available in memory when storage is denied. */ } setStorageLoaded(true); }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { if (!storageLoaded) return; try { localStorage.setItem(STORAGE_KEY, JSON.stringify(selections)); } catch { /* Private browsers may deny persistence. */ } }, [selections, storageLoaded]);
  useEffect(() => {
    if (auth !== "ready") return;
    const initial = window.setTimeout(() => { void refresh(); }, 0);
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 12000);
    function visible() { if (document.visibilityState === "visible") void refresh(); }
    document.addEventListener("visibilitychange", visible);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, [auth, refresh]);
  useEffect(() => {
    if (auth !== "ready" || !storageLoaded || !selections.length) return;
    const ids = [...new Set(selections.map((item) => item.jobId))].filter((id) => !details[id]);
    if (!ids.length) return;
    let active = true;
    Promise.resolve().then(() => { if (active) setSelectionLoading(true); });
    void Promise.allSettled(ids.map(loadJob)).then((results) => { if (!active) return; setSelectionLoading(false); if (results.some((result) => result.status === "rejected")) setError("Algumas ofertas salvas não puderam ser carregadas. Atualize o painel para tentar novamente."); });
    return () => { active = false; };
  }, [auth, details, loadJob, selections, storageLoaded]);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(""), 6000); return () => window.clearTimeout(timer); }, [notice]);

  function navigate(next: View) { setView(next); setMenuOpen(false); if (next !== "jobs") { setActiveJobId(null); activeJobRef.current = null; } window.scrollTo({ top: 0, behavior: "instant" }); window.requestAnimationFrame(() => main.current?.focus()); }
  function openJob(id: string) { setActiveJobId(id); activeJobRef.current = id; setView("jobs"); setMenuOpen(false); setError(""); void loadJob(id).catch((cause) => setError(cause instanceof Error ? cause.message : "Não foi possível abrir a pesquisa.")); window.scrollTo({ top: 0, behavior: "instant" }); }
  async function mutate<T,>(key: string, path: string, body?: unknown, method = "POST", headers?: Record<string, string>): Promise<T | null> {
    if (pendingRef.current) return null;
    pendingRef.current = true; setPending(key); setError("");
    try { return await request<T>(path, { method, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), headers }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar. Tente novamente."); return null; }
    finally { pendingRef.current = false; setPending(""); }
  }
  async function login(password: string) { if (await mutate("login", "/login", { password })) { setAuth("ready"); setError(""); } }
  async function logout() { if (await mutate("logout", "/logout")) { setAuth("login"); setData(null); setDetails({}); setSelected(null); setActiveJobId(null); activeJobRef.current = null; } }
  async function createJob(input: Omit<SearchInput, "milePrices">, key: string) {
    const result = await mutate<{ job: ResearchJob }>("create", "/jobs", input, "POST", { "Idempotency-Key": key });
    if (!result) return false;
    setDetails((current) => ({ ...current, [result.job.id]: result.job })); setNotice("Pesquisa adicionada à fila. Acompanhe os resultados por aqui."); openJob(result.job.id); void refresh(); return true;
  }
  async function jobAction(id: string, action: "cancel" | "retry") {
    const result = await mutate<{ job: ResearchJob }>(`job-${action}`, `/jobs/${encodeURIComponent(id)}/${action}`);
    if (!result) return;
    setDetails((current) => ({ ...current, [id]: result.job })); setNotice(action === "cancel" ? "Pesquisa cancelada." : "Pesquisa enviada novamente para a fila."); void refresh();
  }
  function addCompare(selection: SelectedOffer) { const key = `${selection.job.id}:${selection.offer.id}`; if (selections.some((item) => `${item.jobId}:${item.offerId}` === key)) return; if (selections.length >= 30) { setNotice("A comparação comporta até 30 ofertas. Remova uma opção para adicionar outra."); return; } setSelections((current) => [...current, { jobId: selection.job.id, offerId: selection.offer.id }]); setNotice("Oferta adicionada à comparação."); }
  function selectOffer(selection: SelectedOffer, next: "calculator" | "quotes") { setSelected(selection); navigate(next); }
  const comparisons = useMemo(() => selections.flatMap((item) => { const job = details[item.jobId]; const offer = job?.result?.offers.find((candidate) => candidate.id === item.offerId); return job && offer ? [{ job, offer }] : []; }), [details, selections]);
  const activeJob = activeJobId ? details[activeJobId] : null;
  const heading = HEADINGS[view];

  if (auth === "checking") return <div className="cx-boot"><Brand /><Loading /></div>;
  if (auth === "login") return <Login configured={configured} error={error} busy={Boolean(pending)} onLogin={login} onRetry={() => void checkSession()} />;
  return <div className="cx-shell"><a className="skip-link" href="#connect-main">Ir para o conteúdo</a>{menuOpen && <button className="cx-sidebar-overlay" aria-label="Fechar navegação" onClick={() => setMenuOpen(false)} />}
    <aside className={`cx-sidebar ${menuOpen ? "is-open" : ""}`}><button className="cx-brand-button" aria-label="Milhas Connect, visão geral" onClick={() => navigate("overview")}><Brand /></button><div className="cx-sidebar-label">SEU ESPAÇO DE VIAGENS</div><nav aria-label="Navegação principal">{NAV.map((item, index) => <div key={item.id}>{index === 7 && <div className="cx-nav-divider" />}<button className={`cx-nav-item ${view === item.id ? "is-active" : ""}`} aria-current={view === item.id ? "page" : undefined} onClick={() => { if (item.id === "jobs") { setActiveJobId(null); activeJobRef.current = null; } navigate(item.id); }}><Icon name={item.icon} size={19} /><span>{item.label}</span>{item.id === "compare" && selections.length > 0 && <span className="cx-nav-count">{selections.length}</span>}{item.id === "jobs" && !!data?.jobs.some((job) => job.status === "running") && <span className="cx-nav-pulse" />}</button></div>)}</nav><div className="cx-sidebar-bottom"><button className="cx-sidebar-robot" onClick={() => navigate("robot")}><span className="cx-sidebar-robot-icon"><Icon name="robot" size={20} /></span><span><strong>Auxiliar local</strong><small><i className={data?.robot.online ? "is-online" : ""} />{data?.robot.online ? "Conectado ao seu PC" : "Aguardando conexão"}</small></span><Icon name="chevron" size={14} /></button><div className="cx-sidebar-footnote"><Icon name="shield" size={14} />Planeje com clareza. Viaje melhor.</div></div></aside>
    <div className="cx-workspace"><header className="cx-topbar"><div><button className="cx-icon-button cx-mobile-menu" aria-label="Abrir navegação" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><Icon name="menu" /></button><span className="cx-breadcrumb">Seu espaço<Icon name="chevron" size={12} /><strong>{NAV.find((item) => item.id === view)?.label}</strong></span></div><div className="cx-topbar-actions"><span className={`cx-topbar-status ${data?.robot.online ? "is-online" : ""}`}><span />Robô {data?.robot.online ? "online" : "offline"}</span><button className="cx-icon-button cx-refresh" aria-label="Atualizar painel" onClick={() => { setError(""); void refresh(); }}><Icon name="refresh" size={17} /></button><button className="cx-icon-button cx-notification-button" aria-label="Abrir alertas de rotas" onClick={() => navigate("alerts")}><Icon name="bell" size={19} />{!!data?.notifications.some((item) => !item.read) && <i />}</button><span className="cx-topbar-divider" /><span className="cx-avatar" title="Seu painel privado">MC</span><button className="cx-icon-button" onClick={logout} disabled={Boolean(pending)} aria-label="Sair do painel"><Icon name="logout" size={17} /></button></div></header>
      <main className="cx-main" id="connect-main" ref={main} tabIndex={-1}><div className="cx-page-heading"><div><span className="cx-eyebrow">MILHAS CONNECT <i />{view === "overview" ? "BEM-VINDO AO SEU PAINEL" : NAV.find((item) => item.id === view)?.label.toUpperCase()}</span><h1>{heading.title}</h1><p>{heading.subtitle}</p></div>{view !== "search" && view !== "overview" && <button className="cx-button cx-primary" onClick={() => navigate("search")}><Icon name="plus" size={17} />Nova pesquisa</button>}</div>
        {error && <div className="cx-alert cx-alert-error cx-global-error" role="alert"><Icon name="alert" size={19} /><p>{error}</p><button className="cx-icon-button" onClick={() => setError("")} aria-label="Fechar mensagem de erro"><Icon name="close" size={16} /></button></div>}
        {!data ? <div className="cx-card"><Loading label={error ? "Aguardando conexão com o painel." : "Carregando seu espaço de viagens…"} />{error && <button className="cx-button cx-secondary cx-loading-retry" onClick={() => void refresh()}>Tentar novamente</button>}</div> : <>
          {view === "overview" && <ConnectOverview data={data} onResearch={() => navigate("search")} onOpen={openJob} onView={(next) => { if (next === "jobs") { setActiveJobId(null); activeJobRef.current = null; } navigate(next); }} onRead={async () => { if (await mutate("read", "/notifications/read")) { void refresh(); setNotice("Notificações marcadas como lidas."); } }} busy={Boolean(pending)} />}
          {view === "search" && <ConnectSearchForm online={data.robot.online} onSubmit={createJob} busy={Boolean(pending)} />}
          {view === "jobs" && (activeJobId ? activeJob ? <ConnectJobDetail key={activeJob.id} job={activeJob} currentPrices={data.settings.milePrices} priceMode={priceMode} onPriceMode={setPriceMode} comparedIds={selections.map((item) => `${item.jobId}:${item.offerId}`)} onCompare={addCompare} onSelect={(selection) => selectOffer(selection, "calculator")} onQuote={(selection) => selectOffer(selection, "quotes")} onBack={() => { setActiveJobId(null); activeJobRef.current = null; }} onAction={jobAction} busy={Boolean(pending)} /> : <div className="cx-card"><Loading label="Carregando os detalhes da pesquisa…" /><button className="cx-button cx-secondary cx-loading-retry" onClick={() => { setActiveJobId(null); activeJobRef.current = null; }}>Voltar às pesquisas</button></div> : <ConnectJobList jobs={data.jobs} onOpen={openJob} />)}
          {view === "compare" && <><ConnectComparison selections={comparisons} currentPrices={data.settings.milePrices} mode={priceMode} onMode={setPriceMode} onSelect={(selection) => selectOffer(selection, "calculator")} onQuote={(selection) => selectOffer(selection, "quotes")} onRemove={(selection) => setSelections((current) => current.filter((item) => item.jobId !== selection.job.id || item.offerId !== selection.offer.id))} onNew={() => navigate("jobs")} loading={selectionLoading} />{!selectionLoading && selections.length > comparisons.length && <div className="cx-soft-note cx-missing-comparisons"><Icon name="info" size={17} /><p>{selections.length - comparisons.length} {selections.length - comparisons.length === 1 ? "oferta salva está indisponível" : "ofertas salvas estão indisponíveis"}. A pesquisa pode ter sido atualizada.</p><button className="cx-inline-button" onClick={() => setSelections(comparisons.map(({ job, offer }) => ({ jobId: job.id, offerId: offer.id })))}>Remover indisponíveis</button></div>}</>}
          {view === "calculator" && <ConnectCalculator key={selected ? `${selected.job.id}:${selected.offer.id}` : "manual"} selected={selected} currentPrices={data.settings.milePrices} onQuote={(selection) => selectOffer(selection, "quotes")} onResearch={() => navigate("jobs")} />}
          {view === "quotes" && <ConnectQuotes key={selected ? `${selected.job.id}:${selected.offer.id}` : "empty"} selected={selected} currentPrices={data.settings.milePrices} onResearch={() => navigate("jobs")} onNotice={setNotice} />}
          {view === "alerts" && <ConnectAlerts data={data} onCreate={async (jobId, targetCost, intervalHours) => { const result = await mutate("monitor", "/monitors", { jobId, targetCost, intervalHours }); if (result) { setNotice("Rota adicionada ao monitoramento."); void refresh(); return true; } return false; }} onToggle={async (id, enabled) => { if (await mutate("toggle-monitor", `/monitors/${encodeURIComponent(id)}`, { enabled }, "PATCH")) { void refresh(); setNotice(enabled ? "Monitor ativado." : "Monitor pausado."); } }} onOpen={openJob} busy={Boolean(pending)} />}
          {view === "robot" && <ConnectRobot data={data} />}
          {view === "settings" && <ConnectSettings key={JSON.stringify(data.settings.milePrices)} prices={data.settings.milePrices} onSave={async (milePrices: MilePrices) => { if (await mutate("settings", "/settings", { milePrices }, "PUT")) { void refresh(); setNotice("Preços de milheiro salvos no site."); } }} busy={Boolean(pending)} />}
          <footer className="cx-footer"><span><Icon name="shield" size={14} />Milhas Connect · Seu próximo destino, com clareza.</span><span>Atualizado em {dateTime(data.now)} <i />{data.storage === "postgres" ? "Dados conectados" : "Armazenamento local"}</span></footer>
        </>}
      </main>
    </div><div className={`cx-toast ${notice ? "is-visible" : ""}`} role="status">{notice && <><span><Icon name="check" size={17} /></span><p>{notice}</p><button className="cx-icon-button" onClick={() => setNotice("")} aria-label="Fechar aviso"><Icon name="close" size={16} /></button></>}</div>
  </div>;
}
