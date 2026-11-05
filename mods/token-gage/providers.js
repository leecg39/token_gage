// 상태바에 보일 서비스 목록과 조회 주기.

import { fetchClaude } from "./provider-claude.js";
import { fetchCodex } from "./provider-codex.js";
import { fetchAntigravity } from "./provider-antigravity.js";
import { fetchDevin } from "./provider-devin.js";
import { fetchGrok } from "./provider-grok.js";

const MINUTE_MS = 60 * 1000;

export const PROVIDERS = [
  { id: "claude", label: "Claude", icon: "icons/claude.svg", tint: false, intervalMs: 2 * MINUTE_MS, load: fetchClaude },
  { id: "codex", label: "Codex", icon: "icons/codex.svg", tint: false, intervalMs: 2 * MINUTE_MS, load: fetchCodex },
  // agy CLI를 실행하므로(수 초) 더 드물게 부른다.
  { id: "antigravity", label: "Antigravity", icon: "icons/antigravity.svg", tint: false, intervalMs: 5 * MINUTE_MS, load: fetchAntigravity },
  { id: "devin", label: "Devin", icon: "mods/token-gage/devin.svg", tint: true, intervalMs: 2 * MINUTE_MS, load: fetchDevin },
  { id: "grok", label: "Grok", icon: "icons/grok.svg", tint: true, intervalMs: 2 * MINUTE_MS, load: fetchGrok },
];
