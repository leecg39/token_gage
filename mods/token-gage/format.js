// 화면에 쓰는 순수 서식 함수들. herdr에 의존하지 않아 node로 테스트한다.

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export const WARN_PERCENT = 70;
export const CRITICAL_PERCENT = 90;

const WINDOW_NAMES = { 300: "5h", 1440: "일간", 10080: "주간", 43200: "월간" };

// 리셋까지 남은 시간: "35m", "4h 10m", "2d 7h". 모르면 "".
export function formatRemaining(resetsAt, now) {
  if (typeof resetsAt !== "number" || !Number.isFinite(resetsAt)) return "";
  const left = resetsAt - now;
  if (left < MINUTE_MS) return "곧";
  if (left < HOUR_MS) return `${Math.floor(left / MINUTE_MS)}m`;
  if (left < DAY_MS) {
    const hours = Math.floor(left / HOUR_MS);
    const minutes = Math.floor((left % HOUR_MS) / MINUTE_MS);
    return `${hours}h ${minutes}m`;
  }
  const days = Math.floor(left / DAY_MS);
  const hours = Math.floor((left % DAY_MS) / HOUR_MS);
  return `${days}d ${hours}h`;
}

export function clampPercent(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function formatPercent(percent) {
  return `${percent}%`;
}

export function usageLevel(percent) {
  if (percent >= CRITICAL_PERCENT) return "critical";
  if (percent >= WARN_PERCENT) return "warn";
  return "ok";
}

// 창 길이(분)를 짧은 이름으로: 300 → "5h", 10080 → "주간".
export function windowLabel(minutes) {
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes <= 0) return "";
  if (WINDOW_NAMES[minutes]) return WINDOW_NAMES[minutes];
  return `${Math.round(minutes / 60)}h`;
}
