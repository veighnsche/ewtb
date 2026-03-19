set shell := ["zsh", "-lc"]

app_port := "3102"
app_host := "127.0.0.1"
app_url := "http://" + app_host + ":" + app_port
freshrss_api_base_url := "http://127.0.0.1:8082/api/greader.php"
freshrss_username := "vince"
freshrss_api_password := "NBZRfM3_4TeiabfMusxfs_LjWOesqnLQ"

default:
  @just --list

install:
  bun install

dev:
  FRESHRSS_API_BASE_URL={{freshrss_api_base_url}} \
  FRESHRSS_USERNAME={{freshrss_username}} \
  FRESHRSS_API_PASSWORD={{freshrss_api_password}} \
  bun node_modules/vite/bin/vite.js dev --host {{app_host}} --port {{app_port}} --strictPort

build:
  bun --bun run build

preview:
  FRESHRSS_API_BASE_URL={{freshrss_api_base_url}} \
  FRESHRSS_USERNAME={{freshrss_username}} \
  FRESHRSS_API_PASSWORD={{freshrss_api_password}} \
  bun --bun run preview -- --host {{app_host}} --port {{app_port}} --strictPort

screenshot output=".screenshots/localhost-3102.png" width="1920" height="1080" url=app_url:
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
