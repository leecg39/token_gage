// Devin: devin CLI 자격 증명(credentials.toml)으로 Codeium GetUserStatus를 부른다.
// 응답은 "남은 비율"이므로 사용률 = 100 - 남은 비율.

import {
  okResult, errorResult, loginResult, httpFailure, makeWindow, parseTimeMs, isObject, describeError,
} from "./model.js";

const ID = "devin";
const DEFAULT_SERVER = "https://server.codeium.com";
const STATUS_PATH = "/exa.seat_management_pb.SeatManagementService/GetUserStatus";
const CLIENT_VERSION = "3000.11.234";
const LOGIN_MESSAGE = "devin auth login으로 다시 로그인하세요";

function tomlString(text, key) {
  const match = text.match(new RegExp(`^\\s*${key}\\s*=\\s*"([^"]*)"`, "m"));
  return match ? match[1] : null;
}

export function parseDevinCredentials(text) {
  if (typeof text !== "string") return null;
  const apiKey = tomlString(text, "windsurf_api_key");
  if (!apiKey) return null;
  return { apiKey, serverUrl: (tomlString(text, "api_server_url") || DEFAULT_SERVER).replace(/\/$/, "") };
}

function usedFromRemaining(remaining) {
  return typeof remaining === "number" ? 100 - remaining : null;
}

export function parseDevinStatus(body, now) {
  const plan = isObject(body) && isObject(body.userStatus) ? body.userStatus.planStatus : null;
  if (!isObject(plan)) return errorResult(ID, "Devin 응답에 planStatus가 없습니다", now);
  const info = isObject(plan.planInfo) ? plan.planInfo : {};
  const daily = info.hideDailyQuota ? null : makeWindow({
    label: "일간", usedPercent: usedFromRemaining(plan.dailyQuotaRemainingPercent), resetsAt: parseTimeMs(plan.dailyQuotaResetAtUnix),
  });
  const weekly = info.hideWeeklyQuota ? null : makeWindow({
    label: "주간", usedPercent: usedFromRemaining(plan.weeklyQuotaRemainingPercent), resetsAt: parseTimeMs(plan.weeklyQuotaResetAtUnix),
  });
  return okResult(ID, [daily, weekly], now);
}

export async function fetchDevin({ readTextFile, fetch, home, now }) {
  try {
    const cred = parseDevinCredentials(await readTextFile(`${home()}/.local/share/devin/credentials.toml`));
    if (!cred) return loginResult(ID, "Devin 로그인이 필요합니다", now());
    const body = JSON.stringify({
      metadata: { apiKey: cred.apiKey, ideName: "devin-cli", ideVersion: CLIENT_VERSION, extensionVersion: CLIENT_VERSION },
    });
    const res = await fetch(`${cred.serverUrl}${STATUS_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Connect-Protocol-Version": "1" },
      body,
    });
    if (!res.ok) return httpFailure(ID, "Devin", res.status, now(), LOGIN_MESSAGE);
    return parseDevinStatus(await res.json(), now());
  } catch (error) {
    return errorResult(ID, `Devin 사용량 조회 실패: ${describeError(error)}`, now());
  }
}
