import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveWorkspaceView } from "../lib/navigation.ts";

test("opens the calculator by default and for unknown links", () => {
  assert.equal(resolveWorkspaceView("", ""), "calculator");
  assert.equal(resolveWorkspaceView("", "#inexistente"), "calculator");
});

test("opens each travel workspace from a shared link", () => {
  assert.equal(resolveWorkspaceView("", "#comparar"), "compare");
  assert.equal(resolveWorkspaceView("", "#historico"), "history");
  assert.equal(resolveWorkspaceView("", "#orcamentos"), "quotes");
  assert.equal(resolveWorkspaceView("", "#combustivel"), "fuel");
});

test("preserves existing proposal links when they have no workspace hash", () => {
  assert.equal(resolveWorkspaceView("?orcamento=proposta", ""), "quotes");
  assert.equal(resolveWorkspaceView("?orcamento=proposta", "#calculadora"), "calculator");
});
