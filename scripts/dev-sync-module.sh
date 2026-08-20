#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="$root/.env.docker.local"
compose=(docker compose --project-name g7pb-dev --env-file "$env_file" -f "$root/compose.yaml")

[[ -f "$env_file" ]] || { echo 'Missing .env.docker.local.' >&2; exit 1; }

if ! "${compose[@]}" ps --status running --services | grep -qx dev; then
  echo 'g7pb-dev is not running. Run make dev-up first.' >&2
  exit 1
fi

echo 'Refreshing module autoload and migrations...'
"${compose[@]}" exec -T --user www-data dev \
  bash -lc 'cd /var/www/g7 && composer dump-autoload --no-interaction --no-ansi >/dev/null && php artisan migrate --path=modules/jiwonpapa-page_builder/database/migrations --force --no-ansi'

sync_code='$manager = app(\App\Extension\ModuleManager::class); $module = $manager->getModule("jiwonpapa-page_builder"); if ($module === null) { $manager->loadModules(); $module = $manager->getModule("jiwonpapa-page_builder"); } if ($module === null) { throw new \RuntimeException("Page Builder module is not loaded."); } $manager->syncDeclarativeArtifacts($module);'
registry_code='$manager = app(\App\Extension\ModuleManager::class); $manager->loadModules(); $module = $manager->getModule("jiwonpapa-page_builder"); if ($module === null) { throw new \RuntimeException("Page Builder module is not loaded."); } $updated = app(\App\Contracts\Repositories\ModuleRepositoryInterface::class)->updateByIdentifier("jiwonpapa-page_builder", ["vendor" => $module->getVendor(), "version" => $module->getVersion(), "github_url" => $module->getGithubUrl(), "metadata" => $module->getMetadata(), "config" => $module->getConfig(), "update_available" => false, "updated_at" => now()]); if ($updated !== 1) { throw new \RuntimeException("Page Builder module registry was not updated."); }'

echo 'Synchronizing module permissions through the public G7 manager...'
"${compose[@]}" exec -T --user www-data \
  -e XDG_CONFIG_HOME=/tmp/g7pb-psysh-config dev \
  php artisan tinker --execute="$sync_code" --no-ansi

echo 'Synchronizing Page Builder-owned G7 admin layouts...'
"${compose[@]}" exec -T --user www-data dev \
  php artisan module:refresh-layout jiwonpapa-page_builder --no-interaction --no-ansi

"${compose[@]}" exec -T --user www-data dev php artisan optimize:clear --no-ansi >/dev/null
"${compose[@]}" exec -T --user www-data dev php artisan module:cache-clear --no-ansi >/dev/null
"${compose[@]}" exec -T --user www-data dev php artisan template:cache-clear --no-ansi >/dev/null
"${compose[@]}" exec -T --user www-data dev php artisan seo:clear --no-ansi >/dev/null
"${compose[@]}" exec -T --user www-data \
  -e XDG_CONFIG_HOME=/tmp/g7pb-psysh-config dev \
  php artisan tinker --execute="$registry_code" --no-ansi
"${compose[@]}" exec -T dev supervisorctl restart php-fpm >/dev/null

echo 'Page Builder module synchronization completed.'
