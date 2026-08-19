#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
failures=0

ok() { printf 'OK   %s\n' "$1"; }
fail() { printf 'FAIL %s\n' "$1" >&2; failures=$((failures + 1)); }

if docker info >/dev/null 2>&1; then ok 'Docker engine'; else fail 'Docker engine is unavailable'; fi
if docker compose version >/dev/null 2>&1; then ok 'Docker Compose'; else fail 'Docker Compose is unavailable'; fi

if [[ -f "$root/.runtime/gnuboard7/artisan" ]] && [[ -d "$root/.runtime/gnuboard7/.git" ]]; then
  g7_version="$(git -C "$root/.runtime/gnuboard7" describe --tags --exact-match 2>/dev/null || true)"
  if [[ "$g7_version" == '7.0.7' ]]; then ok 'Gnuboard7 7.0.7 checkout'; else fail "Expected Gnuboard7 7.0.7, found ${g7_version:-untagged}"; fi
else
  fail 'Gnuboard7 checkout is missing at .runtime/gnuboard7'
fi

if [[ -f "$root/.env.docker.local" ]]; then
  mode="$(stat -f '%Lp' "$root/.env.docker.local" 2>/dev/null || stat -c '%a' "$root/.env.docker.local")"
  if [[ "$mode" == '600' ]]; then ok '.env.docker.local permissions 0600'; else fail ".env.docker.local permissions are $mode, expected 600"; fi
else
  fail 'Run make dev-bootstrap to create .env.docker.local'
fi

cert="$root/.runtime/tls/g7pb.test.pem"
key="$root/.runtime/tls/g7pb.test-key.pem"
if [[ -f "$cert" && -f "$key" ]] \
  && openssl x509 -in "$cert" -noout -checkend 0 >/dev/null 2>&1 \
  && openssl x509 -in "$cert" -noout -ext subjectAltName 2>/dev/null | grep -q 'DNS:g7pb.test'; then
  ok 'mkcert TLS certificate and SAN'
else
  fail 'g7pb.test TLS certificate is missing or invalid'
fi

if grep -Eq '^[[:space:]]*127\.0\.0\.1[[:space:]]+([^#]*[[:space:]])?g7pb\.test([[:space:]]|$)' /etc/hosts; then
  ok '/etc/hosts g7pb.test'
else
  fail '/etc/hosts must contain: 127.0.0.1 g7pb.test'
fi

if docker ps --format '{{.Names}}' | grep -qx 'g7pb-dev'; then
  ok 'Port 443 is owned by running g7pb-dev'
elif lsof -nP -iTCP:443 -sTCP:LISTEN >/dev/null 2>&1; then
  fail 'Host port 443 is already in use'
else
  ok 'Host port 443 is available'
fi

if docker compose --project-name g7pb-dev --env-file "$root/.env.docker.local" -f "$root/compose.yaml" config --quiet; then
  ok 'Compose configuration'
else
  fail 'Compose configuration is invalid'
fi

if (( failures > 0 )); then
  printf '%d doctor check(s) failed.\n' "$failures" >&2
  exit 1
fi

echo 'Doctor passed.'
