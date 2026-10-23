export const MAX_PLATFORM_BODY_BYTES = 2_000_000;

export class HttpError extends Error {
  constructor(message, status = 422) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export const PROGRAMS = ["latam", "azul", "smiles"];
export const CITY_AIRPORTS = {
  SAO: ["GRU", "CGH", "VCP"], RIO: ["GIG", "SDU"], BHZ: ["CNF", "PLU"],
  BUE: ["AEP", "EZE"], PAR: ["CDG", "ORY"], LON: ["LHR", "LGW", "LCY", "LTN", "STN"],
  ROM: ["FCO", "CIA"], MIL: ["MXP", "LIN", "BGY"], TYO: ["HND", "NRT"],
  YTO: ["YYZ", "YTZ"], CHI: ["ORD", "MDW"],
};
export const OFFICIAL_HOSTS = {
  latam: ["latam.com", "latamairlines.com"],
  azul: ["voeazul.com.br", "tudoazul.com"],
  smiles: ["smiles.com.br", "voegol.com.br"],
};

function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(`${label} inválido.`);
  return value;
}
function text(value, label, max = 1000, empty = true) {
  if (typeof value !== "string" || value.length > max || (!empty && !value.trim())) throw new HttpError(`${label} inválido.`);
  return value.trim();
}
function amount(value, label, integer = false, max = 1e9) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max || (integer && !Number.isSafeInteger(value))) throw new HttpError(`${label} inválido.`);
  return value;
}
function date(value, label = "Data") {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T12:00:00Z`)) || new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) !== value) throw new HttpError(`${label} inválida.`);
  return value;
}
function offsetDate(value, offset) {
  return new Date(Date.parse(`${value}T12:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
}
function code(value) {
  const result = text(value, "Código de cidade ou aeroporto", 3, false).toUpperCase();
  if (!/^[A-Z]{3}$/.test(result)) throw new HttpError("Use códigos de cidade ou aeroporto com três letras.");
  return result;
}
export function airports(value) {
  return [...(CITY_AIRPORTS[value] || [value])];
}
export function todayInBrazil(now = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
}
export function normalizeMilePrices(raw) {
  object(raw, "Valores do milheiro");
  return Object.fromEntries(PROGRAMS.map(program => [program, Math.round((amount(raw[program], "Valor do milheiro", false, 100000) + Number.EPSILON) * 100) / 100]));
}
export function normalizeSearch(raw, milePrices, today = todayInBrazil()) {
  object(raw, "Pesquisa");
  const origin = code(raw.origin);
  const destination = code(raw.destination);
  if (raw.alternatives !== undefined && (!Array.isArray(raw.alternatives) || raw.alternatives.length > 5)) throw new HttpError("Informe no máximo cinco destinos alternativos.");
  const alternatives = [...new Set((raw.alternatives || []).filter(value => value !== "").map(code))].filter(value => value !== destination);
  const destinations = [...new Set([destination, ...alternatives].flatMap(airports))];
  if (airports(origin).some(value => destinations.includes(value))) throw new HttpError("Origem e destino possuem aeroportos sobrepostos.");
  const departure = date(raw.departure, "Data de ida");
  const tripType = raw.tripType ?? "oneway";
  if (!["oneway", "roundtrip"].includes(tripType)) throw new HttpError("Tipo de viagem inválido.");
  const returnDate = tripType === "roundtrip" ? date(raw.returnDate, "Data de volta") : null;
  if (returnDate && returnDate < departure) throw new HttpError("A volta deve ocorrer a partir da data de ida.");
  const adults = amount(raw.adults ?? 1, "Quantidade de adultos", true, 9);
  if (adults < 1) throw new HttpError("Informe ao menos um adulto.");
  const flexDays = amount(raw.flexDays ?? 0, "Flexibilidade", true, 3);
  if (offsetDate(departure, -flexDays) < today || departure > offsetDate(today, 730)) throw new HttpError("A data de ida e sua flexibilidade precisam estar no futuro, dentro de dois anos.");
  const cabin = raw.cabin ?? "economy";
  const baggage = raw.baggage ?? "carry_on";
  if (!["economy", "premium_economy", "business", "first"].includes(cabin)) throw new HttpError("Classe de cabine inválida.");
  if (!["carry_on", "checked_23kg"].includes(baggage)) throw new HttpError("Preferência de bagagem inválida.");
  if (!Array.isArray(raw.programs) || !raw.programs.length || raw.programs.length > 3 || raw.programs.some(value => !PROGRAMS.includes(value))) throw new HttpError("Selecione ao menos um programa válido.");
  const input = { origin, destination, alternatives, departure, returnDate, tripType, adults, cabin, baggage, flexDays, programs: [...new Set(raw.programs)], milePrices: normalizeMilePrices(milePrices), notes: text(raw.notes ?? "", "Observações", 1500) };
  if (searchScope(input).length > 300) throw new HttpError("A pesquisa ultrapassa 300 combinações. Reduza a flexibilidade ou os destinos.");
  return input;
}
export function searchScope(input) {
  const origins = airports(input.origin);
  const destinations = [...new Set([input.destination, ...input.alternatives].flatMap(airports))];
  const result = [];
  for (const program of input.programs) for (const origin of origins) for (const destination of destinations) for (let offset = -input.flexDays; offset <= input.flexDays; offset++) {
    result.push({ program, origin, destination, departure: offsetDate(input.departure, offset), returnDate: input.returnDate ? offsetDate(input.returnDate, offset) : null });
  }
  return result;
}
export function scopeKey(row) {
  return [row.program, row.origin, row.destination, row.departure, row.returnDate || ""].join("|");
}
export function validSource(value, program, required = true) {
  if (!value && !required) return "";
  text(value, "Fonte", 4096, false);
  let url;
  try { url = new URL(value); } catch { throw new HttpError("Fonte inválida."); }
  const hosts = OFFICIAL_HOSTS[program] || [];
  if (url.protocol !== "https:" || url.username || url.password || url.port || !hosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) throw new HttpError("A fonte precisa ser HTTPS no domínio oficial do programa.");
  return url.href;
}
function checkedAt(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > 40 || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) || Number.isNaN(Date.parse(value)) || Date.parse(value) > Date.now() + 300000) throw new HttpError("Horário de consulta inválido.");
  return new Date(value).toISOString();
}
function nullableNumber(value, label, integer = false) {
  return value === null || value === undefined ? null : amount(value, label, integer);
}
function flightTime(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new HttpError("Horário do voo inválido.");
  return value;
}
function scopedRow(raw, scope) {
  object(raw, "Resultado");
  if (!PROGRAMS.includes(raw.program)) throw new HttpError("Programa inválido no resultado.");
  const row = { program: raw.program, origin: code(raw.origin), destination: code(raw.destination), departure: date(raw.departure), returnDate: raw.returnDate ? date(raw.returnDate) : null };
  if (!scope.has(scopeKey(row))) throw new HttpError("Resultado fora do escopo da pesquisa.");
  return row;
}
export function normalizeResult(raw, input) {
  object(raw, "Resultado");
  if (!Array.isArray(raw.offers) || raw.offers.length > 50 || !Array.isArray(raw.coverage) || raw.coverage.length > 300 || !Array.isArray(raw.attention) || raw.attention.length > 50) throw new HttpError("Resultado excede os limites ou possui formato inválido.");
  const scope = new Set(searchScope(input).map(scopeKey));
  const ids = new Set();
  const offers = raw.offers.map((entry, index) => {
    const row = scopedRow(entry, scope);
    const id = text(entry.id || `oferta-${index + 1}`, "Identificador da oferta", 100, false);
    if (ids.has(id)) throw new HttpError("Identificadores de ofertas duplicados.");
    ids.add(id);
    if (typeof entry.taxesVerified !== "boolean") throw new HttpError("Confirmação de taxas inválida.");
    const currency = text(entry.currency ?? "BRL", "Moeda", 3, false).toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw new HttpError("Moeda inválida.");
    if (!Array.isArray(entry.flights) || entry.flights.length > 12) throw new HttpError("Voos inválidos.");
    const cashRequired = nullableNumber(entry.cashRequired, "Dinheiro obrigatório");
    if (entry.taxesVerified && cashRequired === null) throw new HttpError("Taxas confirmadas precisam de valor em dinheiro, inclusive quando zero.");
    return { ...row, id, operator: text(entry.operator ?? "", "Operadora", 150), departureTime: flightTime(entry.departureTime), arrivalTime: flightTime(entry.arrivalTime), durationMinutes: nullableNumber(entry.durationMinutes, "Duração", true), flights: entry.flights.map(value => text(value, "Número do voo", 80, false)), points: amount(entry.points, "Pontos", true), cashRequired, currency, taxesVerified: entry.taxesVerified, baggage: text(entry.baggage ?? "", "Bagagem", 500), eligibility: text(entry.eligibility ?? "", "Elegibilidade", 500), source: validSource(entry.source, row.program), checkedAt: checkedAt(entry.checkedAt), caveat: text(entry.caveat ?? "", "Condições", 1000) };
  });
  const coverageKeys = new Set();
  const coverage = raw.coverage.map(entry => {
    const row = scopedRow(entry, scope);
    const key = scopeKey(row);
    if (coverageKeys.has(key)) throw new HttpError("Cobertura duplicada para a mesma combinação.");
    coverageKeys.add(key);
    if (!["observed", "no_results", "technical_error", "attention_required", "not_completed"].includes(entry.state)) throw new HttpError("Estado de cobertura inválido.");
    return { ...row, state: entry.state, note: text(entry.note ?? "", "Observação da cobertura", 1500), source: validSource(entry.source || "", row.program, ["observed", "no_results"].includes(entry.state)), checkedAt: checkedAt(entry.checkedAt) };
  });
  return { summary: text(raw.summary, "Resumo", 3000), offers, coverage, attention: raw.attention.map(value => text(value, "Intervenção", 1000, false)) };
}
export function estimateCost(offer, prices) {
  const rate = prices?.[offer.program];
  if (!(rate > 0) || !Number.isFinite(rate) || !Number.isSafeInteger(offer.points) || offer.points < 0 || offer.currency !== "BRL" || offer.taxesVerified !== true || typeof offer.cashRequired !== "number" || !Number.isFinite(offer.cashRequired) || offer.cashRequired < 0) return null;
  return Math.round((offer.points / 1000 * rate + offer.cashRequired + Number.EPSILON) * 100) / 100;
}
export function coverageSummary(result, input) {
  const expected = new Set(searchScope(input).map(scopeKey));
  const completed = new Set((result?.coverage || []).filter(row => expected.has(scopeKey(row)) && ["observed", "no_results"].includes(row.state) && row.source && row.checkedAt).map(scopeKey));
  return { completed: completed.size, expected: expected.size };
}
export function resultStatus(result, input) {
  if (result.attention.length || result.coverage.some(row => row.state === "attention_required")) return "attention_required";
  const coverage = coverageSummary(result, input);
  if (coverage.completed === coverage.expected && result.offers.every(offer => offer.taxesVerified)) return "completed";
  return result.offers.length || coverage.completed ? "partial" : "failed";
}
