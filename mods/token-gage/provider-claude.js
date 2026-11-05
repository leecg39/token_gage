// Claude: Claude Code가 키체인에 저장한 OAuth 토큰으로 사용량 API를 부른다.
// 토큰은 갱신하지 않는다(갱신하면 Claude Code 로그인이 깨질 수 있다).

import {
  okResult, errorResult, loginResult, httpFailure, makeWindow, parseTimeMs, isObject,
  safeJsonParse, describeError,
} from "./model.js";

const ID = "claude";
const USAGE_URL = "https://api.anthropic.com/api/oauth/usage";
const KEYCHAIN_SERVICE = "Claude Code-credentials";
const LOGIN_MESSAGE = "Claude Code를 실행하세요";

export function parseClaudeUsage(body, now) {
  if (!isObject(body)) return errorResult(ID, "Claude 응답 형식이 다릅니다", now);
  const toWindow = (entry, label) => isObject(entry)
    ? makeWindow({ label, usedPercent: entry.utilization, resetsAt: parseTimeMs(entry.resets_at) })
    : null;
  return okResult(ID, [toWindow(body.five_hour, "5h"), toWindow(body.seven_day, "주간")], now);
}

async function readToken(exec) {
  const out = await exec("security", ["find-generic-password", "-s", KEYCHAIN_SERVICE, "-w"]);
  if (out.code !== 0) return { kind: "missing" };
  const parsed = safeJsonParse(out.stdout);
  const oauth = parsed.ok && isObject(parsed.value) ? parsed.value.claudeAiOauth : null;
  if (!isObject(oauth)) return { kind: "invalid" };
  if (typeof oauth.accessToken !== "string" || oauth.accessToken === "") return { kind: "missing" };
  return { kind: "ok", token: oauth.accessToken, expiresAt: oauth.expiresAt };
}

export async function fetchClaude({ exec, fetch, now }) {
  try {
    const cred = await readToken(exec);
    if (cred.kind === "missing") return loginResult(ID, "Claude Code 로그인이 필요합니다", now());
    if (cred.kind === "invalid") return errorResult(ID, "Claude 자격 증명을 읽을 수 없습니다", now());
    if (typeof cred.expiresAt === "number" && cred.expiresAt <= now()) return loginResult(ID, LOGIN_MESSAGE, now());
    const res = await fetch(USAGE_URL, {
      headers: { Authorization: `Bearer ${cred.token}`, "anthropic-beta": "oauth-2025-04-20", Accept: "application/json" },
    });
    if (!res.ok) return httpFailure(ID, "Claude", res.status, now(), LOGIN_MESSAGE);
    return parseClaudeUsage(await res.json(), now());
  } catch (error) {
    return errorResult(ID, `Claude 사용량 조회 실패: ${describeError(error)}`, now());
  }
}
