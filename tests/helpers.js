import { readFileSync } from "node:fs";

export const NOW = Date.parse("2026-11-05T08:09:17Z");
export const MIN = 60 * 1000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

export function fixture(name) {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
}

export function jsonFixture(name) {
  return JSON.parse(fixture(name));
}

// fetch 가짜: 호출 기록을 남기고 정해 둔 응답을 돌려준다.
export function fakeFetch(responses) {
  const calls = [];
  const queue = [...responses];
  const fn = async (url, options = {}) => {
    calls.push({ url, options });
    const next = queue.shift();
    if (!next) throw new Error("unexpected fetch");
    if (next instanceof Error) throw next;
    const body = next.body;
    return {
      status: next.status,
      ok: next.status >= 200 && next.status < 300,
      url,
      json: async () => (typeof body === "string" ? JSON.parse(body) : body),
      text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    };
  };
  return { fn, calls };
}

// exec 가짜: 명령마다 정해 둔 결과를 돌려준다.
export function fakeExec(handler) {
  const calls = [];
  const fn = async (command, args = []) => {
    calls.push({ command, args });
    const result = handler(command, args);
    if (result instanceof Error) throw result;
    return { code: 0, stdout: "", stderr: "", ...result };
  };
  return { fn, calls };
}

export function fakeFiles(files) {
  return async (path) => (path in files ? files[path] : null);
}

export function baseDeps(overrides = {}) {
  return {
    home: () => "/Users/me",
    now: () => NOW,
    readTextFile: fakeFiles({}),
    exec: fakeExec(() => ({ code: 1 })).fn,
    fetch: fakeFetch([]).fn,
    ...overrides,
  };
}
