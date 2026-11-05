import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCodexUsage, fetchCodex } from "../mods/token-gage/provider-codex.js";
import { NOW, jsonFixture, fakeFetch, fakeFiles, baseDeps } from "./helpers.js";

const AUTH = JSON.stringify({ tokens: { access_token: "tok-codex", account_id: "acc-1" } });
const files = (text) => fakeFiles({ "/Users/me/.codex/auth.json": text });

test("parseCodexUsage: 주간 창(primary)을 만든다", () => {
  const r = parseCodexUsage(jsonFixture("codex-usage.json"), NOW);
  assert.equal(r.status, "ok");
  assert.deepEqual(r.windows, [{ label: "주간", usedPercent: 93, resetsAt: 1794328688000, group: null }]);
});

test("parseCodexUsage: 5시간 창이 있으면 먼저 보여 준다", () => {
  const body = {
    rate_limit: {
      primary_window: { used_percent: 40, limit_window_seconds: 604800, reset_at: 1794328688 },
      secondary_window: { used_percent: 12, limit_window_seconds: 18000, reset_after_seconds: 600 },
    },
  };
  const r = parseCodexUsage(body, NOW);
  assert.deepEqual(r.windows.map((w) => w.label), ["5h", "주간"]);
  assert.equal(r.windows[0].resetsAt, NOW + 600 * 1000);
});

test("parseCodexUsage: rate_limit이 없으면 오류", () => {
  assert.equal(parseCodexUsage({ plan_type: "pro" }, NOW).status, "error");
});

test("fetchCodex: auth.json 토큰과 계정 ID로 요청", async () => {
  const http = fakeFetch([{ status: 200, body: jsonFixture("codex-usage.json") }]);
  const r = await fetchCodex(baseDeps({ readTextFile: files(AUTH), fetch: http.fn }));
  assert.equal(r.status, "ok");
  assert.equal(http.calls[0].url, "https://chatgpt.com/backend-api/wham/usage");
  assert.equal(http.calls[0].options.headers.Authorization, "Bearer tok-codex");
  assert.equal(http.calls[0].options.headers["ChatGPT-Account-Id"], "acc-1");
});

test("fetchCodex: auth.json이 없거나 토큰이 없으면 로그인 안내", async () => {
  assert.equal((await fetchCodex(baseDeps({ readTextFile: files(null) }))).status, "login");
  assert.equal((await fetchCodex(baseDeps({ readTextFile: files("{}") }))).status, "login");
});

test("fetchCodex: auth.json이 깨졌으면 오류", async () => {
  assert.equal((await fetchCodex(baseDeps({ readTextFile: files("{oops") }))).status, "error");
});

test("fetchCodex: 401은 로그인 안내, 500은 오류", async () => {
  const r401 = await fetchCodex(baseDeps({ readTextFile: files(AUTH), fetch: fakeFetch([{ status: 401, body: {} }]).fn }));
  assert.equal(r401.status, "login");
  const r500 = await fetchCodex(baseDeps({ readTextFile: files(AUTH), fetch: fakeFetch([{ status: 500, body: {} }]).fn }));
  assert.equal(r500.status, "error");
});

test("fetchCodex: 예외는 오류 결과", async () => {
  const r = await fetchCodex(baseDeps({ readTextFile: files(AUTH), fetch: fakeFetch([new Error("down")]).fn }));
  assert.equal(r.status, "error");
});
