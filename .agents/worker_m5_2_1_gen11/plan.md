# Implementation Plan — M5.2 Tier 2 E2E Test Pass (Worker Gen 11)

## Goal
Successfully pass 100% of Tier 2 E2E tests (Boundary & Corner Cases) by implementing gate failure remediations in `supabase/config.toml` and `e2e/run_e2e.ts`.

## Proposed Changes

### 1. `supabase/config.toml`
- Add `health_timeout = "10m"` under `[db]` to prevent Supabase container startup from timing out during heavy concurrent load.

### 2. `e2e/run_e2e.ts`
- Implement fair FIFO queue mutex lock (`/tmp/run_e2e.queue`) in `acquireLock()` and `releaseLock()`.
- Extend lock acquisition timeout to 2 hours (`1440` attempts).
- Implement dynamic `protectedPids` tree filtering in `killLingeringProcessesScoped()` to protect parent `npm`/`npx` wrappers and child `node`/`sleep` processes of waiting instances.
- Update `teardownSupabase()` to use `ps auxww` / `ps -ww` to prevent premature process termination due to command line truncation.

## Verification Plan

### Automated Tests
Execute the full verification chain command-by-command:
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npm run lint && npm test && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && npx tsx e2e/run_e2e.ts
```

### Expected Outcome
- `npm run lint` completes with 0 errors.
- All test runners complete with exit code 0.
- No lock starvation or premature process termination occurs.
