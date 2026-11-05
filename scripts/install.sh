#!/bin/sh
# mods/token-gage를 Herdr mods 폴더로 복사하고 herdr-app check로 검사한다.
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HERDR_HOME="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
DEST="$HERDR_HOME/mods/token-gage"
HERDR_APP="$(command -v herdr-app || echo "$HOME/.local/bin/herdr-app")"

if [ ! -d "$HERDR_HOME/mods" ]; then
  echo "Herdr mods 폴더가 없습니다: $HERDR_HOME/mods" >&2
  exit 1
fi

mkdir -p "$DEST"
# Herdr가 직접 쓰는 jsconfig.json, *.d.ts는 지우지 않는다.
rsync -a --delete --exclude 'jsconfig.json' --exclude '*.d.ts' "$ROOT/mods/token-gage/" "$DEST/"
echo "복사 완료: $DEST"
"$HERDR_APP" check "$DEST"
