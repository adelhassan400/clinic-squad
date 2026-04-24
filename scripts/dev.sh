#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

cleanup() {
  if [[ -n "${API_PID:-}" ]] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
  fi
  if [[ -n "${WEB_PID:-}" ]] && kill -0 "$WEB_PID" 2>/dev/null; then
    kill "$WEB_PID" 2>/dev/null || true
  fi
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

export NODE_ENV=development

echo "[dev] Building api-server..."
pnpm --filter @workspace/api-server run build

echo "[dev] Starting api-server on port 8080..."
PORT=8080 node --enable-source-maps artifacts/api-server/dist/index.mjs &
API_PID=$!

echo "[dev] Starting clinic-squad frontend on port ${PORT:-5000}..."
PORT="${PORT:-5000}" BASE_PATH="/" pnpm --filter @workspace/clinic-squad run dev &
WEB_PID=$!

wait -n "$API_PID" "$WEB_PID"
