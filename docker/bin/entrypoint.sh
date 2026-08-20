#!/usr/bin/env bash
set -euo pipefail

g7_root="${G7PB_G7_ROOT:-/var/www/g7}"
db_name="${G7PB_DB_DATABASE:?G7PB_DB_DATABASE is required}"
db_user="${G7PB_DB_USERNAME:?G7PB_DB_USERNAME is required}"
db_password="${G7PB_DB_PASSWORD:?G7PB_DB_PASSWORD is required}"
db_root_password="${G7PB_DB_ROOT_PASSWORD:?G7PB_DB_ROOT_PASSWORD is required}"
mysql_dir=/var/lib/g7pb/mysql
redis_dir=/var/lib/g7pb/redis
db_marker=/var/lib/g7pb/.database-ready

if [[ ! "$db_name" =~ ^[A-Za-z0-9_]+$ ]] || [[ ! "$db_user" =~ ^[A-Za-z0-9_]+$ ]]; then
  echo "Database name and user must contain only letters, numbers, and underscore." >&2
  exit 64
fi

install -d -m 0750 -o mysql -g mysql "$mysql_dir" /run/mysqld
install -d -m 0750 -o redis -g redis "$redis_dir"
install -d -m 0755 -o www-data -g www-data /run/php /var/www/.composer

if [[ ! -d "$mysql_dir/mysql" ]]; then
  mariadb-install-db \
    --user=mysql \
    --datadir="$mysql_dir" \
    --auth-root-authentication-method=normal \
    --skip-test-db >/dev/null
fi

if [[ ! -f "$db_marker" ]]; then
  /usr/sbin/mariadbd \
    --user=mysql \
    --skip-networking \
    --socket=/run/mysqld/bootstrap.sock \
    --pid-file=/run/mysqld/bootstrap.pid &
  bootstrap_pid=$!

  for _ in $(seq 1 60); do
    if mariadb-admin --protocol=socket --socket=/run/mysqld/bootstrap.sock ping --silent >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  if ! mariadb-admin --protocol=socket --socket=/run/mysqld/bootstrap.sock ping --silent >/dev/null 2>&1; then
    kill "$bootstrap_pid" 2>/dev/null || true
    wait "$bootstrap_pid" 2>/dev/null || true
    echo "MariaDB bootstrap failed." >&2
    exit 1
  fi

  mariadb --protocol=socket --socket=/run/mysqld/bootstrap.sock -uroot <<SQL
CREATE DATABASE IF NOT EXISTS \`$db_name\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$db_user'@'localhost' IDENTIFIED BY '$db_password';
CREATE USER IF NOT EXISTS '$db_user'@'127.0.0.1' IDENTIFIED BY '$db_password';
ALTER USER '$db_user'@'localhost' IDENTIFIED BY '$db_password';
ALTER USER '$db_user'@'127.0.0.1' IDENTIFIED BY '$db_password';
GRANT ALL PRIVILEGES ON \`$db_name\`.* TO '$db_user'@'localhost';
GRANT ALL PRIVILEGES ON \`$db_name\`.* TO '$db_user'@'127.0.0.1';
ALTER USER 'root'@'localhost' IDENTIFIED BY '$db_root_password';
FLUSH PRIVILEGES;
SQL

  mariadb-admin \
    --protocol=socket \
    --socket=/run/mysqld/bootstrap.sock \
    -uroot \
    -p"$db_root_password" \
    shutdown >/dev/null
  wait "$bootstrap_pid"
  touch "$db_marker"
  chown mysql:mysql "$db_marker"
fi

if [[ -d "$g7_root" ]]; then
  touch "$g7_root/.env"
  chown www-data:www-data "$g7_root/.env"
  chmod 0660 "$g7_root/.env"

  for path in \
    storage \
    bootstrap/cache \
    vendor \
    modules \
    modules/_pending \
    plugins \
    plugins/_pending \
    templates \
    templates/_pending \
    lang-packs \
    lang-packs/_pending; do
    if [[ -e "$g7_root/$path" ]]; then
      chown www-data:www-data "$g7_root/$path"
      chmod u+rwx,g+rwx "$g7_root/$path"
    fi
  done

  chown -R www-data:www-data "$g7_root/storage" "$g7_root/bootstrap/cache" "$g7_root/vendor"
fi

/usr/local/bin/g7pb-sync-session-settings

module_root="${G7PB_MODULE_ROOT:-$g7_root/modules/jiwonpapa-page_builder}"
if [[ -d "$module_root/node_modules" ]]; then
  chown -R "${G7PB_HOST_UID:-www-data}:${G7PB_HOST_GID:-www-data}" "$module_root/node_modules"
fi
if [[ -d "$module_root/vendor" ]]; then
  chown -R "${G7PB_HOST_UID:-www-data}:${G7PB_HOST_GID:-www-data}" "$module_root/vendor"
fi
if [[ -d "$g7_root/node_modules" ]]; then
  chown -R "${G7PB_HOST_UID:-www-data}:${G7PB_HOST_GID:-www-data}" "$g7_root/node_modules"
fi

exec "$@"
