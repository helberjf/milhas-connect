"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ActionBar } from "@/components/action-bar";
import { DirectCompare } from "@/components/direct-compare";
import { FilterBar } from "@/components/filter-bar";
import { FormulaSection } from "@/components/formula-section";
import { FuelConsumption } from "@/components/fuel-consumption";
import { HistorySection } from "@/components/history-section";
import { Icon } from "@/components/icon";
import { MilheiroForm } from "@/components/milheiro-form";
import { PageHeader } from "@/components/page-header";
import { QuickCalculator } from "@/components/quick-calculator";
import { QuoteGenerator } from "@/components/quote-generator";
import { TravelNavigation } from "@/components/travel-navigation";
import { buildHistorySummary, calculateOption, sortOptionsByNetProfit } from "@/lib/calculations";
import { exportHistoryToCSV, exportOptionsToCSV } from "@/lib/csv";
import { createId, getDefaultFilters, getDefaultMilePrices, getDefaultOptions, getDefaultQuickCalculator } from "@/lib/defaults";
import { filterOptions, hasActiveFilters } from "@/lib/filters";
import { WORKSPACE_HASHES, resolveWorkspaceView, type WorkspaceView } from "@/lib/navigation";
import { clearAllStoredData, getStoredFilters, getStoredHistory, getStoredMilePrices, getStoredOptions, getStoredQuickCalculator, saveFilters, saveHistory, saveMilePrices, saveOptions, saveQuickCalculator } from "@/lib/storage";
import type { FilterState, FlightOption, HistorySnapshot, MilePrices, QuickCalculatorState } from "@/types";

