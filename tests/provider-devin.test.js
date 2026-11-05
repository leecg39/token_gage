import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDevinCredentials, parseDevinStatus, fetchDevin } from "../mods/token-gage/provider-devin.js";
import { NOW, jsonFixture, fakeFetch, fakeFiles, baseDeps } from "./helpers.js";

const TOML = [
  'windsurf_api_key = "key-devin"',
  'api_server_url = "https://server.codeium.com"',
  'devin_webapp_host = "app.devin.ai"',
].join("\n");
const CRED_PATH = "/Users/me/.local/share/devin/credentials.toml";

test("parseDevinCredentials: 필요한 키를 읽는다", () => {
  assert.deepEqual(parseDevinCredentials(TOML), { apiKey: "key-devin", serverUrl: "https://server.codeium.com" });
});

test("parseDevinCredentials: 키가 없으면 null, 서버 주소는 기본값", () => {
  assert.equal(parseDevinCredentials("foo = 1"), null);
  assert.equal(parseDevinCredentials(null), null);
  assert.deepEqual(parseDevinCredentials('windsurf_api_key = "k"'), { apiKey: "k", serverUrl: "https://server.codeium.com" });
});

test("parseDevinStatus: 남은 비율을 사용률로 바꾼다", () => {
  const r = parseDevinStatus(jsonFixture("devin-status.json"), NOW);
  assert.equal(r.status, "ok");
  assert.deepEqual(r.windows, [
    { label: "일간", usedPercent: 0, resetsAt: 1793952000000, group: null },
    { label: "주간", usedPercent: 40, resetsAt: 1794124800000, group: null },
  ]);
});

test("parseDevinStatus: 숨김 설정된 창은 빼고, planStatus가 없으면 오류", () => {
  const body = jsonFixture("devin-status.json");
  const hidden = {
    userStatus: { planStatus: { ...body.userStatus.planStatus, planInfo: { hideDailyQuota: true } } },
  };
  assert.deepEqual(parseDevinStatus(hidden, NOW).windows.map((w) => w.label), ["주간"]);
  assert.equal(parseDevinStatus({}, NOW).status, "error");
});

test("fetchDevin: GetUserStatus를 Connect JSON으로 부른다", async () => {
  const http = fakeFetch([{ status: 200, body: jsonFixture("devin-status.json") }]);
  const r = await fetchDevin(baseDeps({ readTextFile: fakeFiles({ [CRED_PATH]: TOML }), fetch: http.fn }));
  assert.equal(r.status, "ok");
  const call = http.calls[0];
  assert.equal(call.url, "https://server.codeium.com/exa.seat_management_pb.SeatManagementService/GetUserStatus");
  assert.equal(call.options.method, "POST");
  assert.equal(call.options.headers["Content-Type"], "application/json");
  assert.equal(JSON.parse(call.options.body).metadata.apiKey, "key-devin");
});

test("fetchDevin: 자격 증명이 없으면 로그인 안내", async () => {
  const r = await fetchDevin(baseDeps({ readTextFile: fakeFiles({}) }));
  assert.equal(r.status, "login");
});

test("fetchDevin: 401은 로그인 안내, 503은 오류, 예외도 오류", async () => {
  const deps = (resp) => baseDeps({ readTextFile: fakeFiles({ [CRED_PATH]: TOML }), fetch: fakeFetch([resp]).fn });
  assert.equal((await fetchDevin(deps({ status: 401, body: {} }))).status, "login");
  assert.equal((await fetchDevin(deps({ status: 503, body: {} }))).status, "error");
  assert.equal((await fetchDevin(deps(new Error("x")))).status, "error");
});
