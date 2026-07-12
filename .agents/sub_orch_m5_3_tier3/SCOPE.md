# Scope: Milestone 5.3 (Tier 3 E2E Test Pass - Cross-Feature Combinations)

## Architecture
- `e2e/run_e2e.ts` acts as the master E2E test runner executing Playwright tests against a local Supabase instance and Next.js server.
- `teardownSupabase()` strictly follows the Teardown Sequence contract: `npx supabase stop --no-backup` -> `sleep 5` buffer -> `docker rm -f` -> `docker network rm` -> `pkill -9 -f "supabase-go"` -> `pkill -9 -f "npx supabase"` -> `pkill -9 -f "bin/supabase"` -> `while docker ps -aq...` wait loop -> `sleep 20` buffer -> `sleep 2` buffer before `fuser -k`.
- `run()` enforces explicit `process.exit(1)` in its `catch` block after `cleanup()` so `tsx` correctly propagates exit code 1 on failure, and explicit `process.exit(0)` in its success path so successful test runners do not hang on open event loop handles.
- File-based mutex locking (`/tmp/run_e2e.lock`) and TTY-scoped process cleanup (`ps -t ${myTty}`) prevent concurrent test runners from colliding or triggering process elimination wars.
- `TEST_READY.md` invokes `node node_modules/.bin/tsx e2e/run_e2e.ts` directly to prevent `npx` from swallowing SIGKILL/SIGTERM exit codes.
- `supabase/config.toml` has `[realtime] enabled = true` and unsupported `health_timeout` keys removed to prevent Supabase CLI v2.109.0 decoding failures.
- `next.config.js` has `outputFileTracing: false` correctly placed within the `experimental` block.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M5.3.1 | Tier 3 E2E Test Pass (Cross-Feature Combinations) | M5.2 | DONE |

## Interface Contracts
### `e2e/run_e2e.ts` ↔ `TEST_READY.md`
- Master E2E test runner invoked directly via `node node_modules/.bin/tsx e2e/run_e2e.ts` to ensure 100% accurate exit code propagation.
