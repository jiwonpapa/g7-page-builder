#!/usr/bin/env bash
set -euo pipefail
# Transport/apply only. Scope selection, archive approval and retry policy live in Python.
operation="${1:?operation required}"
app_root="${2:?application root required}"
artifact="${3:?archive required}"
artifact_sha="${4:?checksum required}"
release_id="${5:?release id required}"
inventory_sha="${6:?inventory checksum required}"
version="${7:?version required}"
base_url="${8:?staging origin required}"
[[ "$release_id" =~ ^g7-page-builder-v[0-9A-Za-z][0-9A-Za-z.+-]*-[0-9a-f]{12}$ ]]
[[ "$artifact_sha" =~ ^[a-f0-9]{64}$ && "$inventory_sha" =~ ^[a-f0-9]{64}$ ]]
[[ "$app_root" == /* && "$app_root" != / && -f "$app_root/artisan" ]]
module_id=jiwonpapa-page_builder
target="$app_root/modules/$module_id"
work_root="$(dirname "$artifact")"
rollback="$app_root/modules/.${module_id}.rollback-${release_id}-${artifact_sha:0:12}"
cd "$app_root"

matches() {
  [[ -f "$target/.g7pb-artifact-sha256" && "$(< "$target/.g7pb-artifact-sha256")" == "$artifact_sha" ]] &&
    [[ -f "$target/SHA256SUMS" && "$(sha256sum "$target/SHA256SUMS" | cut -d ' ' -f 1)" == "$inventory_sha" ]] &&
    (cd "$target" && sha256sum -c SHA256SUMS >/dev/null 2>&1)
}

if [[ "$operation" == status ]]; then
  if matches; then echo 'matched=true'; else echo 'matched=false'; fi
  exit 0
fi

if [[ "$operation" == smoke ]]; then
  matches || { echo 'Remote artifact identity mismatch.' >&2; exit 2; }
  php artisan module:list --status=active --hidden --no-ansi | grep -q "$module_id"
  php artisan route:list --json | jq -e '
    ["pages/{slug}", "modules/jiwonpapa-page_builder/p/{slug}",
     "api/modules/jiwonpapa-page_builder/admin/routes/catalog",
     "api/modules/jiwonpapa-page_builder/admin/store/catalog",
     "api/modules/jiwonpapa-page_builder/admin/store/block-packs/install",
     "api/modules/jiwonpapa-page_builder/admin/store/page-kits/apply",
     "modules/jiwonpapa-page_builder/store/catalog.json",
     "api/modules/jiwonpapa-page_builder/public/home"] as $required |
    [.[].uri] as $routes | all($required[]; . as $uri | [$routes[] | select(. == $uri)] | length == 1)' >/dev/null
  pending="$(php artisan migrate:status --path="modules/$module_id/database/migrations" --pending=true --no-ansi)"
  [[ "$pending" != *Pending* ]]
  registry="$(php artisan tinker --execute='$record = app(\App\Contracts\Repositories\ModuleRepositoryInterface::class)->findByIdentifier("jiwonpapa-page_builder"); echo $record?->version ?? "absent";' --no-ansi)"
  [[ "$registry" == "$version" ]] || { echo 'Module registry version mismatch.' >&2; exit 2; }
  catalog="$(php artisan tinker --execute='echo config("g7-page-builder.official-store.catalog_url");' --no-ansi)"
  [[ "$catalog" == "$base_url/modules/$module_id/store/catalog.json" ]] || { echo 'Store canonical origin mismatch.' >&2; exit 2; }
  exit 0
fi

[[ "$operation" == apply ]] || { echo 'Unknown remote operation.' >&2; exit 2; }
exec 9>"$(dirname "$app_root")/.g7pb-deploy.lock"
flock -n 9 || { echo 'Another module deployment is running.' >&2; exit 3; }
if matches; then echo 'Artifact already applied; previous recovery copy retained.'; exit 0; fi
[[ "$(sha256sum "$artifact" | cut -d ' ' -f 1)" == "$artifact_sha" ]]
[[ ! -e "$rollback" ]] || { echo "Recovery copy already exists: $rollback" >&2; exit 2; }
stage="$(mktemp -d "$work_root/stage.XXXXXX")"
# Python already rejected traversal, links, duplicate members and unlisted files before transfer.
tar --no-same-owner --no-same-permissions -C "$stage" -xzf "$artifact"
staged="$stage/$module_id"
had_previous=false
if [[ -d "$target" ]]; then had_previous=true; mv "$target" "$rollback"; fi
restore_files() {
  set +e
  [[ ! -d "$target" ]] || mv "$target" "$stage/module-failed"
  if [[ "$had_previous" == true && -d "$rollback" ]]; then mv "$rollback" "$target"; fi
  echo "Apply failed; prior files restored. Failure evidence retained: $stage (DB migration is not automatically rolled back)." >&2
}
trap restore_files ERR
mv "$staged" "$target"
chmod -R u=rwX,g=rX,o=rX "$target"
status="$(php artisan tinker --execute='$record = app(\App\Contracts\Repositories\ModuleRepositoryInterface::class)->findByIdentifier("jiwonpapa-page_builder"); echo $record?->status ?? "absent";' --no-ansi)"
if [[ "$status" == absent ]]; then
  php artisan module:install "$module_id" --vendor-mode=auto --no-interaction --no-ansi
else
  php artisan migrate --path="modules/$module_id/database/migrations" --force --no-interaction --no-ansi
  php artisan tinker --execute='$manager = app(\App\Extension\ModuleManager::class); $manager->loadModules(); $module = $manager->getModule("jiwonpapa-page_builder"); if ($module === null) { throw new \RuntimeException("Module is not loaded."); } $manager->syncDeclarativeArtifacts($module);' --no-ansi
fi
status="$(php artisan tinker --execute='$record = app(\App\Contracts\Repositories\ModuleRepositoryInterface::class)->findByIdentifier("jiwonpapa-page_builder"); echo $record?->status ?? "absent";' --no-ansi)"
if [[ "$status" != active ]]; then php artisan module:activate "$module_id" --no-interaction --no-ansi; fi
php artisan module:refresh-layout "$module_id" --no-interaction --no-ansi
php artisan optimize:clear --no-ansi >/dev/null
php artisan module:cache-clear --no-ansi >/dev/null
php artisan template:cache-clear --no-ansi >/dev/null
php artisan tinker --execute='$manager = app(\App\Extension\ModuleManager::class); $manager->loadModules(); $module = $manager->getModule("jiwonpapa-page_builder"); if ($module === null) { throw new \RuntimeException("Module is not loaded."); } $updated = app(\App\Contracts\Repositories\ModuleRepositoryInterface::class)->updateByIdentifier("jiwonpapa-page_builder", ["vendor" => $module->getVendor(), "version" => $module->getVersion(), "github_url" => $module->getGithubUrl(), "metadata" => $module->getMetadata(), "config" => $module->getConfig(), "update_available" => false, "updated_at" => now()]); if ($updated !== 1) { throw new \RuntimeException("Module registry was not updated."); }' --no-ansi
printf '%s\n' "$artifact_sha" > "$target/.g7pb-artifact-sha256"
trap - ERR
echo "Applied $release_id. Recovery copy retained: $rollback"
