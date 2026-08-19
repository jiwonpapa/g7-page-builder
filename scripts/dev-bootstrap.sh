#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="$root/.env.docker.local"
tls_dir="$root/.runtime/tls"
cert_file="$tls_dir/g7pb.test.pem"
key_file="$tls_dir/g7pb.test-key.pem"

command -v docker >/dev/null || { echo 'Docker is required.' >&2; exit 1; }
command -v mkcert >/dev/null || { echo 'mkcert is required.' >&2; exit 1; }
command -v openssl >/dev/null || { echo 'OpenSSL is required.' >&2; exit 1; }

if [[ ! -f "$env_file" ]]; then
  umask 077
  db_password="$(openssl rand -hex 24)"
  db_root_password="$(openssl rand -hex 24)"
  admin_password="$(openssl rand -hex 16)"

  printf '%s\n' \
    'G7PB_DB_DATABASE=g7pb' \
    'G7PB_DB_USERNAME=g7pb' \
    "G7PB_DB_PASSWORD=$db_password" \
    "G7PB_DB_ROOT_PASSWORD=$db_root_password" \
    'G7PB_APP_NAME="G7 Page Builder Dev"' \
    'G7PB_ADMIN_NAME=G7PB_Admin' \
    'G7PB_ADMIN_EMAIL=admin@g7pb.test' \
    "G7PB_ADMIN_PASSWORD=$admin_password" \
    'G7PB_ENABLE_REVERB=0' \
    "G7PB_HOST_UID=$(id -u)" \
    "G7PB_HOST_GID=$(id -g)" >"$env_file"
  chmod 0600 "$env_file"
  echo 'Created .env.docker.local with random local-only credentials.'
else
  chmod 0600 "$env_file"
  echo '.env.docker.local already exists; credentials were preserved.'
fi

mkdir -p "$tls_dir"
if [[ ! -f "$cert_file" || ! -f "$key_file" ]]; then
  TRUST_STORES=system mkcert -cert-file "$cert_file" -key-file "$key_file" g7pb.test
  chmod 0600 "$key_file"
  chmod 0644 "$cert_file"
  echo 'Created mkcert certificate for g7pb.test.'
else
  echo 'g7pb.test certificate already exists; it was preserved.'
fi

if ! grep -Eq '^[[:space:]]*127\.0\.0\.1[[:space:]]+([^#]*[[:space:]])?g7pb\.test([[:space:]]|$)' /etc/hosts; then
  echo 'HOSTS_REQUIRED: 127.0.0.1 g7pb.test'
fi
