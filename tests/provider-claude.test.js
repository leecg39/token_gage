import { test } from "node:test";
import assert from "node:assert/strict";
import { parseClaudeUsage, fetchClaude } from "../mods/token-gage/provider-claude.js";
import { NOW, HOUR, jsonFixture, fakeExec, fakeFetch, baseDeps } from "./helpers.js";

const CRED = JSON.stringify({ claudeAiOauth: { accessToken: "tok-claude", expiresAt: NOW + HOUR } });
const keychain = (stdout, code = 0) => fakeExec((cmd) => (cmd === "security" ? { code, stdout } : { code: 1 }));

test("parseClaudeUsage: 5시간·주간 창을 만든다", () => {
  const r = parseClaudeUsage(jsonFixture("claude-usage.json"), NOW);
  assert.equal(r.status, "ok");
  assert.deepEqual(r.windows, [
    { label: "5h", usedPercent: 31, resetsAt: Date.parse("2026-11-05T11:30:00.233511+00:00"), group: null },
    { label: "주간", usedPercent: 59, resetsAt: Date.parse("2026-11-07T15:00:00.233533+00:00"), group: null },
  ]);
});

test("parseClaudeUsage: 형식이 다르면 오류", () => {
  assert.equal(parseClaudeUsage(null, NOW).status, "error");
  assert.equal(parseClaudeUsage({ five_hour: null, seven_day: null }, NOW).status, "error");
});

test("fetchClaude: 키체인 토큰으로 사용량 API를 부른다", async () => {
  const http = fakeFetch([{ status: 200, body: jsonFixture("claude-usage.json") }]);
  const exec = keychain(CRED);
  const r = await fetchClaude(baseDeps({ exec: exec.fn, fetch: http.fn }));
  assert.equal(r.status, "ok");
  assert.deepEqual(exec.calls[0], { command: "security", args: ["find-generic-password", "-s", "Claude Code-credentials", "-w"] });
  assert.equal(http.calls[0].url, "https://api.anthropic.com/api/oauth/usage");
  assert.equal(http.calls[0].options.headers.Authorization, "Bearer tok-claude");
  assert.equal(http.calls[0].options.headers["anthropic-beta"], "oauth-2025-04-20");
});

test("fetchClaude: 토큰이 만료됐으면 요청하지 않고 실행 안내", async () => {
  const expired = JSON.stringify({ claudeAiOauth: { accessToken: "t", expiresAt: NOW - 1 } });
  const http = fakeFetch([]);
  const r = await fetchClaude(baseDeps({ exec: keychain(expired).fn, fetch: http.fn }));
  assert.equal(r.status, "login");
  assert.equal(http.calls.length, 0);
});

test("fetchClaude: 키체인 항목이 없으면 로그인 안내", async () => {
  const r = await fetchClaude(baseDeps({ exec: keychain("", 44).fn }));
  assert.equal(r.status, "login");
});

test("fetchClaude: 키체인 내용이 JSON이 아니면 오류", async () => {
  const r = await fetchClaude(baseDeps({ exec: keychain("garbage").fn }));
  assert.equal(r.status, "error");
});

test("fetchClaude: 401이면 로그인 안내, 429면 오류", async () => {
  const r401 = await fetchClaude(baseDeps({ exec: keychain(CRED).fn, fetch: fakeFetch([{ status: 401, body: {} }]).fn }));
  assert.equal(r401.status, "login");
  const r429 = await fetchClaude(baseDeps({ exec: keychain(CRED).fn, fetch: fakeFetch([{ status: 429, body: {} }]).fn }));
  assert.equal(r429.status, "error");
  assert.match(r429.message, /429/);
});

test("fetchClaude: 네트워크 예외는 오류 결과로 바꾼다", async () => {
  const r = await fetchClaude(baseDeps({ exec: keychain(CRED).fn, fetch: fakeFetch([new Error("offline")]).fn }));
  assert.equal(r.status, "error");
  assert.doesNotMatch(r.message, /tok-claude/);
});
