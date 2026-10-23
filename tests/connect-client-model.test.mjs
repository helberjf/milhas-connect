import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../components/connect-model.tsx", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const model = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const prices = { latam: 25, azul: 18, smiles: 16 };
const offer = { id: "a", program: "latam", points: 40000, cashRequired: 120, currency: "BRL", taxesVerified: true };
const input = { origin: "GRU", destination: "LIS", alternatives: [], departure: "2027-02-10", returnDate: "2027-02-20", tripType: "roundtrip", adults: 2, cabin: "economy", baggage: "carry_on", flexDays: 0, programs: ["latam"], notes: "" };

test("custo completo usa pontos totais mais desembolso verificado uma única vez", () => {
  assert.equal(model.offerCost(offer, prices), 1120);
  assert.equal(model.offerCost({ ...offer, points: 0 }, prices), 120);
});

test("pendências de taxas, moeda e milheiro nunca aparecem como custo completo", () => {
  for (const patch of [{ taxesVerified: false }, { cashRequired: null }, { cashRequired: -1 }, { cashRequired: NaN }, { currency: "USD" }, { points: -1 }]) {
    assert.equal(model.offerCost({ ...offer, ...patch }, prices), null);
  }
  assert.equal(model.offerCost(offer, { ...prices, latam: 0 }), null);
});

test("melhor oferta ignora custos pendentes e respeita a tabela escolhida", () => {
  const offers = [offer, { ...offer, id: "b", program: "azul", points: 50000 }, { ...offer, id: "c", points: 1, taxesVerified: false }];
  assert.equal(model.bestOffer(offers, prices)?.id, "b");
  assert.equal(model.bestOffer(offers, { ...prices, latam: 10 })?.id, "a");
  assert.equal(model.bestOffer([offers[2]], prices), null);
});

test("pesquisa exige aeroportos, passageiros, programas e datas coerentes", () => {
  assert.deepEqual(model.validateSearch(input, "2026-10-23"), {});
  const errors = model.validateSearch({ ...input, origin: "SAO PAULO", destination: "GRU", departure: "2026-10-01", returnDate: "2026-09-01", adults: 0, programs: [] }, "2026-10-23");
  for (const key of ["origin", "departure", "returnDate", "adults", "programs"]) assert.ok(errors[key], key);
  assert.ok(model.validateSearch({ ...input, destination: "GRU" }, "2026-10-23").destination);
  assert.ok(model.validateSearch({ ...input, departure: "2027-02-31" }, "2026-10-23").departure);
});

test("links de origem aceitam apenas HTTPS oficial e preservam segurança ao abrir", () => {
  assert.equal(model.safeSource("https://www.latamairlines.com/br/pt"), "https://www.latamairlines.com/br/pt");
  for (const url of ["javascript:alert(1)", "https://latamairlines.com.evil.test", "http://www.voeazul.com.br", "https://evil.test"]) assert.equal(model.safeSource(url), null);
});

test("comparações locais descartam conteúdo inválido e mantêm o vínculo com a pesquisa", () => {
  const selection = { jobId: "job-a", offerId: "offer-a" };
  assert.deepEqual(model.readSelections(JSON.stringify([selection, { jobId: 1 }, null, selection])), [selection]);
  assert.deepEqual(model.readSelections("não é JSON"), []);
});
