// Grok: grok CLI가 저장한 ~/.grok/auth.json 토큰으로 billing API를 부른다.
// 토큰은 1시간 남짓이면 만료되고 grok을 실행해야 갱신된다. 여기서는 갱신하지 않는다.

import {
  okResult, errorResult, loginResult, httpFailure, makeWindow, parseTimeMs, isObject,
  safeJsonParse, describeError,
} from "./model.js";

const ID = "grok";
const BILLING_URL = "https://cli-chat-proxy.grok.com/v1/billing?format=credits";
const AUTH_ISSUER = "https://auth.x.ai";
const EXPIRY_MARGIN_MS = 60 * 1000;
const LOGIN_MESSAGE = "Grok을 실행하세요";

function toSession(entry, now) {
  if (!isObject(entry) || typeof entry.key !== "string" || entry.key === "") return null;
  const expiresAt = parseTimeMs(entry.expires_at);
  return {
    token: entry.key,
    userId: typeof entry.user_id === "string" ? entry.user_id : null,
    expired: expiresAt !== null && expiresAt - now <= EXPIRY_MARGIN_MS,
  };
}

// auth.x.ai 항목 중 유효한 것을 먼저, 없으면 만료된 것이라도 고른다.
export function pickGrokSession(auth, now) {
  if (!isObject(auth)) return null;
  const sessions = Object.entries(auth)
    .filter(([key]) => key === AUTH_ISSUER || key.startsWith(`${AUTH_ISSUER}::`))
    .map(([, entry]) => toSession(entry, now))
    .filter(Boolean);
  return sessions.find((s) => !s.expired) ?? sessions[0] ?? null;
}

function numberValue(field) {
  const raw = isObject(field) ? field.val : field;
  const n = typeof raw === "string" ? Number.parseFloat(raw) : raw;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

export function parseGrokBilling(body, now) {
  const config = isObject(body) ? (isObject(body.config) ? body.config : body) : null;
  if (!config) return errorResult(ID, "Grok 응답 형식이 다릅니다", now);
  const period = isObject(config.currentPeriod) ? config.currentPeriod : {};
  const resetsAt = parseTimeMs(period.end ?? config.billingPeriodEnd);
  if (typeof config.creditUsagePercent === "number") {
    const label = period.type === "USAGE_PERIOD_TYPE_WEEKLY" ? "주간" : "기간";
    return okResult(ID, [makeWindow({ label, usedPercent: config.creditUsagePercent, resetsAt })], now);
  }
  const limit = numberValue(config.monthlyLimit);
  const used = numberValue(config.used);
  if (limit === null || used === null || limit <= 0) return errorResult(ID, "Grok 응답에 사용률이 없습니다", now);
  return okResult(ID, [makeWindow({ label: "월간", usedPercent: (used / limit) * 100, resetsAt })], now);
}

export async function fetchGrok({ readTextFile, fetch, home, now }) {
  try {
    const text = await readTextFile(`${home()}/.grok/auth.json`);
    if (text === null) return loginResult(ID, "grok login으로 로그인하세요", now());
    const parsed = safeJsonParse(text);
    if (!parsed.ok) return errorResult(ID, "Grok auth.json을 읽을 수 없습니다", now());
    const session = pickGrokSession(parsed.value, now());
    if (!session) return loginResult(ID, "grok login으로 로그인하세요", now());
    if (session.expired) return loginResult(ID, LOGIN_MESSAGE, now());
    const headers = { Authorization: `Bearer ${session.token}`, "X-XAI-Token-Auth": "xai-grok-cli", Accept: "application/json" };
    const res = await fetch(BILLING_URL, { headers: session.userId ? { ...headers, "x-userid": session.userId } : headers });
    if (!res.ok) return httpFailure(ID, "Grok", res.status, now(), LOGIN_MESSAGE);
    return parseGrokBilling(await res.json(), now());
  } catch (error) {
    return errorResult(ID, `Grok 사용량 조회 실패: ${describeError(error)}`, now());
  }
}
