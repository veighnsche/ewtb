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

preview-3100:
  npx vite preview --port 3100

@_wait-preview:
  for i in {1..60}; do \
    code=$$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3100 || true); \
    if [ "$$code" = "200" ]; then \
      exit 0; \
    fi; \
    sleep 1; \
  done; \
  echo "preview on :3100 did not become ready" >&2; \
  exit 1

@_capture output="screenshot.png" width="1920" height="1080":
  chromium --headless --disable-gpu --no-sandbox \
    --window-size={{width}},{{height}} \
    --screenshot={{output}} \
    http://127.0.0.1:3100

screenshot output=".output/screenshot.png" width="1920" height="1080":
  mkdir -p $(dirname {{output}})
  bun --bun run build
  pkill -f 'preview --port 3100' >/dev/null 2>&1 || true
  sh -c 'npx vite preview --strictPort --port 3100 >/tmp/ewtb-preview.log 2>&1 & echo $! > /tmp/ewtb-preview.pid'
  trap 'kill $(cat /tmp/ewtb-preview.pid 2>/dev/null) 2>/dev/null || true; rm -f /tmp/ewtb-preview.pid' EXIT
  just _wait-preview
  just _capture {{output}} {{width}} {{height}}
  ls -lh {{output}}

test:
  bun --bun run test

lint:
  bun --bun run lint

format:
  bun --bun run format

check:
  bun --bun run check
