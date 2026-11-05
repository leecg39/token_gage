// 언제 다시 조회할지, 새 결과를 어떻게 합칠지 정한다. 상태는 바꾸지 않고 새 객체를 만든다.

// 오류여도 주기를 지킨다: 429(요청 과다) 때 더 자주 부르면 역효과다. 급하면 새로고침 버튼.
export function isDue(provider, entry, now) {
  if (!entry) return true;
  return now - entry.updatedAt >= provider.intervalMs;
}

export function dueProviders(providers, state, inFlight, now, force = false) {
  return providers.filter((p) => !inFlight.has(p.id) && (force || isDue(p, state[p.id], now)));
}

// 오류가 나면 직전 숫자를 지키고 stale로 표시한다. 로그인 필요는 안내를 그대로 보인다.
export function mergeResult(prev, next) {
  if (next.status !== "error") return next;
  if (!prev || prev.windows.length === 0) return next;
  return { ...prev, stale: true, message: next.message, updatedAt: next.updatedAt };
}

export function applyResult(state, result) {
  return { ...state, [result.id]: mergeResult(state[result.id], result) };
}
