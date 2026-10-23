import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/icon";
import type { WorkspaceView } from "@/lib/navigation";

const primary: { view: WorkspaceView; label: string; icon: IconName }[] = [
  { view: "calculator", label: "Calculadora", icon: "calculator" },
  { view: "compare", label: "Comparar emissões", icon: "compare" },
  { view: "history", label: "Histórico", icon: "history" },
];
const tools: { view: WorkspaceView; label: string; hint: string; icon: IconName }[] = [
  { view: "quotes", label: "Orçamentos de passagens", hint: "Prepare uma proposta para seu cliente", icon: "receipt" },
  { view: "fuel", label: "Consumo de combustível", hint: "Acompanhe os custos na estrada", icon: "fuel" },
];

export function TravelNavigation({ view, onNavigate, theme, onToggleTheme, count }: {
  view: WorkspaceView; onNavigate: (view: WorkspaceView) => void;
  theme: "light" | "dark"; onToggleTheme: () => void; count: number;
}) {
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const toolsButton = useRef<HTMLButtonElement>(null);
  const mobileButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (!wrapper.current?.contains(event.target as Node)) {
        setOpen(false);
        setMobileOpen(false);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (open) toolsButton.current?.focus();
        if (mobileOpen) mobileButton.current?.focus();
        setOpen(false);
        setMobileOpen(false);
      }
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, mobileOpen]);

  function navigate(next: WorkspaceView) {
    setOpen(false);
    setMobileOpen(false);
    onNavigate(next);
  }

  return <header className="site-header">
    <div className="nav-inner" ref={wrapper}>
      <button className="brand" aria-label="Milhas, voltar à calculadora" onClick={() => navigate("calculator")}>
        <span className="brand-symbol"><Icon name="plane" size={23} /></span>
        <span>milhas<span className="brand-dot">.</span></span>
      </button>
      <nav className="desktop-nav" aria-label="Navegação principal">
        {primary.map((item) => <button key={item.view} className={`nav-link ${view === item.view ? "is-active" : ""}`} aria-current={view === item.view ? "page" : undefined} onClick={() => navigate(item.view)}>
          <Icon name={item.icon} size={17} />{item.label}
          {item.view === "compare" && count > 0 && <span className="nav-count">{count}</span>}
        </button>)}
      </nav>
      <div className="nav-actions">
        <div className="tools-menu">
          <button ref={toolsButton} className={`tools-trigger ${view === "quotes" || view === "fuel" ? "is-active" : ""}`} aria-expanded={open} aria-controls="travel-tools" onClick={() => setOpen(!open)}>
            Ferramentas de viagem<Icon name="chevron" size={15} className={open ? "rotate-chevron" : ""} />
          </button>
          {open && <div id="travel-tools" className="tools-dropdown">
            <p className="menu-caption">PARA ALÉM DAS MILHAS</p>
            {tools.map((item) => <button key={item.view} className="tool-link" onClick={() => navigate(item.view)}>
              <span className="tool-icon"><Icon name={item.icon} /></span>
              <span><strong>{item.label}</strong><small>{item.hint}</small></span>
              <Icon name="arrow" size={16} />
            </button>)}
          </div>}
        </div>
        <span className="nav-divider" />
        <button className="icon-button theme-toggle" onClick={onToggleTheme} aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"} title={theme === "dark" ? "Modo claro" : "Modo escuro"}>
          <Icon name={theme === "dark" ? "sun" : "moon"} size={19} />
        </button>
        <button ref={mobileButton} className="icon-button mobile-trigger" aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={mobileOpen} aria-controls="mobile-navigation" onClick={() => setMobileOpen(!mobileOpen)}>
          <Icon name={mobileOpen ? "close" : "menu"} />
        </button>
      </div>
      {mobileOpen && <nav id="mobile-navigation" className="mobile-navigation" aria-label="Menu de navegação">
        {primary.map((item) => <button key={item.view} aria-current={view === item.view ? "page" : undefined} onClick={() => navigate(item.view)}><Icon name={item.icon} />{item.label}</button>)}
        <p className="menu-caption">FERRAMENTAS DE VIAGEM</p>
        {tools.map((item) => <button key={item.view} onClick={() => navigate(item.view)}><Icon name={item.icon} />{item.label}</button>)}
      </nav>}
    </div>
  </header>;
}
