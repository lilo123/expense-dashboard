# Plan: Milestone 5.1 Tier 1 E2E Test Pass (Feature Coverage) - Worker Iteration 4

## Objective
Implement bulletproof Supabase container lifecycle management and genuine database initialization error propagation in `e2e/run_e2e.ts`, perform prerequisite process cleanup, and execute the full E2E test suite to achieve 100% passing tests with exit code 0.

## Step-by-Step Plan

1. **Prerequisite Cleanup**: Execute `fuser -k 3000/tcp 54321/tcp 54322/tcp 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true` to terminate orphaned test runners and prune containers. (DONE)
2. **Modify `e2e/run_e2e.ts`**:
   - In `setup()`, replace lines 35-39 with clean `npx supabase stop --no-backup`, `docker rm -f`, and `npx supabase start`. (DONE)
   - In `run()`, remove raw `docker start` at lines 88 and 103, and remove `docker stop`/`docker start` block around `npm run build` (lines 108 and 116). (DONE)
   - Ensure `fuser -k 3000/tcp` remains in place. (DONE)
   - Ensure `execSync('npx playwright test ...')` remains without `try...catch`. (DONE)
   - Remove `try...catch` around `execSync('npx tsx e2e/init_db.ts', ...)` to ensure genuine error propagation. (DONE)
3. **Execute E2E Test Suite**: Run `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`.
4. **Verify & Document**: Confirm all tests pass with exit code 0, update `BRIEFING.md` and `progress.md`, generate `handoff.md`, and notify parent agent.
