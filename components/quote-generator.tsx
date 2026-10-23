"use client";

import { createId } from "@/lib/defaults";
import { formatBRL, formatDateTime } from "@/lib/formatters";
import { useEffect, useMemo, useState } from "react";

type QuotePayload = {
  id: string;
  title: string;
  freelancerName: string;
  clientName: string;
  scope: string;
  amount: number;
  validUntil: string;
  createdAt: string;
};

type QuoteDecision = "pending" | "approved" | "rejected";

type StoredQuoteDecision = {
  status: QuoteDecision;
  updatedAt: string;
};

type DecisionMap = Record<string, StoredQuoteDecision>;

const STORAGE_KEY = "calculadora-milhas:quote-decisions";

function encodeQuote(payload: QuotePayload): string {
  const json = JSON.stringify(payload);
  return btoa(unescape(encodeURIComponent(json)));
}

function decodeQuote(encoded: string): QuotePayload | null {
  try {
    const json = decodeURIComponent(escape(atob(encoded)));
    const parsed = JSON.parse(json) as QuotePayload;

    if (!parsed?.id || !parsed?.title) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function toNumber(value: string): number {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function readDecisions(): DecisionMap {
  if (typeof window === "undefined") {
    return {};
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as DecisionMap;
  } catch {
    return {};
  }
}

function writeDecisions(next: DecisionMap): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function statusLabel(status: QuoteDecision): string {
  if (status === "approved") {
    return "Aprovado";
  }

  if (status === "rejected") {
    return "Rejeitado";
  }

  return "Pendente";
}

function statusClass(status: QuoteDecision): string {
  if (status === "approved") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-950/40 dark:text-emerald-300";
  }

  if (status === "rejected") {
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-700/50 dark:bg-rose-950/40 dark:text-rose-300";
  }

  return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300";
}

export function QuoteGenerator() {
  const [title, setTitle] = useState("Proposta de emissao com milhas");
  const [freelancerName, setFreelancerName] = useState("");
  const [clientName, setClientName] = useState("");
  const [scope, setScope] = useState(
    "Emissao de passagem e suporte completo ate confirmacao.",
  );
  const [amount, setAmount] = useState(0);
  const [validUntil, setValidUntil] = useState("");
  const [quoteLink, setQuoteLink] = useState("");
  const [activeQuote, setActiveQuote] = useState<QuotePayload | null>(null);
  const [decisions, setDecisions] = useState<DecisionMap>({});

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const quoteParam = params.get("orcamento");
    const parsedQuote = quoteParam ? decodeQuote(quoteParam) : null;
    const storedDecisions = readDecisions();

    const timer = window.setTimeout(() => {
      setActiveQuote(parsedQuote);
      setDecisions(storedDecisions);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const activeDecision = useMemo<QuoteDecision>(() => {
    if (!activeQuote) {
      return "pending";
    }

    return decisions[activeQuote.id]?.status ?? "pending";
  }, [activeQuote, decisions]);

  function createQuoteLink() {
    if (typeof window === "undefined") {
      return;
    }

    const payload: QuotePayload = {
      id: createId("quote"),
      title: title.trim() || "Proposta de servico",
      freelancerName: freelancerName.trim() || "Freelancer",
      clientName: clientName.trim() || "Cliente",
      scope: scope.trim() || "Escopo nao informado.",
      amount,
      validUntil: validUntil.trim(),
      createdAt: new Date().toISOString(),
    };

    const encoded = encodeQuote(payload);
    const link = `${window.location.origin}${window.location.pathname}?orcamento=${encodeURIComponent(encoded)}`;
    setQuoteLink(link);
  }

  async function copyQuoteLink() {
    if (!quoteLink || typeof window === "undefined") {
      return;
    }

    try {
      await window.navigator.clipboard.writeText(quoteLink);
    } catch {
      // no-op
    }
  }

  function updateDecision(status: QuoteDecision) {
    if (!activeQuote || status === "pending") {
      return;
    }

    const next: DecisionMap = {
      ...decisions,
      [activeQuote.id]: {
        status,
        updatedAt: new Date().toISOString(),
      },
    };

    setDecisions(next);
    writeDecisions(next);
  }

  return (
    <section className="rounded-[28px] border border-slate-200/80 bg-white/95 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/90 sm:p-5">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700 dark:text-sky-300">
          Orçamentos de passagens
        </p>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Prepare uma proposta de viagem
        </h2>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <input
          type="text"
          aria-label="Título da proposta"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Titulo da proposta"
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        />
        <input
          type="text"
          aria-label="Nome do responsável"
          value={freelancerName}
          onChange={(event) => setFreelancerName(event.target.value)}
          placeholder="Seu nome"
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        />
        <input
          type="text"
          aria-label="Nome do cliente"
          value={clientName}
          onChange={(event) => setClientName(event.target.value)}
          placeholder="Nome do cliente"
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        />
        <input
          type="number"
          aria-label="Valor total da proposta em reais"
          min="0"
          step="0.01"
          value={amount === 0 ? "" : amount}
          onChange={(event) => setAmount(toNumber(event.target.value))}
          placeholder="Valor total (R$)"
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        />
        <input
          type="date"
          aria-label="Validade da proposta"
          value={validUntil}
          onChange={(event) => setValidUntil(event.target.value)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        />
        <button
          type="button"
          onClick={createQuoteLink}
          className="h-10 rounded-xl bg-slate-950 px-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500"
        >
          Gerar link da proposta
        </button>
      </div>

      <textarea
        aria-label="Descrição da viagem e serviços incluídos"
        value={scope}
        onChange={(event) => setScope(event.target.value)}
        rows={3}
        placeholder="Escopo do servico"
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
      />

      {quoteLink ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/70">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            Link pronto para enviar ao cliente
          </p>
          <p className="mt-1 break-all text-xs text-slate-700 dark:text-slate-200">
            {quoteLink}
          </p>
          <button
            type="button"
            onClick={copyQuoteLink}
            className="mt-2 h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Copiar link
          </button>
        </div>
      ) : null}

      {activeQuote ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {activeQuote.title}
            </p>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(
                activeDecision,
              )}`}
            >
              {statusLabel(activeDecision)}
            </span>
          </div>

          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Responsável: {activeQuote.freelancerName}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Cliente: {activeQuote.clientName}
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Valor: <span className="font-semibold">{formatBRL(activeQuote.amount)}</span>
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Criado em: {formatDateTime(activeQuote.createdAt)}
          </p>
          {activeQuote.validUntil ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Valido ate: {activeQuote.validUntil}
            </p>
          ) : null}
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
            {activeQuote.scope}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => updateDecision("approved")}
              className="h-9 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-500"
            >
              Aprovar
            </button>
            <button
              type="button"
              onClick={() => updateDecision("rejected")}
              className="h-9 rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white transition hover:bg-rose-500"
            >
              Rejeitar
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
