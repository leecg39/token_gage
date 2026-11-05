import { test } from "node:test";
import assert from "node:assert/strict";
import {
  okResult, errorResult, loginResult, makeWindow, parseTimeMs, peakPercent, isObject,
} from "../mods/token-gage/model.js";
import { NOW } from "./helpers.js";

test("parseTimeMs: ISO 문자열", () => {
  assert.equal(parseTimeMs("2026-11-07T02:18:04Z"), Date.parse("2026-11-07T02:18:04Z"));
});

test("parseTimeMs: 유닉스 초(숫자·문자열)는 ms로 바꾼다", () => {
  assert.equal(parseTimeMs(1794328688), 1794328688000);
  assert.equal(parseTimeMs("1793952000"), 1793952000000);
});

test("parseTimeMs: 이미 ms인 숫자는 그대로", () => {
  assert.equal(parseTimeMs(1794328688000), 1794328688000);
});

test("parseTimeMs: 잘못된 값은 null", () => {
  assert.equal(parseTimeMs(null), null);
  assert.equal(parseTimeMs("not a date"), null);
  assert.equal(parseTimeMs({}), null);
  assert.equal(parseTimeMs(""), null);
});

test("makeWindow: 사용률을 정리해서 새 객체로 만든다", () => {
  const w = makeWindow({ label: "5h", usedPercent: 30.6, resetsAt: 123, group: "Gemini" });
  assert.deepEqual(w, { label: "5h", usedPercent: 31, resetsAt: 123, group: "Gemini" });
});

test("makeWindow: 사용률이 숫자가 아니면 null", () => {
  assert.equal(makeWindow({ label: "5h", usedPercent: undefined, resetsAt: 1 }), null);
});

test("makeWindow: group과 resetsAt은 없어도 된다", () => {
  assert.deepEqual(makeWindow({ label: "주간", usedPercent: 5 }), { label: "주간", usedPercent: 5, resetsAt: null, group: null });
});

test("결과 생성기", () => {
  const w = [makeWindow({ label: "5h", usedPercent: 10 })];
  assert.deepEqual(okResult("claude", w, NOW), { id: "claude", status: "ok", windows: w, message: null, updatedAt: NOW });
  assert.deepEqual(errorResult("codex", "실패", NOW), { id: "codex", status: "error", windows: [], message: "실패", updatedAt: NOW });
  assert.deepEqual(loginResult("grok", "실행 필요", NOW), { id: "grok", status: "login", windows: [], message: "실행 필요", updatedAt: NOW });
});

test("okResult: 창이 하나도 없으면 오류로 바꾼다", () => {
  const r = okResult("devin", [], NOW);
  assert.equal(r.status, "error");
  assert.match(r.message, /사용량/);
});

test("okResult: null 창은 걸러 낸다", () => {
  const r = okResult("devin", [null, makeWindow({ label: "주간", usedPercent: 1 })], NOW);
  assert.equal(r.windows.length, 1);
});

test("peakPercent: 가장 높은 사용률, 없으면 0", () => {
  assert.equal(peakPercent([{ usedPercent: 20 }, { usedPercent: 57 }]), 57);
  assert.equal(peakPercent([]), 0);
});

test("isObject", () => {
  assert.equal(isObject({}), true);
  assert.equal(isObject(null), false);
  assert.equal(isObject([]), false);
  assert.equal(isObject("x"), false);
});
