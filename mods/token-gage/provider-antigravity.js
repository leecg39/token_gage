// Antigravity: agy CLI의 `/usage` 명령(JSON 출력)을 읽는다.
// agy 1.1.11 미만은 /usage를 프롬프트로 처리해 할당량을 쓰므로 먼저 버전을 확인한다.

import {
  okResult, errorResult, loginResult, makeWindow, parseTimeMs, isObject, safeJsonParse, describeError,
} from "./model.js";

const ID = "antigravity";
const MIN_VERSION = "1.1.11";
const ENV = "AGY_CLI_DISABLE_AUTO_UPDATE=true";
const USAGE_ARGS = ["-p", "/usage", "--output-format", "json", "--print-timeout", "20s"];
const WINDOW_ORDER = { "5h": 0, weekly: 1 };
const WINDOW_LABELS = { "5h": "5h", weekly: "주간" };
const LOGIN_HINTS = ["authentication required", "not logged in", "not signed in", "run agy login", "unauthenticated"];

export function parseAgyVersion(text) {
  const match = typeof text === "string" ? text.match(/(\d+)\.(\d+)\.(\d+)/) : null;
  return match ? match[0] : null;
}

export function versionAtLeast(version, minimum) {
  const a = version.split(".").map(Number);
  const b = minimum.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return true;
}

export function groupLabel(name) {
  return name.replace(/\s+models?$/i, "").replace(/\s+and\s+/i, "/").trim();
}

function bucketWindow(group, bucket) {
  if (!isObject(bucket) || bucket.disabled === true || typeof bucket.remaining_fraction !== "number") return null;
  const label = WINDOW_LABELS[bucket.window] ?? String(bucket.window ?? "");
  const w = makeWindow({ group, label, usedPercent: (1 - bucket.remaining_fraction) * 100, resetsAt: parseTimeMs(bucket.reset_time) });
  return w ? { window: w, order: WINDOW_ORDER[bucket.window] ?? 9 } : null;
}

function groupWindows(group) {
  if (!isObject(group) || typeof group.name !== "string" || !Array.isArray(group.buckets)) return [];
  const label = groupLabel(group.name);
  return group.buckets
    .map((b) => bucketWindow(label, b))
    .filter(Boolean)
    .sort((a, b) => a.order - b.order)
    .map((entry) => entry.window);
}

function usageLine(line) {
  const parsed = line.trim().startsWith("{") ? safeJsonParse(line.trim()) : { ok: false };
  const value = parsed.ok ? parsed.value : null;
  const ok = isObject(value) && value.status === "SUCCESS" && isObject(value.command) && value.command.name === "usage";
  return ok && isObject(value.command.data) && Array.isArray(value.command.data.groups) ? value.command.data : null;
}

// 출력에서 성공 줄을 찾아 창 목록을 만든다. 없으면 null.
export function parseAgyUsage(stdout, now) {
  const data = String(stdout ?? "").split("\n").map(usageLine).find(Boolean);
  if (!data) return null;
  return okResult(ID, data.groups.flatMap(groupWindows), now);
}

export async function fetchAntigravity({ exec, home, now }) {
  const agy = `${home()}/.local/bin/agy`;
  try {
    const versionOut = await exec("/usr/bin/env", [ENV, agy, "--version"]);
    const version = parseAgyVersion(`${versionOut.stdout}\n${versionOut.stderr}`);
    if (!version) return errorResult(ID, "agy 버전을 읽을 수 없습니다", now());
    if (!versionAtLeast(version, MIN_VERSION)) return errorResult(ID, `agy ${MIN_VERSION} 이상이 필요합니다 (현재 ${version})`, now());
    const out = await exec("/usr/bin/env", [ENV, agy, ...USAGE_ARGS]);
    const result = parseAgyUsage(out.stdout, now());
    if (result) return result;
    const text = `${out.stdout}\n${out.stderr}`.toLowerCase();
    if (LOGIN_HINTS.some((hint) => text.includes(hint))) return loginResult(ID, "agy로 Antigravity에 로그인하세요", now());
    return errorResult(ID, "Antigravity 사용량을 읽을 수 없습니다", now());
  } catch (error) {
    return errorResult(ID, `agy 실행 실패: ${describeError(error)}`, now());
  }
}
