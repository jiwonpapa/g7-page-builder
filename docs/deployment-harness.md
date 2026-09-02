# Release and deployment control

Python controls release identity, archive validation, progress and retry policy on
the developer/CI machine. Customer servers continue to need PHP and ordinary Linux
deployment tools only. Existing release/deploy/smoke shell entry points are thin
Python launchers; Make commands and staging environment variables remain.

## Required evidence, not another product test phase

Every command first uses the existing coordinator release guard: the integration
task owns the runtime, the checkout is clean and its current HEAD was validated.
It then checks the environment build receipt against current build inputs and all
current dist outputs, including the ignored manager bundle. Missing or stale build
proof requests the specific build operation; it does not launch coverage, content
rendering, E2E, a full audit or any new human-approval gate.

    python3 scripts/g7pb.py release package --task integration-id
    python3 scripts/g7pb.py release deploy --task integration-id
    python3 scripts/g7pb.py release smoke --task integration-id

The build runtime defaults to Docker. Use --build-runtime local only when that is
where the recorded build was actually produced. TASK, G7PB_RELEASE_ARTIFACT,
G7PB_STAGING_SSH, G7PB_STAGING_ROOT and G7PB_STAGING_URL retain their roles.

## Artifact identity

Packaging selects tracked product inputs plus the complete proven dist directory.
It excludes untracked source files, environment files, sourcemaps and symlinks.
BUILD-INFO contains the full verified commit, source tree, version, build
fingerprint, schema and compiler version. SHA256SUMS covers every payload file and
BUILD-INFO. The tar/gzip output is deterministic, and an identical existing archive
is reused rather than overwritten.

Before any network operation, deployment checks:

- Current verified commit and aligned module/package/lock versions.
- The archive's full commit, version and build fingerprint.
- Exact agreement of archive files with current tracked source and proven dist.
- Exact checksum coverage, no duplicate tar members, links, devices, absolute
  paths, traversal, or files outside the module directory.

Checksums establish physical file identity only. They never select or launch
product tests. Old archives cannot be accepted merely because their filename looks
like the current version. Legacy archives without the new build proof are not
silently promoted to trusted artifacts.

## Deployment and recovery

The Python controller observes remote artifact identity before sending files.
The remote apply script keeps a single deployment lock and uses existing public
G7 installation, activation, migration, declarative/layout and registry APIs. It
does not access G7 model tables directly.

| Observed/progress state | Next operation |
| --- | --- |
| Different or absent artifact | Target preflight, transfer, apply |
| Matching artifact; FPM reload incomplete | Reload, then required smoke |
| Matching artifact; smoke failed | Smoke only |
| Matching artifact and successful same-target smoke receipt | Reuse smoke result |
| Explicit --force | Repeat required smoke, never transfer or product tests |

Remote identity includes the artifact marker, trusted inventory hash and deployed
file checksums. A stale local receipt alone is insufficient to skip deployment.
If remote apply succeeds but writing local progress fails, the next run observes
the already-applied artifact and does not replace files again.

Prior module files are retained in the exact rollback directory printed by the
remote script. Apply failure restores prior files and retains failed staging data.
Database migrations are **not** claimed to be automatically reversible. Deployment
does not silently delete rollback copies, failed staging evidence or upload files;
non-blocking cleanup remains a separate deferred operation.

## Minimum smoke

Required smoke checks /up, admin login, the native manager shell, all eight
JS/CSS asset URLs, deployed artifact identity, active module/registry version,
required module routes, pending module migrations and Store canonical origin.
It does not download every Store archive/preview or rerun content/editor E2E.

Preflight no longer requires unused mysqldump, and free-space requirements
come from this archive's compressed plus expanded size instead of an arbitrary
fixed one-gigabyte threshold.

## Infrastructure acceptance

Release tests create small temporary archives and use a fake transport. They
exercise source/dist mismatch, unsafe tar entries, omitted checksum coverage,
old-archive rejection before transport, deterministic packaging, exact-archive
reuse, post-apply progress loss, reload/smoke-only retries and forced smoke.
They do not connect to a server, install dependencies, build the product, render
content or deploy a release. Production operation remains unexecuted until an
authorized release uses this path.
