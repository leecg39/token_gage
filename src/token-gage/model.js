// 서비스마다 다른 응답을 하나의 결과 형태로 맞춘다.
// 결과: { id, status: "ok" | "error" | "login", windows: Window[], message, updatedAt }
// Window: { label, usedPercent, resetsAt, group }

import { clampPercent } from "./format.js";

const SECONDS_LIMIT = 1e12; // 이보다 작은 숫자는 유닉스 초로 본다.

export function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ISO 문자열, 유닉스 초(숫자/숫자 문자열), ms 숫자를 ms로. 잘못되면 null.
export function parseTimeMs(value) {
  if (typeof value === "number") return toMs(value);
  if (typeof value !== "string" || value.trim() === "") return null;
  if (/^\d+(\.\d+)?$/.test(value.trim())) return toMs(Number(value));
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toMs(n) {
  if (!Number.isFinite(n) || n <= 0) return null;
  return n < SECONDS_LIMIT ? Math.round(n * 1000) : Math.round(n);
}

export function makeWindow({ label, usedPercent, resetsAt = null, group = null }) {
  const percent = clampPercent(usedPercent);
  if (percent === null) return null;
  return { label, usedPercent: percent, resetsAt: resetsAt ?? null, group: group ?? null };
}

export function okResult(id, windows, now) {
  const valid = windows.filter(Boolean);
  if (valid.length === 0) return errorResult(id, "사용량 정보가 응답에 없습니다", now);
  return { id, status: "ok", windows: valid, message: null, updatedAt: now };
}

export function errorResult(id, message, now) {
  return { id, status: "error", windows: [], message, updatedAt: now };
}

export function loginResult(id, message, now) {
  return { id, status: "login", windows: [], message, updatedAt: now };
}

// HTTP 상태를 결과로: 401/403은 로그인 필요, 나머지는 오류.
export function httpFailure(id, label, status, now, loginMessage) {
  if (status === 401 || status === 403) return loginResult(id, loginMessage, now);
  return errorResult(id, `${label} 요청 실패 (HTTP ${status})`, now);
}

export function peakPercent(windows) {
  return windows.reduce((max, w) => Math.max(max, w.usedPercent), 0);
}

export function safeJsonParse(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, value: null };
  }
}

export function describeError(error) {
  return error instanceof Error ? error.message : "알 수 없는 오류";
}
