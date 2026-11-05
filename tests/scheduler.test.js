import { test } from "node:test";
import assert from "node:assert/strict";
import { isDue, dueProviders, mergeResult, applyResult } from "../mods/token-gage/scheduler.js";
import { okResult, errorResult, loginResult, makeWindow } from "../mods/token-gage/model.js";
import { NOW, MIN } from "./helpers.js";

const P = { id: "claude", intervalMs: 2 * MIN };
const Q = { id: "codex", intervalMs: 2 * MIN };

test("isDue: 결과가 없으면 바로 조회", () => {
  assert.equal(isDue(P, undefined, NOW), true);
});

test("isDue: 주기가 지나야 다시 조회", () => {
  const r = okResult("claude", [makeWindow({ label: "5h", usedPercent: 1 })], NOW);
  assert.equal(isDue(P, r, NOW + MIN), false);
  assert.equal(isDue(P, r, NOW + 2 * MIN), true);
});

test("isDue: 오류여도 주기보다 자주 부르지 않는다(429 등에서 부하 방지)", () => {
  const r = errorResult("claude", "HTTP 429", NOW);
  assert.equal(isDue(P, r, NOW + MIN), false);
  assert.equal(isDue(P, r, NOW + 2 * MIN), true);
});

test("dueProviders: 조회 중인 서비스는 빼고 고른다", () => {
  const state = { codex: okResult("codex", [makeWindow({ label: "주간", usedPercent: 1 })], NOW) };
  const ids = dueProviders([P, Q], state, new Set(), NOW + MIN).map((p) => p.id);
  assert.deepEqual(ids, ["claude"]);
  assert.deepEqual(dueProviders([P, Q], state, new Set(["claude"]), NOW + MIN), []);
});

test("dueProviders: force면 조회 중이 아닌 서비스를 모두 고른다", () => {
  const state = { codex: okResult("codex", [makeWindow({ label: "주간", usedPercent: 1 })], NOW) };
  const ids = dueProviders([P, Q], state, new Set(["claude"]), NOW, true).map((p) => p.id);
  assert.deepEqual(ids, ["codex"]);
});

test("mergeResult: 새 결과가 성공이면 그대로", () => {
  const prev = okResult("claude", [makeWindow({ label: "5h", usedPercent: 1 })], NOW);
  const next = okResult("claude", [makeWindow({ label: "5h", usedPercent: 2 })], NOW + MIN);
  assert.equal(mergeResult(prev, next), next);
});

test("mergeResult: 오류면 직전 숫자를 지키고 stale 표시", () => {
  const prev = okResult("claude", [makeWindow({ label: "5h", usedPercent: 1 })], NOW);
  const next = errorResult("claude", "네트워크 오류", NOW + MIN);
  const merged = mergeResult(prev, next);
  assert.deepEqual(merged, { ...prev, stale: true, message: "네트워크 오류", updatedAt: NOW + MIN });
  assert.notEqual(merged, prev);
  assert.equal(prev.stale, undefined);
});

test("mergeResult: 로그인 필요는 직전 숫자 대신 안내를 보인다", () => {
  const prev = okResult("claude", [makeWindow({ label: "5h", usedPercent: 1 })], NOW);
  const next = loginResult("claude", "Claude Code를 실행하세요", NOW + MIN);
  assert.equal(mergeResult(prev, next), next);
});

test("mergeResult: 직전 값이 없으면 오류 그대로", () => {
  const next = errorResult("claude", "x", NOW);
  assert.equal(mergeResult(undefined, next), next);
});

test("applyResult: 상태를 바꾸지 않고 새 객체를 돌려준다", () => {
  const state = Object.freeze({});
  const r = okResult("claude", [makeWindow({ label: "5h", usedPercent: 1 })], NOW);
  const next = applyResult(state, r);
  assert.deepEqual(next, { claude: r });
  assert.deepEqual(state, {});
});
