// Codex: ~/.codex/auth.json의 ChatGPT 토큰으로 wham/usage를 부른다.

import {
  okResult, errorResult, loginResult, httpFailure, makeWindow, parseTimeMs, isObject,
  safeJsonParse, describeError,
} from "./model.js";
import { windowLabel } from "./format.js";

const ID = "codex";
const USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
const LOGIN_MESSAGE = "Codex를 실행하세요";

function toWindow(entry, now) {
  if (!isObject(entry)) return null;
  const minutes = typeof entry.limit_window_seconds === "number" ? entry.limit_window_seconds / 60 : null;
  const resetsAt = parseTimeMs(entry.reset_at)
    ?? (typeof entry.reset_after_seconds === "number" ? now + entry.reset_after_seconds * 1000 : null);
  const w = makeWindow({ label: windowLabel(minutes), usedPercent: entry.used_percent, resetsAt });
  return w ? { window: w, minutes: minutes ?? Number.MAX_SAFE_INTEGER } : null;
}

export function parseCodexUsage(body, now) {
  const limits = isObject(body) ? body.rate_limit : null;
  if (!isObject(limits)) return errorResult(ID, "Codex 응답에 rate_limit이 없습니다", now);
  const windows = [toWindow(limits.primary_window, now), toWindow(limits.secondary_window, now)]
    .filter(Boolean)
    .sort((a, b) => a.minutes - b.minutes)
    .map((entry) => entry.window);
  return okResult(ID, windows, now);
}

async function readAuth(readTextFile, home) {
  const text = await readTextFile(`${home()}/.codex/auth.json`);
  if (text === null) return { kind: "missing" };
  const parsed = safeJsonParse(text);
  if (!parsed.ok) return { kind: "invalid" };
  const tokens = isObject(parsed.value) ? parsed.value.tokens : null;
  if (!isObject(tokens) || typeof tokens.access_token !== "string") return { kind: "missing" };
  return { kind: "ok", token: tokens.access_token, accountId: tokens.account_id };
}

export async function fetchCodex({ readTextFile, fetch, home, now }) {
  try {
    const auth = await readAuth(readTextFile, home);
    if (auth.kind === "missing") return loginResult(ID, "Codex 로그인이 필요합니다", now());
    if (auth.kind === "invalid") return errorResult(ID, "Codex auth.json을 읽을 수 없습니다", now());
    const headers = { Authorization: `Bearer ${auth.token}`, Accept: "application/json", "User-Agent": "codex-cli" };
    const withAccount = typeof auth.accountId === "string" ? { ...headers, "ChatGPT-Account-Id": auth.accountId } : headers;
    const res = await fetch(USAGE_URL, { headers: withAccount });
    if (!res.ok) return httpFailure(ID, "Codex", res.status, now(), LOGIN_MESSAGE);
    return parseCodexUsage(await res.json(), now());
  } catch (error) {
    return errorResult(ID, `Codex 사용량 조회 실패: ${describeError(error)}`, now());
  }
}
