// 화면에 보일 문구를 만드는 순수 함수들.

import { formatRemaining } from "./format.js";

// 순서를 지키며 같은 group끼리 묶는다: [{ group, windows }]
export function groupWindows(windows) {
  return windows.reduce((groups, w) => {
    const last = groups[groups.length - 1];
    if (last && last.group === w.group) {
      return [...groups.slice(0, -1), { ...last, windows: [...last.windows, w] }];
    }
    return [...groups, { group: w.group, windows: [w] }];
  }, []);
}

export function segmentKind(entry) {
  if (!entry) return "loading";
  return entry.status === "ok" ? "usage" : "notice";
}

function windowLine(w, now) {
  const name = w.group ? `${w.group} ${w.label}` : w.label;
  const left = formatRemaining(w.resetsAt, now);
  const reset = left === "" ? "" : left === "곧" ? " · 곧 리셋" : ` · ${left} 후 리셋`;
  return `${name}: ${w.usedPercent}% 사용${reset}`;
}

export function tooltipText(label, entry, now) {
  if (!entry) return `${label}: 불러오는 중`;
  if (entry.status !== "ok") return `${label}: ${entry.message}`;
  const lines = entry.windows.map((w) => windowLine(w, now));
  const stale = entry.stale ? [`⚠ 마지막 조회 실패: ${entry.message}`] : [];
  return [label, ...lines, ...stale].join("\n");
}
