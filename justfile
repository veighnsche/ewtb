set shell := ["zsh", "-lc"]

default:
  @just --list

install:
  bun install

dev:
  bun --bun run dev

build:
  bun --bun run build

preview:
  bun --bun run preview

screenshot output=".screenshots/localhost-3000.png" width="1920" height="1080" url="http://localhost:3000":
  mkdir -p $(dirname {{output}})
  for i in {1..30}; do \
    code=$(curl -I -s --max-time 2 -o /dev/null -w '%{http_code}' {{url}} || true); \
    if [ "$code" = "200" ]; then \
      break; \
    fi; \
    if [ "$i" = "30" ]; then \
      echo "{{url}} is niet bereikbaar; start eerst 'just dev'" >&2; \
      exit 1; \
    fi; \
    sleep 1; \
  done
  timeout 20s chromium --headless --disable-gpu --no-sandbox \
    --window-size={{width}},{{height}} \
    --screenshot={{output}} \
    {{url}}
  ls -lh {{output}}

test:
  bun --bun run test

lint:
  bun --bun run lint

format:
  bun --bun run format

check:
  bun --bun run check
