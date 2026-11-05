# token-gage

Herdr 앱 하단 상태바 왼쪽에 AI 서비스별 토큰 사용량(%)과 리셋까지 남은 시간을 표시하는 mod입니다.

```
사용  [Claude] ▰▱ 38% 3h 13m · 59% 2d 6h  [Codex] ▰▰ 93% 5d 8h  [Antigravity] Gemini 0% 5h 0m · 18% 1d 17h ...  ⟳ │ This computer · 4 agents
```

| 서비스 | 표시 | 출처 | 조회 주기 |
|---|---|---|---|
| Claude | 5h · 주간 | 키체인 토큰 → `api.anthropic.com/api/oauth/usage` | 2분 |
| Codex | (5h ·) 주간 | `~/.codex/auth.json` → `chatgpt.com/backend-api/wham/usage` | 2분 |
| Antigravity | 그룹별 5h · 주간 | `agy -p /usage --output-format json` (agy 1.1.11 이상) | 5분 |
| Devin | 일간 · 주간 | `~/.local/share/devin/credentials.toml` → Codeium `GetUserStatus` | 2분 |
| Grok | 주간(또는 월간) | `~/.grok/auth.json` → `cli-chat-proxy.grok.com/v1/billing` | 2분 |

- 막대와 퍼센트 색은 70% 미만이면 초록, 70~89%는 노랑, 90% 이상은 빨강입니다.
- 마우스를 올리면 창별 사용률과 리셋까지 남은 시간이 나옵니다. ⟳를 누르면 바로 다시 불러옵니다.
- ⚠는 조회 실패를 뜻합니다. 직전 값을 그대로 보여 주며, 툴팁에 원인이 나옵니다.
- 토큰은 갱신하지 않습니다. 만료되면 "Grok을 실행하세요" 같은 안내가 나오고, 해당 CLI를 한 번 실행하면 다음 조회부터 다시 표시됩니다.
  Grok 토큰은 수명이 짧아(약 6시간) 이 안내가 자주 보일 수 있습니다.
- 비공식 API를 쓰므로 서비스 쪽 변경으로 깨질 수 있습니다.

## 명령

```sh
npm test               # 단위 테스트
npm run coverage       # 커버리지
sh scripts/install.sh  # ~/.config/herdr-app/mods/token-gage에 복사 + herdr-app check
python3 scripts/attach-layout.py   # herdr-skillshare 레이아웃 하단에 연결(이미 했으면 변경 없음)
```

## 되돌리기

```sh
cp backup/herdr-skillshare.json.<시각> ~/.config/herdr-app/layouts/herdr-skillshare.json
rm -rf ~/.config/herdr-app/mods/token-gage
```
