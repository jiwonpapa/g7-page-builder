# Scoped environment preparation

Python is a **local/CI control tool**, not a customer-server dependency. Docker,
the fixed `g7pb-dev` runtime, the pinned G7 checkout and public installer APIs are
unchanged. The coordinator's exclusive runtime lease is still required for every
Docker mutation, including dependency preparation and builds.

## Commands and mutation boundary

`python3 scripts/g7pb.py environment` accepts these operations:

| Operation | Default behavior | Explicit mutation |
| --- | --- | --- |
| `status` | Read stored preparation records; not a health claim | None |
| `deps --only npm\|composer\|all` | Probe tools and installed metadata, show reuse/required | Add `--apply` |
| `build` | Show whether inputs and current dist match a prior build | Add `--apply` |
| `sync --base REF` or `sync --paths FILE ...` | Show path-selected G7 commands; no Docker probe | Add `--runtime docker --task ID --apply` |

Dependency/build commands default to the local checkout. Add `--runtime docker
--task ID` for the integration runtime. Never run Docker mutations from a worktree.
Planning does not install dependencies, start containers, build assets, update
content, or save receipts. It may run read-only tool/version/installed-file probes.

Examples:

```sh
python3 scripts/g7pb.py environment deps --only npm
python3 scripts/g7pb.py environment deps --only composer --runtime docker --task integration-id --apply
python3 scripts/g7pb.py environment build --runtime docker --task integration-id --apply
python3 scripts/g7pb.py environment sync --base <previous-runtime-sha>
python3 scripts/g7pb.py environment sync --paths resources/layouts/user/page.json --runtime docker --task integration-id --apply
```

Use the integration's actual previous runtime revision for `--base`; `HEAD` after
committing is not a substitute. There is no implicit whole-module synchronization.
The compatibility script `scripts/dev-sync-module.sh` forwards these arguments and
does not mutate anything unless `--apply` is present.

## What is reused

Dependency identity includes lockfiles, install configuration, the actual tool
versions, platform/runtime identity, command and installed metadata. A product
version label alone is excluded. A missing/changed node_modules or vendor metadata
file invalidates reuse. A failed installation writes no success. Receipts are
atomic and stored below `.runtime/harness`; concurrent preparation is serialized.

Build identity includes JS/CSS sources, actual imported contract/catalog JSON,
Vite helper/configuration and TypeScript configuration, dependency identity and
Vite environment inputs. Reuse also requires every expected JS/CSS/module inventory
output and all current dist hashes to match. This is preparation reuse, not a
replacement for a selected product test or release provenance check.

## Runtime effects

| Change | Selected operations |
| --- | --- |
| Ordinary PHP implementation | No cache sweep or FPM restart; development opcache validates timestamps |
| Composer/module metadata | Autoload; module declarations/registry only when affected |
| Module migrations | Only module migration command |
| Module routes/providers | Public declarative synchronization and relevant caches |
| Module-owned layouts/views | Layout refresh when layouts changed, corresponding caches |
| CSS/JS, documents, tests | No PHP runtime synchronization |
| Docker configuration/image | Report rebuild/up requirement; do not pretend cache clearing applies new image files |

`--restart-fpm` is an explicit exceptional operation, not a default after PHP edits.
No SEO/global cache purge is performed without an owned affected input. Runtime
actions are not reused solely because the source SHA matches: containers and DB
state are external to the source tree.

## CI

PRs and `main` pushes use a single scoped job. Feature pushes do not duplicate their
PR workflow, and newer runs cancel superseded runs for the same PR/ref. Checkout
history is complete so the same Python plan can select changes. Python 3.14 is
always available; Node 24, PHP 8.5 and pinned G7 dependencies are prepared only when
the plan requires them. Local and CI call the same plan/run commands.

Unclassified paths do not trigger an automatic full suite. A plan needing browser
runtime is explicitly blocked on an unprepared hosted runner: it is not reported
as a passed/zero-test browser check. The existing lease-owned integration runtime
must execute those selected gates; no production URL or credentials are inferred.

Infrastructure tests use only temporary fixtures and mocked subprocess calls. They
verify command selection, reuse invalidation, failed-install behavior and runtime
guards without running npm/composer installs, product builds, Docker or deployment.
