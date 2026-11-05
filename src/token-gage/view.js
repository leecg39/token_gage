// 상태바 한 칸(서비스 하나)을 그리는 함수들. 데이터는 바꾸지 않는다.

import { div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { formatRemaining, formatPercent, usageLevel } from "./format.js";
import { peakPercent } from "./model.js";
import { groupWindows, segmentKind, tooltipText } from "./summary.js";

const BAR_WIDTH = 30;
const ICON_SIZE = 14;

export function levelColor(t, percent) {
  const level = usageLevel(percent);
  if (level === "critical") return t.ansi1;
  if (level === "warn") return t.ansi3;
  return t.ansi2;
}

function icon(provider, t) {
  return provider.tint
    ? svg(provider.icon).size(ICON_SIZE).flex_none().text_color(t.foreground)
    : image(provider.icon).w(ICON_SIZE).h(ICON_SIZE).flex_none();
}

function bar(t, percent) {
  const fill = Math.max(percent > 0 ? 2 : 0, Math.round((BAR_WIDTH * percent) / 100));
  return div().w(BAR_WIDTH).h(4).flex_none().rounded(2).bg(t.border)
    .child(div().h(4).w(fill).rounded(2).bg(levelColor(t, percent)));
}

function windowText(t, w, now, compact) {
  const left = compact ? "" : formatRemaining(w.resetsAt, now);
  return h_flex().gap(4).items_center().flex_none()
    .child(div().text_color(levelColor(t, w.usedPercent)).child(formatPercent(w.usedPercent)))
    .when(left !== "", (el) => el.child(div().text_color(t.muted).child(left)));
}

function dot(t) {
  return div().text_color(t.dim).flex_none().child("·");
}

function groupView(t, g, now, compact) {
  const parts = g.windows.flatMap((w, i) => (i === 0 ? [windowText(t, w, now, compact)] : [dot(t), windowText(t, w, now, compact)]));
  return h_flex().gap(5).items_center().flex_none()
    .when(Boolean(g.group), (el) => el.child(div().text_color(t.muted).child(g.group)))
    .children(parts);
}

function warnIcon(t) {
  return svg("mods/token-gage/alert.svg").size(12).flex_none().text_color(t.ansi3);
}

function usageBody(t, entry, now, compact) {
  return h_flex().gap(8).items_center().flex_none()
    .child(bar(t, peakPercent(entry.windows)))
    .children(groupWindows(entry.windows).map((g) => groupView(t, g, now, compact)))
    .when(entry.stale === true, (el) => el.child(warnIcon(t)));
}

function noticeBody(t, entry, compact) {
  const text = entry.status === "login" ? entry.message : "새로 고침 실패";
  return h_flex().gap(5).items_center().min_w(0)
    .child(warnIcon(t))
    .when(!compact, (el) => el.child(div().text_color(t.muted).truncate().child(text)));
}

export function segment(t, provider, entry, now, compact) {
  const kind = segmentKind(entry);
  const body = kind === "usage" ? usageBody(t, entry, now, compact)
    : kind === "notice" ? noticeBody(t, entry, compact)
      : div().text_color(t.dim).child("…");
  return h_flex().id(`tg-${provider.id}`).gap(6).items_center().flex_shrink(kind === "notice" ? 1 : 0).min_w(0)
    .tooltip(tooltipText(provider.label, entry, now))
    .child(icon(provider, t))
    .child(body);
}
