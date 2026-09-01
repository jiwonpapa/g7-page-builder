#!/usr/bin/env bash
set -euo pipefail

php_sources=('scripts/build-official-store.php')
php_tests=()
files=()
if (( ${#php_sources[@]} > 0 )); then
  files+=("${php_sources[@]}")
fi
if (( ${#php_tests[@]} > 0 )); then
  files+=("${php_tests[@]}")
fi

[[ "${#files[@]}" == 1 && "${files[0]}" == 'scripts/build-official-store.php' ]]
printf 'quality-scoped-empty-array.test: PASS\n'
