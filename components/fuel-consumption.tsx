"use client";

import { createId } from "@/lib/defaults";
import { formatBRL, formatDateTime } from "@/lib/formatters";
import { useEffect, useMemo, useState } from "react";

type FuelEntry = {
  id: string;
  date: string;
  odometerKm: number;
  liters: number;
  totalCost: number;
  fuelType: string;
};

const STORAGE_KEY = "calculadora-milhas:fuel-entries";

function toNumber(value: string): number {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function readEntries(): FuelEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as FuelEntry[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (entry) =>
        typeof entry.id === "string" &&
        typeof entry.date === "string" &&
        typeof entry.odometerKm === "number" &&
        typeof entry.liters === "number" &&
        typeof entry.totalCost === "number" &&
        typeof entry.fuelType === "string",
    );
  } catch {
    return [];
  }
}

function writeEntries(entries: FuelEntry[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function FuelConsumption() {
  const [date, setDate] = useState("");
  const [odometerKm, setOdometerKm] = useState("");
  const [liters, setLiters] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [fuelType, setFuelType] = useState("Gasolina");
  const [entries, setEntries] = useState<FuelEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setEntries(readEntries());
      setLoaded(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    writeEntries(entries);
  }, [entries, loaded]);

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => a.odometerKm - b.odometerKm);
  }, [entries]);

  const summary = useMemo(() => {
    const totalLiters = sortedEntries.reduce((sum, item) => sum + item.liters, 0);
    const totalCostAmount = sortedEntries.reduce((sum, item) => sum + item.totalCost, 0);
    const startKm = sortedEntries[0]?.odometerKm ?? 0;
    const endKm = sortedEntries[sortedEntries.length - 1]?.odometerKm ?? 0;
    const kmDriven = Math.max(0, endKm - startKm);
    const avgKmPerLiter = totalLiters > 0 ? kmDriven / totalLiters : 0;
    const avgCostPerLiter = totalLiters > 0 ? totalCostAmount / totalLiters : 0;
    const avgCostPerKm = kmDriven > 0 ? totalCostAmount / kmDriven : 0;

    return {
      totalLiters,
      totalCostAmount,
      kmDriven,
      avgKmPerLiter,
      avgCostPerLiter,
      avgCostPerKm,
    };
  }, [sortedEntries]);

  function addEntry() {
    const km = toNumber(odometerKm);
    const litersAmount = toNumber(liters);
    const costAmount = toNumber(totalCost);
    const cleanDate = date.trim();

    if (km <= 0 || litersAmount <= 0 || costAmount <= 0 || !cleanDate) {
      return;
    }

    setEntries((current) => [
      ...current,
      {
        id: createId("fuel"),
        date: cleanDate,
        odometerKm: km,
        liters: litersAmount,
        totalCost: costAmount,
        fuelType: fuelType.trim() || "Gasolina",
      },
    ]);

    setDate("");
    setOdometerKm("");
    setLiters("");
    setTotalCost("");
  }

  function removeEntry(id: string) {
    setEntries((current) => current.filter((item) => item.id !== id));
  }

  return (
    <section className="rounded-[28px] border border-slate-200/80 bg-white/95 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/90 sm:p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700 dark:text-sky-300">
          Viagens de carro
        </p>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Consumo de combustível
        </h2>
      </div>

      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/70">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 dark:text-slate-300">
          Registrar abastecimento
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <input
            type="date"
            aria-label="Data do abastecimento"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
          <input
            type="number"
            aria-label="Odômetro em quilômetros"
            min="0"
            step="1"
            value={odometerKm}
            onChange={(event) => setOdometerKm(event.target.value)}
            placeholder="Odometro (km)"
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
          <input
            type="number"
            aria-label="Quantidade de litros"
            min="0"
            step="0.01"
            value={liters}
            onChange={(event) => setLiters(event.target.value)}
            placeholder="Litros"
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
          <input
            type="number"
            aria-label="Valor pago em reais"
            min="0"
            step="0.01"
            value={totalCost}
            onChange={(event) => setTotalCost(event.target.value)}
            placeholder="Valor pago (R$)"
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
          <input
            type="text"
            aria-label="Tipo de combustível"
            value={fuelType}
            onChange={(event) => setFuelType(event.target.value)}
            placeholder="Combustivel"
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={addEntry}
            className="h-10 rounded-xl bg-slate-950 px-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500"
          >
            Adicionar
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800/70">
          <p className="text-slate-500 dark:text-slate-400">Media de consumo</p>
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {summary.avgKmPerLiter.toFixed(2)} km/l
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800/70">
          <p className="text-slate-500 dark:text-slate-400">Custo medio por litro</p>
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {formatBRL(summary.avgCostPerLiter)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800/70">
          <p className="text-slate-500 dark:text-slate-400">Custo medio por km</p>
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {formatBRL(summary.avgCostPerKm)}
          </p>
        </div>
      </div>

      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Distancia analisada: {summary.kmDriven.toFixed(0)} km • Total de litros:{" "}
        {summary.totalLiters.toFixed(2)} L • Total gasto: {formatBRL(summary.totalCostAmount)}
      </div>

      <div className="mt-3 space-y-2">
        {sortedEntries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-5 text-center text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            Nenhum abastecimento registrado ainda.
          </div>
        ) : (
          [...sortedEntries].reverse().map((entry) => (
            <article
              key={entry.id}
              className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 dark:border-slate-700 dark:bg-slate-800/70"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {entry.fuelType} • {entry.liters.toFixed(2)} L
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatDateTime(`${entry.date}T00:00:00`)} • Odometro:{" "}
                    {entry.odometerKm.toFixed(0)} km
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {formatBRL(entry.totalCost)}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeEntry(entry.id)}
                    className="h-8 rounded-lg border border-rose-200 bg-rose-50 px-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-700/60 dark:bg-rose-950/40 dark:text-rose-300"
                  >
                    Remover
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
