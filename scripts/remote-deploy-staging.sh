#!/usr/bin/env bash
set -euo pipefail

app_root=/home/g7devops/public_html
artifact="${1:?artifact path is required}"
artifact_sha="${2:?artifact checksum is required}"
release_id="${3:?release id is required}"
backup_helper="${4:?backup helper path is required}"
module_id=jiwonpapa-page_builder
target="$app_root/modules/$module_id"
backup_root="/home/g7devops/deploy-backups/g7-page-builder/$release_id"
work_root="/home/g7devops/.g7pb-releases/$release_id"
lock_file=/home/g7devops/.g7pb-deploy.lock

exec 9>"$lock_file"
flock -n 9 || { echo 'Another Page Builder deployment is running.' >&2; exit 3; }

cd "$app_root"
test -f artisan
mkdir -p "$backup_root" "$work_root"

actual_sha="$(sha256sum "$artifact" | awk '{print $1}')"
[[ "$actual_sha" == "$artifact_sha" ]] || { echo 'Uploaded artifact checksum mismatch.' >&2; exit 2; }

php "$backup_helper" "$app_root" "$backup_root/database-before.sql"
sha256sum "$backup_root/database-before.sql" > "$backup_root/database-before.sql.sha256"

if [[ -d "$target" ]]; then
  tar -C "$app_root/modules" -czf "$backup_root/module-before.tar.gz" "$module_id"
  sha256sum "$backup_root/module-before.tar.gz" > "$backup_root/module-before.tar.gz.sha256"
fi

tar -C "$work_root" -xzf "$artifact"
staged="$work_root/$module_id"
test -f "$staged/module.json"
grep -q '"identifier": "jiwonpapa-page_builder"' "$staged/module.json"
(
  cd "$staged"
  sha256sum -c SHA256SUMS >/dev/null
)

rollback_path="$app_root/modules/.${module_id}.rollback-$release_id"
had_previous=false
if [[ -d "$target" ]]; then
  had_previous=true
  mv "$target" "$rollback_path"
fi

restore_files() {
  if [[ -d "$rollback_path" ]]; then
    if [[ -d "$target" ]]; then
      mv "$target" "$backup_root/module-failed"
    fi
    mv "$rollback_path" "$target"
  elif [[ "$had_previous" == false && -d "$target" ]]; then
    mv "$target" "$backup_root/module-failed"
  fi
}
trap restore_files ERR

mv "$staged" "$target"
chmod -R u=rwX,g=rX,o=rX "$target"

installed="$(php artisan tinker --execute='echo \App\Models\Module::query()->where("identifier", "jiwonpapa-page_builder")->exists() ? "installed" : "absent";' --no-ansi)"
if [[ "$installed" != *installed* ]]; then
  php artisan module:install "$module_id" --vendor-mode=auto --no-interaction --no-ansi
else
  php artisan migrate --path="modules/$module_id/database/migrations" --force --no-interaction --no-ansi
  php artisan tinker --execute='$manager = app(\App\Extension\ModuleManager::class); $module = $manager->getModule("jiwonpapa-page_builder"); if ($module === null) { $manager->loadModules(); $module = $manager->getModule("jiwonpapa-page_builder"); } if ($module === null) { throw new \RuntimeException("Page Builder module is not loaded."); } $manager->syncDeclarativeArtifacts($module);' --no-ansi
fi

module_status="$(php artisan tinker --execute='$record = app(\App\Contracts\Repositories\ModuleRepositoryInterface::class)->findByIdentifier("jiwonpapa-page_builder"); echo $record?->status ?? "absent";' --no-ansi)"
if [[ "$module_status" != *active* ]]; then
  php artisan module:activate "$module_id" --no-interaction --no-ansi
fi
php artisan module:refresh-layout "$module_id" --no-interaction --no-ansi
php artisan optimize:clear --no-ansi >/dev/null
php artisan module:cache-clear --no-ansi >/dev/null
php artisan tinker --execute='$manager = app(\App\Extension\ModuleManager::class); $manager->loadModules(); $module = $manager->getModule("jiwonpapa-page_builder"); if ($module === null) { throw new \RuntimeException("Page Builder module is not loaded."); } $updated = app(\App\Contracts\Repositories\ModuleRepositoryInterface::class)->updateByIdentifier("jiwonpapa-page_builder", ["vendor" => $module->getVendor(), "version" => $module->getVersion(), "github_url" => $module->getGithubUrl(), "metadata" => $module->getMetadata(), "config" => $module->getConfig(), "update_available" => false, "updated_at" => now()]); if ($updated !== 1) { throw new \RuntimeException("Page Builder module registry was not updated."); }' --no-ansi

if [[ -d "$rollback_path" ]]; then
  mv "$rollback_path" "$backup_root/module-before-directory"
fi
trap - ERR

printf 'release_id=%s\nartifact_sha256=%s\nbackup=%s\n' "$release_id" "$artifact_sha" "$backup_root" > "$backup_root/DEPLOYED"
echo "Staging module deployed: $release_id"
