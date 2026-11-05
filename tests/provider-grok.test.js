import { test } from "node:test";
import assert from "node:assert/strict";
import { pickGrokSession, parseGrokBilling, fetchGrok } from "../src/token-gage/provider-grok.js";
import { NOW, HOUR, jsonFixture, fakeFetch, fakeFiles, baseDeps } from "./helpers.js";

const AUTH_PATH = "/Users/me/.grok/auth.json";
const authFile = (expiresAt) => JSON.stringify({
  "https://auth.x.ai::client-1": { key: "tok-grok", user_id: "u1", expires_at: new Date(expiresAt).toISOString() },
});

test("pickGrokSession: auth.x.ai 항목의 토큰을 고른다", () => {
  const s = pickGrokSession(JSON.parse(authFile(NOW + HOUR)), NOW);
  assert.deepEqual(s, { token: "tok-grok", userId: "u1", expired: false });
});

test("pickGrokSession: 만료 1분 전부터는 만료로 본다", () => {
  assert.equal(pickGrokSession(JSON.parse(authFile(NOW + 30 * 1000)), NOW).expired, true);
});

test("pickGrokSession: 항목이 없으면 null", () => {
  assert.equal(pickGrokSession({}, NOW), null);
  assert.equal(pickGrokSession({ "https://auth.x.ai::x": { key: "" } }, NOW), null);
  assert.equal(pickGrokSession(null, NOW), null);
});

test("parseGrokBilling: 주간 크레딧 사용률", () => {
  const r = parseGrokBilling(jsonFixture("grok-billing.json"), NOW);
  assert.equal(r.status, "ok");
  assert.deepEqual(r.windows, [{ label: "주간", usedPercent: 43, resetsAt: Date.parse("2026-11-09T00:00:00Z"), group: null }]);
});

test("parseGrokBilling: 월 한도와 사용량으로 계산(대체 경로)", () => {
  const body = { monthlyLimit: { val: "200" }, used: { val: 50 }, billingPeriodEnd: "2026-12-01T00:00:00Z" };
  const r = parseGrokBilling(body, NOW);
  assert.deepEqual(r.windows, [{ label: "월간", usedPercent: 25, resetsAt: Date.parse("2026-12-01T00:00:00Z"), group: null }]);
});

test("parseGrokBilling: 사용률이 없으면 오류", () => {
  assert.equal(parseGrokBilling({ config: { subscriptionTier: "x" } }, NOW).status, "error");
  assert.equal(parseGrokBilling(null, NOW).status, "error");
});

test("fetchGrok: 유효한 토큰으로 billing을 부른다", async () => {
  const http = fakeFetch([{ status: 200, body: jsonFixture("grok-billing.json") }]);
  const r = await fetchGrok(baseDeps({ readTextFile: fakeFiles({ [AUTH_PATH]: authFile(NOW + HOUR) }), fetch: http.fn }));
  assert.equal(r.status, "ok");
  assert.equal(http.calls[0].url, "https://cli-chat-proxy.grok.com/v1/billing?format=credits");
  assert.equal(http.calls[0].options.headers.Authorization, "Bearer tok-grok");
  assert.equal(http.calls[0].options.headers["X-XAI-Token-Auth"], "xai-grok-cli");
  assert.equal(http.calls[0].options.headers["x-userid"], "u1");
});

test("fetchGrok: 만료 토큰이면 요청 없이 실행 안내", async () => {
  const http = fakeFetch([]);
  const r = await fetchGrok(baseDeps({ readTextFile: fakeFiles({ [AUTH_PATH]: authFile(NOW - HOUR) }), fetch: http.fn }));
  assert.equal(r.status, "login");
  assert.match(r.message, /Grok/);
  assert.equal(http.calls.length, 0);
});

test("fetchGrok: 파일이 없으면 로그인, 깨졌으면 오류", async () => {
  assert.equal((await fetchGrok(baseDeps())).status, "login");
  assert.equal((await fetchGrok(baseDeps({ readTextFile: fakeFiles({ [AUTH_PATH]: "{x" }) }))).status, "error");
});

test("fetchGrok: 401은 로그인 안내, 예외는 오류", async () => {
  const files = fakeFiles({ [AUTH_PATH]: authFile(NOW + HOUR) });
  assert.equal((await fetchGrok(baseDeps({ readTextFile: files, fetch: fakeFetch([{ status: 401, body: {} }]).fn }))).status, "login");
  assert.equal((await fetchGrok(baseDeps({ readTextFile: files, fetch: fakeFetch([new Error("x")]).fn }))).status, "error");
});
