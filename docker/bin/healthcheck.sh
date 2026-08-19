#!/usr/bin/env bash
set -euo pipefail

supervisorctl status mariadb redis php-fpm nginx | awk '$2 != "RUNNING" { exit 1 }'
MYSQL_PWD="${G7PB_DB_PASSWORD}" mariadb-admin \
  --protocol=tcp \
  --host=127.0.0.1 \
  --user="${G7PB_DB_USERNAME}" \
  ping --silent
redis-cli -h 127.0.0.1 ping | grep -qx PONG
request_path=/
if [[ ! -f /var/www/g7/vendor/autoload.php ]]; then
  request_path=/install/
fi
curl --silent --show-error --insecure --fail --location \
  --resolve g7pb.test:443:127.0.0.1 \
  "https://g7pb.test${request_path}" >/dev/null