type ThemeMode = "light" | "dark";
const THEME_STORAGE_KEY = "calculadora-milhas:theme";
function toNumber(value: string): number {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}
export default function Home() {
  const mainRef = useRef<HTMLElement>(null);
  const [milePrices, setMilePrices] = useState<MilePrices>(getDefaultMilePrices);
  const [options, setOptions] = useState<FlightOption[]>(getDefaultOptions);
  const [quickCalculator, setQuickCalculator] = useState<QuickCalculatorState>(getDefaultQuickCalculator);
  const [emissionName, setEmissionName] = useState("");
  const [filters, setFilters] = useState<FilterState>(getDefaultFilters);
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [snapshotName, setSnapshotName] = useState("");
  const [hasLoadedStorage, setHasLoadedStorage] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [view, setView] = useState<WorkspaceView>("calculator");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMilePrices(getStoredMilePrices());
      setOptions(getStoredOptions());
      setQuickCalculator(getStoredQuickCalculator());
      setFilters(getStoredFilters());
      setHistory(getStoredHistory());
      const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      setThemeMode(storedTheme === "dark" || storedTheme === "light" ? storedTheme :
        window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      setView(resolveWorkspaceView(window.location.search, window.location.hash));
      setHasLoadedStorage(true);
    }, 0);
    function readLocation() { setView(resolveWorkspaceView(window.location.search, window.location.hash)); }
    window.addEventListener("hashchange", readLocation);
    window.addEventListener("popstate", readLocation);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("hashchange", readLocation);
      window.removeEventListener("popstate", readLocation);
    };
  }, []);
  useEffect(() => {
    if (!hasLoadedStorage) return;
    saveMilePrices(milePrices); saveOptions(options); saveQuickCalculator(quickCalculator);
    saveFilters(filters); saveHistory(history);
  }, [filters, hasLoadedStorage, history, milePrices, options, quickCalculator]);
  useEffect(() => {
    if (!hasLoadedStorage) return;
    document.documentElement.classList.toggle("dark", themeMode === "dark");
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [hasLoadedStorage, themeMode]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const calculatedOptions = useMemo(() => sortOptionsByNetProfit(options.map((option) => calculateOption(option, milePrices))), [milePrices, options]);
  const filteredOptions = useMemo(() => filterOptions(calculatedOptions, filters), [calculatedOptions, filters]);
  const isFiltered = hasActiveFilters(filters);
  const quickCalculatorResult = useMemo(() => calculateOption({ id: "quick-calculator", name: emissionName, ...quickCalculator }, milePrices), [milePrices, quickCalculator, emissionName]);
  function navigate(next: WorkspaceView) {
    setView(next);
    if (window.location.hash !== WORKSPACE_HASHES[next]) window.history.pushState(null, "", WORKSPACE_HASHES[next]);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function updateOption(id: string, patch: Partial<FlightOption>) {
    setOptions((current) => current.map((option) => option.id === id ? { ...option, ...patch } : option));
  }
  function addToCompare() {
    if (!hasLoadedStorage || (quickCalculator.miles <= 0 && quickCalculator.cashAmount <= 0)) return;
    setOptions((current) => [...current, { ...quickCalculator, id: createId("option"), name: emissionName.trim() || `Emissão ${current.length + 1}` }]);
    setFilters(getDefaultFilters());
    setNotice("Emissão adicionada à comparação.");
    navigate("compare");
  }
  function saveScenario() {
    if (!options.length) return;
    const snapshot: HistorySnapshot = {
      id: createId("history"), name: snapshotName.trim() || `Comparação ${history.length + 1}`,
      createdAt: new Date().toISOString(), milePrices, options,
      summary: buildHistorySummary(calculatedOptions),
    };
    setHistory((current) => [snapshot, ...current]);
    setSnapshotName(""); setNotice("Comparação salva no histórico.");
  }
  function restoreScenario(id: string) {
    const snapshot = history.find((item) => item.id === id);
    if (!snapshot) return;
    setMilePrices(snapshot.milePrices); setOptions(snapshot.options); setFilters(getDefaultFilters());
    setNotice("Comparação restaurada."); navigate("compare");
  }
  function restoreDefaults() {
    setMilePrices(getDefaultMilePrices()); setOptions(getDefaultOptions());
    setQuickCalculator(getDefaultQuickCalculator()); setFilters(getDefaultFilters());
    setHistory([]); setSnapshotName(""); setEmissionName(""); clearAllStoredData();
    setNotice("Valores iniciais restaurados.");
  }
  const priceForm = <MilheiroForm milePrices={milePrices} onChange={(company, value) => setMilePrices((current) => ({ ...current, [company]: toNumber(value) }))} />;
  return <>
    <a className="skip-link" href="#main-content" onClick={(event) => { event.preventDefault(); mainRef.current?.focus(); }}>Ir para o conteúdo</a>
    <TravelNavigation view={view} onNavigate={navigate} count={options.length} theme={themeMode} onToggleTheme={() => setThemeMode((current) => current === "light" ? "dark" : "light")} />
    <main id="main-content" className="workspace" ref={mainRef} tabIndex={-1}>
      <PageHeader view={view} />
      <div hidden={view !== "calculator"}>
        <QuickCalculator value={quickCalculator} result={quickCalculatorResult} name={emissionName} onNameChange={setEmissionName} canAdd={hasLoadedStorage}
          onCompanyChange={(company) => setQuickCalculator((current) => ({ ...current, company }))}
          onNumberChange={(field, value) => setQuickCalculator((current) => ({ ...current, [field]: toNumber(value) }))}
          onCommissionTypeChange={(commissionType) => setQuickCalculator((current) => ({ ...current, commissionType }))}
          onAddToCompare={addToCompare} />
        {view === "calculator" && priceForm}
        <FormulaSection />
      </div>
      <div hidden={view !== "compare"} className="view-stack">
        <div className="workspace-toolbar"><div><p><strong>{options.length}</strong> {options.length === 1 ? "emissão para comparar" : "emissões para comparar"}</p><small>Ordenadas pelo maior lucro líquido</small></div><button className="button button-primary" onClick={() => navigate("calculator")}><Icon name="plus" size={17} />Nova emissão</button></div>
        {options.length > 0 && <FilterBar filters={filters} visibleCount={filteredOptions.length} totalCount={options.length} onChange={(patch) => setFilters((current) => ({ ...current, ...patch }))} />}
        <DirectCompare options={filteredOptions} isFiltered={isFiltered} onClearFilters={() => setFilters(getDefaultFilters())} onNew={() => navigate("calculator")} onUpdate={updateOption} onRemove={(id) => setOptions((current) => current.filter((option) => option.id !== id))} />
        {view === "compare" && priceForm}
        <ActionBar snapshotName={snapshotName} onSnapshotNameChange={setSnapshotName} onSaveHistory={saveScenario} onExportOptions={() => exportOptionsToCSV(filteredOptions)} canSaveHistory={options.length > 0 && hasLoadedStorage} canExportOptions={filteredOptions.length > 0} onClearOptions={() => { setOptions([]); setFilters(getDefaultFilters()); }} onRestoreDefaults={restoreDefaults} />
      </div>
      <div hidden={view !== "history"}><HistorySection history={history} onRestore={restoreScenario} onRemove={(id) => setHistory((current) => current.filter((snapshot) => snapshot.id !== id))} onExport={() => exportHistoryToCSV(history)} onNew={() => navigate("calculator")} /></div>
      <div hidden={view !== "quotes"} className="secondary-tool"><QuoteGenerator /></div>
      <div hidden={view !== "fuel"} className="secondary-tool"><FuelConsumption /></div>
      <footer className="workspace-footer"><span><Icon name="shield" size={15} />Seus dados ficam salvos neste navegador.</span><span>Menos dúvidas. Mais destinos.<Icon name="plane" size={15} /></span></footer>
    </main>
    <div className={`notice ${notice ? "notice-visible" : ""}`} role="status">{notice && <><Icon name="check" size={17} />{notice}<button className="icon-button" aria-label="Fechar aviso" onClick={() => setNotice("")}><Icon name="close" size={15} /></button></>}</div>
  </>;
}
