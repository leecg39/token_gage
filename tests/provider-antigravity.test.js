import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseAgyVersion, versionAtLeast, parseAgyUsage, groupLabel, fetchAntigravity,
} from "../src/token-gage/provider-antigravity.js";
import { NOW, fixture, fakeExec, baseDeps } from "./helpers.js";

test("parseAgyVersion / versionAtLeast", () => {
  assert.equal(parseAgyVersion("1.5.0\n"), "1.5.0");
  assert.equal(parseAgyVersion("agy version 1.12.3 (abc)"), "1.12.3");
  assert.equal(parseAgyVersion("nothing"), null);
  assert.equal(versionAtLeast("1.5.0", "1.1.11"), true);
  assert.equal(versionAtLeast("1.1.11", "1.1.11"), true);
  assert.equal(versionAtLeast("1.1.9", "1.1.11"), false);
  assert.equal(versionAtLeast("0.9.0", "1.1.11"), false);
});

test("groupLabel: 그룹 이름을 짧게", () => {
  assert.equal(groupLabel("Gemini Models"), "Gemini");
  assert.equal(groupLabel("Claude and GPT models"), "Claude/GPT");
});

test("parseAgyUsage: 그룹별 5h·주간 창, 5h가 먼저", () => {
  const r = parseAgyUsage(fixture("agy-usage.jsonl"), NOW);
  assert.equal(r.status, "ok");
  assert.deepEqual(r.windows, [
    { group: "Gemini", label: "5h", usedPercent: 0, resetsAt: Date.parse("2026-11-05T13:09:33Z") },
    { group: "Gemini", label: "주간", usedPercent: 18, resetsAt: Date.parse("2026-11-07T02:18:04Z") },
    { group: "Claude/GPT", label: "5h", usedPercent: 0, resetsAt: Date.parse("2026-11-05T13:09:33Z") },
    { group: "Claude/GPT", label: "주간", usedPercent: 0, resetsAt: Date.parse("2026-11-12T08:09:33Z") },
  ]);
});

test("parseAgyUsage: 성공 줄이 없으면 null", () => {
  assert.equal(parseAgyUsage('{"status":"ERROR","error":"x"}\nplain', NOW), null);
  assert.equal(parseAgyUsage("", NOW), null);
});

const agy = (version, usage) => fakeExec((_cmd, args) => {
  if (args.includes("--version")) return version;
  if (args.includes("/usage")) return usage;
  return { code: 1 };
});

test("fetchAntigravity: 버전 확인 뒤 /usage를 자동 업데이트 없이 부른다", async () => {
  const exec = agy({ stdout: "1.5.0" }, { stdout: fixture("agy-usage.jsonl") });
  const r = await fetchAntigravity(baseDeps({ exec: exec.fn }));
  assert.equal(r.status, "ok");
  assert.equal(r.windows.length, 4);
  const usageCall = exec.calls[1];
  assert.equal(usageCall.command, "/usr/bin/env");
  assert.deepEqual(usageCall.args, [
    "AGY_CLI_DISABLE_AUTO_UPDATE=true", "/Users/me/.local/bin/agy",
    "-p", "/usage", "--output-format", "json", "--print-timeout", "20s",
  ]);
});

test("fetchAntigravity: 낮은 버전이면 /usage를 부르지 않는다(할당량 소모 방지)", async () => {
  const exec = agy({ stdout: "1.1.9" }, { stdout: "" });
  const r = await fetchAntigravity(baseDeps({ exec: exec.fn }));
  assert.equal(r.status, "error");
  assert.match(r.message, /1\.1\.11/);
  assert.equal(exec.calls.length, 1);
});

test("fetchAntigravity: agy가 없으면 오류", async () => {
  const r = await fetchAntigravity(baseDeps({ exec: agy(new Error("not found"), {}).fn }));
  assert.equal(r.status, "error");
});

test("fetchAntigravity: 로그인 필요 문구를 알아본다", async () => {
  const exec = agy({ stdout: "1.5.0" }, { code: 1, stdout: "", stderr: "Authentication required. Please visit the URL" });
  assert.equal((await fetchAntigravity(baseDeps({ exec: exec.fn }))).status, "login");
});

test("fetchAntigravity: 결과를 못 읽으면 오류", async () => {
  const exec = agy({ stdout: "1.5.0" }, { code: 0, stdout: "???" });
  assert.equal((await fetchAntigravity(baseDeps({ exec: exec.fn }))).status, "error");
});
