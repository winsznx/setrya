#!/usr/bin/env bash
# Creates the settlement host's secrets and api.env next to compose.yml. Safe to re-run: existing secrets are kept,
# so the master key, database password and edge key never change underneath live data.
#
#   PUBLIC_ORIGIN=https://setrya.example API_HOSTS="api.setrya.example 203.0.113.7" ./bootstrap.sh
#   TARGET_DIR=sandbox ./bootstrap.sh   writes the sandbox stack's secrets and api.env instead
set -euo pipefail
cd "${TARGET_DIR:-$(dirname "$0")}"
: "${PUBLIC_ORIGIN:?set PUBLIC_ORIGIN to the web app origin, e.g. https://setrya.example}"
: "${API_HOSTS:?set API_HOSTS to the names and IPs the web tier uses to reach this API}"

API_UID=10002
SIGNER_GID=10001

install -d -m 0755 secrets
new_secret() { [ -s "secrets/$1" ] || (umask 077 && openssl rand "$2" "$3" | tr -d '\n' > "secrets/$1"); }
new_secret master.key -base64 32
new_secret db_password -hex 24
new_secret edge_key -hex 32
new_secret setup_token -hex 24

if [ ! -s secrets/tls.crt ]; then
  san=""
  for h in $API_HOSTS; do
    if [[ $h =~ ^[0-9.]+$ ]]; then san+="IP:$h,"; else san+="DNS:$h,"; fi
  done
  openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -days 825 \
    -subj "/CN=setrya-api" -addext "subjectAltName=${san%,}" -addext "basicConstraints=critical,CA:TRUE" \
    -keyout secrets/tls.key -out secrets/tls.crt 2>/dev/null
fi

# The API runs as uid 10002, which no host account uses, and must read its own secrets. Postgres reads db_password as root.
sudo chown "$API_UID:$API_UID" secrets/master.key secrets/tls.key secrets/tls.crt
sudo chmod 0400 secrets/master.key secrets/tls.key
sudo chmod 0444 secrets/tls.crt

if [ ! -s api.env ]; then
  (umask 077 && sed \
    -e "s#^SETRYA_PUBLIC_ORIGIN=.*#SETRYA_PUBLIC_ORIGIN=$PUBLIC_ORIGIN#" \
    -e "s#^SETRYA_EDGE_KEY=.*#SETRYA_EDGE_KEY=$(cat secrets/edge_key)#" \
    -e "s#^SETRYA_SETUP_TOKEN=.*#SETRYA_SETUP_TOKEN=$(cat secrets/setup_token)#" \
    -e "s#PASSWORD@db#$(cat secrets/db_password)@db#" \
    api.env.example > api.env)
fi

echo "Secrets ready in $(pwd)/secrets. Signer group: $SIGNER_GID."
echo "Give the web tier: SETRYA_EDGE_KEY (secrets/edge_key) and SETRYA_API_CA (secrets/tls.crt)."
