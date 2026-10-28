#!/usr/bin/env bash
# Runs the browser journeys against production builds of the web app and API, with the RPC test harness standing in
# for the wallet. Dev only: it drops and recreates the local `setrya` database.
set -euo pipefail
cd "$(dirname "$0")"
ROOT=$(cd ../.. && pwd)
LOGS=${JOURNEY_LOGS:-$(mktemp -d)}
API_ENV="$ROOT/apps/api/.env.local"
WEB_PORT=3218
API_PORT=8445
STUB_PORT=18990

env_value() { grep "^$1=" "$API_ENV" | cut -d= -f2-; }
EDGE_KEY=$(env_value SETRYA_EDGE_KEY)
TOKEN=$(env_value SETRYA_SETUP_TOKEN)

pids=()
cleanup() { for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done; }
trap cleanup EXIT

wait_for() {
  for _ in $(seq 1 60); do curl -sf -o /dev/null "$1" && return 0; sleep 1; done
  echo "timed out waiting for $1" >&2
  return 1
}

psql postgres -qc "drop database if exists setrya with (force)"
createdb setrya
(cd "$ROOT/apps/api" && DATABASE_URL=postgres://localhost:5432/setrya npx tsx src/migrate.ts)

pnpm --dir "$ROOT" --filter @setrya/api build >"$LOGS/api-build.log"
SETRYA_API_URL="http://127.0.0.1:$API_PORT" SETRYA_EDGE_KEY="$EDGE_KEY" pnpm --dir "$ROOT" --filter @setrya/web build >"$LOGS/web-build.log"

STUB_PORT=$STUB_PORT node ../integration/stub-rpc/server.mjs >"$LOGS/stub.log" 2>&1 &
pids+=($!)
(
  cd "$ROOT/apps/api"
  set -a
  # shellcheck disable=SC1090
  source "$API_ENV"
  set +a
  export PORT=$API_PORT SETRYA_PUBLIC_ORIGIN="http://localhost:$WEB_PORT" SETRYA_NETWORK=testnet \
    ZALLET_RPC_URL="http://127.0.0.1:$STUB_PORT/zallet" ZEBRA_RPC_URL="http://127.0.0.1:$STUB_PORT/zebra" \
    SETRYA_PAYER_ACCOUNT_UUID=11111111-2222-4333-8444-555555555555 SETRYA_WALLET_CONNECTION_NAME="RPC test harness"
  exec node --enable-source-maps dist/main.js
) >"$LOGS/api.log" 2>&1 &
pids+=($!)
(cd "$ROOT/apps/web" && SETRYA_API_URL="http://127.0.0.1:$API_PORT" SETRYA_EDGE_KEY="$EDGE_KEY" exec npx next start -p $WEB_PORT) >"$LOGS/web.log" 2>&1 &
pids+=($!)

wait_for "http://127.0.0.1:$API_PORT/healthz"
wait_for "http://localhost:$WEB_PORT/"

export SETRYA_BASE="http://localhost:$WEB_PORT"
node journey-setup.mjs "$TOKEN" | grep -E '"ok"|"url"'
node journey-settlement.mjs
node journey-payment.mjs
echo "journeys passed; logs in $LOGS"
