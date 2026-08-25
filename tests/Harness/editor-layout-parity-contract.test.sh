#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
fixture_root="$(mktemp -d "${TMPDIR:-/tmp}/g7pb-editor-layout-parity.XXXXXX")"
trap 'rm -rf "$fixture_root"' EXIT

copy_fixture() {
  rm -rf "$fixture_root/fixture"
  mkdir -p "$fixture_root/fixture/scripts" "$fixture_root/fixture/tests/E2E" \
    "$fixture_root/fixture/resources/css"
  cp "$repo_root/package.json" "$fixture_root/fixture/package.json"
  cp "$repo_root/resources/css/page-builder-editor.css" \
    "$fixture_root/fixture/resources/css/page-builder-editor.css"
  cp "$repo_root/tests/E2E/editorLayoutParity.spec.ts" \
    "$fixture_root/fixture/tests/E2E/editorLayoutParity.spec.ts"
}

expect_failure() {
  local expected="$1"
  if node "$repo_root/scripts/check-editor-layout-parity.mjs" --root "$fixture_root/fixture" \
    >"$fixture_root/stdout" 2>"$fixture_root/stderr"; then
    echo "Expected editor layout parity contract failure: $expected" >&2
    exit 1
  fi
  grep -Fq "$expected" "$fixture_root/stderr" || {
    echo "Missing failure message: $expected" >&2
    sed -n '1,120p' "$fixture_root/stderr" >&2
    exit 1
  }
}

node "$repo_root/scripts/check-editor-layout-parity.mjs" --root "$repo_root"

copy_fixture
perl -0pi -e 's/box-sizing: border-box;/box-sizing: content-box;/' \
  "$fixture_root/fixture/resources/css/page-builder-editor.css"
expect_failure 'Puck iframe 제품 캔버스의 scoped border-box reset이 필요합니다.'

copy_fixture
perl -0pi -e 's/ALL_95_PRESET_LAYOUT_GATE/ALL_PRESET_LAYOUT_REMOVED/' \
  "$fixture_root/fixture/tests/E2E/editorLayoutParity.spec.ts"
expect_failure '95개 프리셋 편집/미리보기 gate가 필요합니다.'

copy_fixture
perl -0pi -e 's/editor\.contentLeft - preview\.contentLeft/editor.contentLeft - editor.contentLeft/' \
  "$fixture_root/fixture/tests/E2E/editorLayoutParity.spec.ts"
expect_failure '편집기/미리보기 왼쪽 content edge 비교가 필요합니다.'

copy_fixture
perl -0pi -e 's/root\.scrollWidth - root\.clientWidth/0/' \
  "$fixture_root/fixture/tests/E2E/editorLayoutParity.spec.ts"
expect_failure 'iframe/preview document 가로 overflow 측정이 필요합니다.'

copy_fixture
perl -0pi -e 's# ?tests/E2E/editorLayoutParity\.spec\.ts##' "$fixture_root/fixture/package.json"
expect_failure 'test:e2e:product가 tests/E2E/editorLayoutParity.spec.ts를 반드시 실행해야 합니다.'

echo 'editor-layout-parity-contract: PASS'
