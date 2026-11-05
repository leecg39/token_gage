// token-gage: Herdr 하단 상태바에 AI 서비스별 토큰 사용량과 리셋까지 남은 시간을 보여 준다.
// 조회는 provider-*.js가, 화면은 view.js가 맡는다. 토큰은 메모리에서만 쓰고 저장하지 않는다.

import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { exec, readTextFile, home, theme } from "herdr";
import { PROVIDERS } from "./providers.js";
import { dueProviders, applyResult } from "./scheduler.js";
import { segment } from "./view.js";

const TICK_MS = 30 * 1000;
const COMPACT_WIDTH = 820;

export default class TokenGage extends View {
  init(_props, cx) {
    this.state = {};
    this.inFlight = new Set();
    this.width = 0;
    this.deps = {
      exec,
      readTextFile,
      home,
      fetch: (url, options) => fetch(url, options),
      now: () => Date.now(),
    };
    cx.timer.every(TICK_MS, (cx) => this.refresh(cx, false));
    this.refresh(cx, false);
  }

  refresh(cx, force) {
    const due = dueProviders(PROVIDERS, this.state, this.inFlight, Date.now(), force);
    this.inFlight = new Set([...this.inFlight, ...due.map((p) => p.id)]);
    due.forEach((provider) => cx.spawn(async (cx) => this.load(cx, provider)));
    cx.notify();
  }

  async load(cx, provider) {
    try {
      const result = await provider.load(this.deps);
      this.state = applyResult(this.state, result);
    } finally {
      this.inFlight = new Set([...this.inFlight].filter((id) => id !== provider.id));
      cx.notify();
    }
  }

  refreshButton(t) {
    const icon = svg("mods/token-gage/refresh.svg").size(12).text_color(t.muted);
    return div().id("tg-refresh").flex_none().p(3).rounded(4).hover((s) => s.bg(t.hover))
      .tooltip("지금 새로 고침")
      .on_click((_e, cx) => this.refresh(cx, true))
      .child(this.inFlight.size > 0 ? icon.spin(900) : icon);
  }

  render() {
    const t = theme();
    const now = Date.now();
    const compact = this.width > 0 && this.width < COMPACT_WIDTH;
    return h_flex().id("tg-root").size_full().px(14).gap(14).items_center().overflow_hidden()
      .bg(t.chrome).border_t(1).border_color(t.border).text_size(11.8).text_color(t.muted)
      .on_size_change((size, cx) => {
        if (Math.abs(size.width - this.width) < 1) return;
        this.width = size.width;
        cx.notify();
      })
      .child(div().flex_none().text_color(t.dim).child("사용"))
      .children(PROVIDERS.map((p) => segment(t, p, this.state[p.id], now, compact)))
      .child(this.refreshButton(t));
  }
}
