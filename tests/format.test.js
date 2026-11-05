import { test } from "node:test";
import assert from "node:assert/strict";
import { formatRemaining, clampPercent, usageLevel, windowLabel, formatPercent } from "../src/token-gage/format.js";
import { MIN, HOUR, DAY } from "./helpers.js";

test("formatRemaining: 1시간 미만은 분만", () => {
  assert.equal(formatRemaining(35 * MIN + 59 * 1000, 0), "35m");
});

test("formatRemaining: 하루 미만은 시간과 분", () => {
  assert.equal(formatRemaining(4 * HOUR + 10 * MIN + 30 * 1000, 0), "4h 10m");
});

test("formatRemaining: 하루 이상은 일과 시간", () => {
  assert.equal(formatRemaining(2 * DAY + 7 * HOUR + 59 * MIN, 0), "2d 7h");
});

test("formatRemaining: 1분 미만이거나 이미 지났으면 '곧'", () => {
  assert.equal(formatRemaining(30 * 1000, 0), "곧");
  assert.equal(formatRemaining(-5 * MIN, 0), "곧");
});

test("formatRemaining: 리셋 시각을 모르면 빈 문자열", () => {
  assert.equal(formatRemaining(null, 0), "");
  assert.equal(formatRemaining(Number.NaN, 0), "");
});

test("clampPercent: 0~100 정수로 맞추고 숫자가 아니면 null", () => {
  assert.equal(clampPercent(42.6), 43);
  assert.equal(clampPercent(-3), 0);
  assert.equal(clampPercent(140), 100);
  assert.equal(clampPercent("12"), null);
  assert.equal(clampPercent(Number.NaN), null);
  assert.equal(clampPercent(undefined), null);
});

test("formatPercent", () => {
  assert.equal(formatPercent(93), "93%");
});

test("usageLevel: 70 미만 ok, 70~89 warn, 90 이상 critical", () => {
  assert.equal(usageLevel(0), "ok");
  assert.equal(usageLevel(69), "ok");
  assert.equal(usageLevel(70), "warn");
  assert.equal(usageLevel(89), "warn");
  assert.equal(usageLevel(90), "critical");
  assert.equal(usageLevel(100), "critical");
});

test("windowLabel: 분 단위 창 길이를 짧은 이름으로", () => {
  assert.equal(windowLabel(300), "5h");
  assert.equal(windowLabel(1440), "일간");
  assert.equal(windowLabel(10080), "주간");
  assert.equal(windowLabel(43200), "월간");
  assert.equal(windowLabel(120), "2h");
  assert.equal(windowLabel(null), "");
});
