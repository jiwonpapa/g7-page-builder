# Python infrastructure migration

## Scope and stop conditions

Customer PHP/React runtime, document schemas and existing content are not rewritten.
Python is a local/CI controller. Shell is limited to process/remote-operation adapters.
No deployment, full-catalog generation or product E2E is part of this tool migration.

The migration preserves the existing Local integration record when its owner
explicitly authorizes handoff; it does not delete other worktrees or rewrite their
changes. Harness-only browser definition edits use selected Playwright collection
(`--list`), not a claim that the product was exercised in a browser.

`scripts/coord-harness.sh` is a Python entry shim. `quality-coordination` runs the
Python harness tests; the previous full shell compatibility fixture remains an
explicit one-time `quality-coordination-compat` command, outside routine checks.
`dev-sync` requires `SYNC_BASE` and no longer builds assets. PHP and frontend
checks prepare only Composer and npm respectively. Release wrappers pass TASK
to the Python release guard instead of running content audits themselves.

| Phase | Deliverable | Bounded evidence |
| --- | --- | --- |
| 1 | One Python plan/runner, input-scoped receipts, no automatic full fallback | Planner selection and mocked invocation counts |
| 2 | Typed task metadata, ownership/lock and Git transitions | Temporary Git fixtures, failure/interrupt recovery |
| 3 | Kit/block/preset/shell selection, read-only checks | Selected-ID and isolated-output fixtures |
| 4 | Conditional dependency/build/sync and shared CI plan | Mock runtime/dependency fingerprints |
| 5 | Immutable release artifact, deploy resumption, old policy retirement | Temporary archives and mocked transport |

## Execution contract

`python3 scripts/g7pb.py plan --base REF --json` is read-only. `run` executes that
same selection. Unknown paths are an actionable mapping error, never permission
to run every test. Full RC is explicit (`--full`), with a runtime owner.
No change or no executable inputs is reported as `NO_CHECKS`, not product acceptance.
One failed gate stops; a retry reuses successful gates only when their command,
selected inputs and tool environment match. Runtime-state checks are not persisted
as source-only receipts. A changed commit ID alone does not invalidate a receipt.

Content criticism and unreviewed audit records are not release approvals or
automatic blockers. Technical data loss, invalid artifacts and broken required
behavior remain failures. No human-approval workflow is introduced.

## Compatibility and safety

Make command names and existing task histories remain available during migration.
Only one implementation writes shared task state. Preserve active leases and
submitted SHAs; do not force-release someone else's task to switch implementations.
Shadow comparison means planning only, never running commands twice.
The shared Local `g7pb-dev` remains runtime-owner-only. No new customer Python
dependency, database, daemon, queue or generic workflow platform is introduced.

Enforcement applies to this project's entrypoints/CI, not arbitrary OS commands.
Agents must not bypass the fixed plan by calling broad product commands directly.
