import type { JobStatus, MilePrices, Offer, Program, ResearchJob, SearchInput } from "@/lib/platform/types";

export const PROGRAMS: Program[] = ["latam", "azul", "smiles"];
export const PROGRAM_LABEL: Record<Program, string> = { latam: "LATAM Pass", azul: "Azul Fidelidade", smiles: "Smiles" };
export const STATUS_LABEL: Record<JobStatus, string> = { queued: "Na fila", running: "Pesquisando", completed: "Concluída", partial: "Resultado parcial", attention_required: "Precisa de atenção", failed: "Falha na pesquisa", cancelled: "Cancelada" };
export const CABIN_LABEL = { economy: "Econômica", premium_economy: "Premium economy", business: "Executiva", first: "Primeira classe" };
export type Selection = { jobId: string; offerId: string };
export type SelectedOffer = { job: ResearchJob; offer: Offer };
export type PriceMode = "snapshot" | "current";
export const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const number = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
export function date(value: string | null): string {
  if (!value) return "Não informada";
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? "Data não informada" : parsed.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}
export function dateTime(value: string | null): string {
  if (!value) return "Horário não informado";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Horário não informado" : parsed.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
export function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
export function decimal(value: string): number {
  const result = Number(value.trim().replace(",", "."));
  return Number.isFinite(result) ? result : 0;
}
export function offerCost(offer: Offer, prices: MilePrices): number | null {
  const rate = prices[offer.program];
  if (!offer.taxesVerified || offer.currency !== "BRL" || typeof offer.cashRequired !== "number" || !Number.isFinite(offer.cashRequired) || offer.cashRequired < 0 || !Number.isFinite(offer.points) || offer.points < 0 || !Number.isFinite(rate) || rate <= 0) return null;
  const result = (offer.points / 1000) * rate + offer.cashRequired;
  return Number.isFinite(result) ? result : null;
}
export function bestOffer(offers: Offer[], prices: MilePrices): Offer | null {
  let best: Offer | null = null;
  let bestCost = Infinity;
  for (const offer of offers) {
    const cost = offerCost(offer, prices);
    if (cost !== null && cost < bestCost) { best = offer; bestCost = cost; }
  }
  return best;
}
function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}
export function validateSearch(input: Omit<SearchInput, "milePrices">, today: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!/^[A-Z]{3}$/.test(input.origin)) errors.origin = "Informe um código IATA com 3 letras, como GRU.";
  if (!/^[A-Z]{3}$/.test(input.destination)) errors.destination = "Informe um código IATA com 3 letras, como LIS.";
  else if (input.destination === input.origin) errors.destination = "O destino deve ser diferente da origem.";
  if (input.alternatives.length > 4 || input.alternatives.some((airport) => !/^[A-Z]{3}$/.test(airport) || airport === input.origin)) errors.alternatives = "Use até 4 aeroportos alternativos válidos, separados por vírgula.";
  if (!validDate(input.departure) || input.departure < today) errors.departure = "Escolha uma data de ida válida, a partir de hoje.";
  if (input.tripType === "roundtrip" && (!input.returnDate || !validDate(input.returnDate) || input.returnDate < input.departure)) errors.returnDate = "A volta deve ser na mesma data da ida ou depois dela.";
  if (!Number.isInteger(input.adults) || input.adults < 1 || input.adults > 9) errors.adults = "Informe entre 1 e 9 adultos.";
  if (!input.programs.length || input.programs.some((program) => !PROGRAMS.includes(program))) errors.programs = "Selecione pelo menos um programa.";
  if (!Number.isInteger(input.flexDays) || input.flexDays < 0 || input.flexDays > 3) errors.flexDays = "A flexibilidade deve ser de 0 a 3 dias.";
  return errors;
}
export function safeSource(value: string): string | null {
  try {
    const url = new URL(value);
    const domains = ["latamairlines.com", "latam.com", "latampass.latam.com", "voeazul.com.br", "azulfidelidade.com.br", "smiles.com.br", "voegol.com.br"];
    if (url.protocol !== "https:" || url.username || url.password || !domains.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) return null;
    return url.href;
  } catch { return null; }
}
export function readSelections(value: string | null): Selection[] {
  try {
    const parsed: unknown = JSON.parse(value ?? "[]");
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    return parsed.filter((item): item is Selection => {
      if (!item || typeof item !== "object" || typeof item.jobId !== "string" || typeof item.offerId !== "string") return false;
      const key = `${item.jobId}:${item.offerId}`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    }).slice(0, 30).map(({ jobId, offerId }) => ({ jobId, offerId }));
  } catch { return []; }
}
