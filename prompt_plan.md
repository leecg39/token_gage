# 구현 계획: Herdr 하단 토큰 사용량 게이지 (token-gage)

확정일: 2026-11-05

## 요구사항
- Herdr 앱 `herdr-skillshare` 레이아웃의 하단 상태바 한 줄에서
  왼쪽은 토큰 사용량, 오른쪽은 기존 정보(`workspace-status`)를 표시한다.
- 처음부터 지원할 서비스는 Claude, Codex, Antigravity, Devin, Grok이다.
- 각 서비스의 사용률(%)과 리셋까지 남은 시간을 표시한다. 형식: `20% 4h 10m · 57% 2d 7h`
- 비공식 API 사용을 허용한다(사용자 확인 완료).

## 데이터 소스 (Phase 0에서 실제 호출로 확인)
| 서비스 | 인증 | 요청 | 확인 결과 |
|---|---|---|---|
| Claude | 키체인 `Claude Code-credentials` | GET `api.anthropic.com/api/oauth/usage` | 200, five_hour 31%, seven_day 59% |
| Codex | `~/.codex/auth.json` | GET `chatgpt.com/backend-api/wham/usage` | 200, primary_window(주간) 93% |
| Antigravity | agy CLI 로그인 | `agy -p /usage --output-format json` (agy 1.1.11 이상) | Gemini·Claude/GPT 그룹별 5h·주간 |
| Devin | `~/.local/share/devin/credentials.toml` | POST `server.codeium.com/.../GetUserStatus` | 200, 일간·주간 남은 비율 |
| Grok | `~/.grok/auth.json` | GET `cli-chat-proxy.grok.com/v1/billing?format=credits` | 401(토큰 만료). grok 실행 시 갱신 |

## 구조
```
token_gage/
  mods/token-gage/       mod 원본 (scripts/install.sh로 ~/.config/herdr-app/mods/token-gage에 복사)
    main.js              화면(View). herdr API를 provider에 주입
    mod.json             { "place": "none" }
    format.js            남은 시간·퍼센트·색 단계 (순수 함수)
    model.js             공통 결과 형태와 검증 도우미
    provider-*.js        서비스별 조회와 변환 (herdr를 import하지 않음 → node로 테스트)
    providers.js         서비스 목록과 갱신 주기
    scheduler.js         갱신 시점 판단과 결과 병합(실패하면 직전 값 유지)
  tests/*.test.js        node --test
  scripts/install.sh     복사 + herdr-app check
```

## 단계
1. Phase 0: 데이터 소스 검증 ✅
2. Phase 1: format/model/scheduler TDD ✅
3. Phase 2: provider 5개 TDD (실제 응답 형태로 만든 예시 데이터 사용) ✅
4. Phase 3: main.js 화면 + `herdr-app check` ✅
5. Phase 4: 레이아웃 연결(백업 후) + `herdr-app shot`으로 캡처 검증 ✅

## 위험 및 결정
- 토큰 자동 갱신은 하지 않는다. 만료되면 "실행 필요"를 표시한다. 갱신하면 각 CLI 로그인이 깨질 위험이 있다.
- 토큰은 메모리에서만 쓰고 로그, 파일, shared state에 남기지 않는다.
- Antigravity는 CLI를 실행하므로(약 7초) 5분 주기로 조회한다. 나머지는 2분 주기다.
- 오류가 나도 주기보다 자주 부르지 않는다(429 대응). 급하면 ⟳ 버튼을 누른다.
- `main` 레이아웃은 Herdr 기본이라 수정하지 않는다.
