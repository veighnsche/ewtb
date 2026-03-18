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

test:
  bun --bun run test

lint:
  bun --bun run lint

format:
  bun --bun run format

check:
  bun --bun run check
