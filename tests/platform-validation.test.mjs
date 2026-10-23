import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeSearch, searchScope, normalizeResult, estimateCost, resultStatus } from "../lib/platform/validation.mjs";

const prices = {latam:26,smiles:15,azul:15};
const raw = {origin:"jdo",destination:"sao",departure:"2026-11-12",programs:["latam"],adults:1};
const input = () => normalizeSearch(raw, prices, "2026-10-23");
const offer = () => ({id:"o1",program:"latam",operator:"LATAM Brasil",origin:"JDO",destination:"GRU",departure:"2026-11-12",returnDate:null,departureTime:"03:00",arrivalTime:"06:00",durationMinutes:180,flights:["LA 3889"],points:13161,cashRequired:48.78,currency:"BRL",taxesVerified:true,baggage:"Mochila",eligibility:"Sem clube",source:"https://www.latamairlines.com/br/pt/oferta-voos",checkedAt:"2026-10-23T19:00:00Z",caveat:""});

test("normalizes city scope and preserves optional cost as unknown", () => {
  assert.equal(input().origin,"JDO");
  assert.equal(searchScope(input()).length,3);
  assert.equal(estimateCost({...offer(),taxesVerified:false},prices),null);
  assert.equal(estimateCost(offer(),prices),390.97);
  assert.equal(estimateCost(offer(),{...prices,latam:0}),null);
});
test("rejects overlapping airports, invalid dates and excessive combinations", () => {
  assert.throws(()=>normalizeSearch({...raw,origin:"GRU"},prices,"2026-10-23"),/sobrep/);
  assert.throws(()=>normalizeSearch({...raw,departure:"2026-02-30"},prices,"2026-10-23"),/data|Data/);
  assert.throws(()=>normalizeSearch({...raw,origin:"LON",destination:"PAR",alternatives:["SAO","RIO","TYO"],flexDays:3,programs:["latam","smiles","azul"]},prices,"2026-10-23"),/300|combina/);
});
test("roundtrip flexibility moves return by the same day offset", () => {
  const value=normalizeSearch({...raw,tripType:"roundtrip",returnDate:"2026-11-20",flexDays:1},prices,"2026-10-23");
  const scope=searchScope(value);
  assert.equal(scope.length,9);
  assert.ok(scope.some(row=>row.departure==="2026-11-11"&&row.returnDate==="2026-11-19"));
  assert.ok(!scope.some(row=>row.departure==="2026-11-11"&&row.returnDate==="2026-11-21"));
});
test("rejects off-scope offers and lookalike or credentialed source URLs", () => {
  const wrap=(entry)=>({summary:"Consulta",offers:[entry],coverage:[],attention:[]});
  assert.throws(()=>normalizeResult(wrap({...offer(),destination:"LIS"}),input()),/escopo/);
  assert.throws(()=>normalizeResult(wrap({...offer(),source:"https://latamairlines.com.attacker.test"}),input()),/fonte|Fonte/);
  assert.throws(()=>normalizeResult(wrap({...offer(),source:"https://token@latamairlines.com"}),input()),/fonte|Fonte/);
});
test("errors never count as no availability and unknown timestamps stay incomplete", () => {
  const base={summary:"Consulta parcial",offers:[],attention:[]};
  const coverage=searchScope(input()).map(row=>({...row,state:"technical_error",note:"Falha",source:"",checkedAt:null}));
  assert.equal(resultStatus(normalizeResult({...base,coverage},input()),input()),"failed");
  const observed=coverage.map(row=>({...row,state:"no_results",source:"https://www.latamairlines.com",checkedAt:"2026-10-23T19:00:00Z"}));
  assert.equal(resultStatus(normalizeResult({...base,coverage:observed},input()),input()),"completed");
  assert.equal(resultStatus(normalizeResult({...base,coverage:observed.map(row=>({...row,checkedAt:null}))},input()),input()),"failed");
});
