import { MAX_PLATFORM_BODY_BYTES, normalizeResult } from '../lib/platform/validation.mjs';

export const VERSION = '1.0.0';
export const MAX_RESULT_BYTES = MAX_PLATFORM_BODY_BYTES - 4096;
export const PROGRAMS = {
  latam: { name: 'LATAM Pass', url: 'https://www.latamairlines.com/br/pt', domains: ['latam.com', 'latamairlines.com'] },
  azul: { name: 'Azul Fidelidade', url: 'https://www.voeazul.com.br/br/pt/home', domains: ['voeazul.com.br', 'tudoazul.com'] },
  smiles: { name: 'Smiles', url: 'https://www.smiles.com.br', domains: ['smiles.com.br', 'voegol.com.br'] },
};
// Reference only. The researcher must confirm the actual airports included on each site.
export const CITY_AIRPORTS = {
  SAO: ['GRU', 'CGH', 'VCP'], RIO: ['GIG', 'SDU'], BHZ: ['CNF', 'PLU'], BUE: ['AEP', 'EZE'],
  PAR: ['CDG', 'ORY'], LON: ['LHR', 'LGW', 'LCY', 'LTN', 'STN'], ROM: ['FCO', 'CIA'],
  MIL: ['MXP', 'LIN', 'BGY'], TYO: ['HND', 'NRT'], YTO: ['YYZ', 'YTZ'], CHI: ['ORD', 'MDW'],
};
const unique = array => [...new Set(array)];
const airports = code => CITY_AIRPORTS[code] || [code];
const shift = (date, days) => {
  const timestamp = Date.parse(`${date}T12:00:00Z`);
  return new Date(timestamp + days * 86400000).toISOString().slice(0, 10);
};
export function searchScope(input) {
  const origins = airports(input.origin);
  const destinations = unique([input.destination, ...input.alternatives].flatMap(airports));
  const datePairs = [];
  for (let offset = -input.flexDays; offset <= input.flexDays; offset++) {
    datePairs.push({ departure: shift(input.departure, offset),
      returnDate: input.tripType === 'roundtrip' ? shift(input.returnDate, offset) : null });
  }
  return { origins, destinations, datePairs };
}
const str = (maxLength = 1500) => ({ type: 'string', maxLength });
const nullable = schema => ({ ...schema, type: [schema.type, 'null'] });
const object = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const array = (items, maxItems) => ({ type: 'array', items, maxItems });
const program = { type: 'string', enum: Object.keys(PROGRAMS) };
const date = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' };
const airport = { type: 'string', pattern: '^[A-Z]{3}$' };
const integer = maximum => ({ type: 'integer', minimum: 0, maximum });
const route = { program, origin: airport, destination: airport, departure: date, returnDate: nullable(date) };
export const RESULT_SCHEMA = object({
  summary: str(3000),
  offers: array(object({
    id: str(100), ...route, operator: str(150), departureTime: nullable({ type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' }),
    arrivalTime: nullable({ type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' }),
    durationMinutes: nullable(integer(100000)), flights: array(str(80), 12), points: integer(1e9),
    cashRequired: nullable({ type: 'number', minimum: 0, maximum: 1e9 }),
    currency: { type: 'string', pattern: '^[A-Z]{3}$' }, taxesVerified: { type: 'boolean' },
    baggage: str(500), eligibility: str(500), source: str(4096), checkedAt: nullable(str(40)), caveat: str(1000),
  }), 50),
  coverage: array(object({ ...route, state: { type: 'string', enum: ['observed', 'no_results', 'technical_error', 'attention_required', 'not_completed'] },
    note: str(1500), source: str(4096), checkedAt: nullable(str(40)),
  }), 300),
  attention: array(str(1000), 50),
});

function checkSchema(value, schema, location = 'result') {
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  const actual = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  if (!types.includes(actual) && !(types.includes('integer') && Number.isSafeInteger(value))) {
    throw new Error(`Formato inválido: ${location}.`);
  }
  if (value === null) return;
  if (schema.enum && !schema.enum.includes(value)) throw new Error(`Valor inválido: ${location}.`);
  if (typeof value === 'number' && (!Number.isFinite(value) || value < schema.minimum || value > schema.maximum)) throw new Error(`Número inválido: ${location}.`);
  if (typeof value === 'string' && ((schema.maxLength && value.length > schema.maxLength) || (schema.pattern && !new RegExp(schema.pattern).test(value)))) throw new Error(`Texto inválido: ${location}.`);
  if (actual === 'array') {
    if (value.length > schema.maxItems) throw new Error(`Lista muito longa: ${location}.`);
    value.forEach((item, index) => checkSchema(item, schema.items, `${location}[${index}]`));
  }
  if (actual === 'object') {
    if (Object.keys(value).some(key => !Object.hasOwn(schema.properties, key)) || schema.required.some(key => !Object.hasOwn(value, key))) throw new Error(`Campos inválidos: ${location}.`);
    for (const [key, subSchema] of Object.entries(schema.properties)) checkSchema(value[key], subSchema, `${location}.${key}`);
  }
}
export function officialSource(source, programId) {
  try {
    const url = new URL(source);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      PROGRAMS[programId]?.domains.some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
  } catch { return false; }
}
export function validateResult(result, input) {
  checkSchema(result, RESULT_SCHEMA);
  if (Buffer.byteLength(JSON.stringify(result), 'utf8') > MAX_RESULT_BYTES) throw new Error('Resultado excede o limite de bytes da API; reduza textos repetidos e mantenha as informações essenciais.');
  const scope = searchScope(input);
  const ids = new Set();
  for (const item of [...result.offers, ...result.coverage]) {
    if (!input.programs.includes(item.program) || !scope.origins.includes(item.origin) || !scope.destinations.includes(item.destination) ||
      !scope.datePairs.some(pair => pair.departure === item.departure && pair.returnDate === item.returnDate)) throw new Error('Resultado fora do escopo autorizado.');
    if (item.checkedAt !== null && (!/^\d{4}-\d{2}-\d{2}T/.test(item.checkedAt) || !Number.isFinite(Date.parse(item.checkedAt)) || Date.parse(item.checkedAt) > Date.now() + 300000)) throw new Error('Horário de conferência inválido.');
    const observed = !('state' in item) || ['observed', 'no_results'].includes(item.state);
    if ((item.source || observed) && !officialSource(item.source, item.program)) throw new Error('Fonte oficial HTTPS obrigatória.');
    if ('state' in item && observed && item.checkedAt === null) throw new Error('Cobertura observada exige horário real de conferência.');
    if ('points' in item) {
      if (!item.id || ids.has(item.id)) throw new Error('Identificador de oferta repetido ou ausente.');
      ids.add(item.id);
      if (item.taxesVerified && item.cashRequired === null) throw new Error('Taxas conferidas exigem valor em dinheiro.');
    }
  }
  // Use the same authoritative limits and duplicate checks as the receiving API.
  normalizeResult(result, input);
  return result;
}
export function attentionResult(input, message) {
  const scope = searchScope(input); const coverage = [];
  for (const program of input.programs) for (const origin of scope.origins) for (const destination of scope.destinations) for (const pair of scope.datePairs) {
    if (coverage.length < 300) coverage.push({ program, origin, destination, ...pair,
      state: 'attention_required', note: message, source: '', checkedAt: null });
  }
  return { summary: 'Pesquisa pendente de intervenção no computador do robô.', offers: [], coverage, attention: [message] };
}
