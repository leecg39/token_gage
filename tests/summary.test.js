import { test } from "node:test";
import assert from "node:assert/strict";
import { groupWindows, tooltipText, segmentKind } from "../src/token-gage/summary.js";
import { okResult, errorResult, loginResult, makeWindow } from "../src/token-gage/model.js";
import { NOW, HOUR, MIN } from "./helpers.js";

const w = (label, usedPercent, resetsAt, group) => makeWindow({ label, usedPercent, resetsAt, group });

test("groupWindows: 순서를 지키며 그룹별로 묶는다", () => {
  const groups = groupWindows([w("5h", 1, null, "Gemini"), w("주간", 2, null, "Gemini"), w("5h", 3, null, "Claude/GPT")]);
  assert.deepEqual(groups.map((g) => [g.group, g.windows.length]), [["Gemini", 2], ["Claude/GPT", 1]]);
});

test("groupWindows: 그룹이 없으면 하나로", () => {
  const groups = groupWindows([w("5h", 1), w("주간", 2)]);
  assert.deepEqual(groups.map((g) => [g.group, g.windows.length]), [[null, 2]]);
});

test("segmentKind: 상태별 표시 종류", () => {
  assert.equal(segmentKind(undefined), "loading");
  assert.equal(segmentKind(okResult("a", [w("5h", 1)], NOW)), "usage");
  assert.equal(segmentKind(loginResult("a", "x", NOW)), "notice");
  assert.equal(segmentKind(errorResult("a", "x", NOW)), "notice");
  assert.equal(segmentKind({ ...okResult("a", [w("5h", 1)], NOW), stale: true }), "usage");
});

test("tooltipText: 창마다 사용률과 리셋까지 남은 시간", () => {
  const entry = okResult("claude", [w("5h", 31, NOW + 3 * HOUR + 20 * MIN), w("주간", 59, null)], NOW);
  assert.equal(tooltipText("Claude", entry, NOW), "Claude\n5h: 31% 사용 · 3h 20m 후 리셋\n주간: 59% 사용");
});

test("tooltipText: 그룹 이름과 오래된 값 경고", () => {
  const entry = { ...okResult("antigravity", [w("5h", 0, NOW + 30 * 1000, "Gemini")], NOW), stale: true, message: "agy 실행 실패" };
  assert.equal(tooltipText("Antigravity", entry, NOW), "Antigravity\nGemini 5h: 0% 사용 · 곧 리셋\n⚠ 마지막 조회 실패: agy 실행 실패");
});

test("tooltipText: 불러오는 중, 안내, 오류", () => {
  assert.equal(tooltipText("Grok", undefined, NOW), "Grok: 불러오는 중");
  assert.equal(tooltipText("Grok", loginResult("grok", "Grok을 실행하세요", NOW), NOW), "Grok: Grok을 실행하세요");
  assert.equal(tooltipText("Devin", errorResult("devin", "HTTP 500", NOW), NOW), "Devin: HTTP 500");
});
