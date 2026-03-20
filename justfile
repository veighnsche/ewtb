set shell := ["zsh", "-lc"]

app_port := "3102"
app_host := "127.0.0.1"

default:
  @just --list

install:
  bun install

env-check:
  @if [ ! -f .env ]; then \
    echo ".env ontbreekt; kopieer eerst .env.example naar .env en vul de waarden in." >&2; \
    exit 1; \
  fi

dev:
  @just env-check
  @set -a; source ./.env; set +a; \
  bun node_modules/vite/bin/vite.js dev \
    --host "${HOST:-{{app_host}}}" \
    --port "${PORT:-{{app_port}}}" \
    --strictPort

build:
  bun --bun run build

preview:
  @just env-check
  @set -a; source ./.env; set +a; \
  bun --bun run preview -- \
    --host "${HOST:-{{app_host}}}" \
    --port "${PORT:-{{app_port}}}" \
    --strictPort

wall-prod:
  @just env-check
  @set -a; source ./.env; set +a; \
  bun .output/server/index.mjs

screenshot output=".screenshots/localhost-3102.png" width="1920" height="1080" url="":
  @set -a; [ -f ./.env ] && source ./.env; set +a; \
  target_url="{{url}}"; \
  if [ -z "$target_url" ]; then \
    target_url="http://${HOST:-{{app_host}}}:${PORT:-{{app_port}}}"; \
  fi; \
  mkdir -p $(dirname {{output}})
  for i in {1..30}; do \
    code=$(curl -I -s --max-time 2 -o /dev/null -w '%{http_code}' "$target_url" || true); \
    if [ "$code" = "200" ]; then \
      break; \
    fi; \
    if [ "$i" = "30" ]; then \
      echo "$target_url is niet bereikbaar; start eerst 'just dev'" >&2; \
      exit 1; \
    fi; \
    sleep 1; \
  done
  timeout 20s chromium --headless --disable-gpu --no-sandbox \
    --window-size={{width}},{{height}} \
    --screenshot={{output}} \
    "$target_url"
  ls -lh {{output}}

test:
  bun --bun run test

lint:
  bun --bun run lint

format:
  bun --bun run format

check:
  bun --bun run check
