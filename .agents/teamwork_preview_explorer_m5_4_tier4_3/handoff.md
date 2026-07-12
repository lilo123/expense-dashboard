# Handoff Report: Milestone 5.4 (Tier 4 E2E Test Pass - Real-World Application Scenarios)

## 1. Observation
During our exhaustive read-only investigation of the `expense-dashboard` codebase against the Milestone 5.4 Interface Contracts defined in `SCOPE.md`, we directly observed 6 distinct discrepancies and gaps:

1. **Supabase Realtime Health Check Mismatch**:
   - In `e2e/run_e2e.ts` lines 418-439, the health check loop for `http://127.0.0.1:54321/realtime/v1/health` explicitly accepts `if (res.ok || res.status === 200 || res.status === 404 || res.status === 503 || res.status === 502)` (line 424).

2. **Teardown Sequence Inconsistencies Across 9 Locations**:
   - `e2e/run_e2e.ts` implements the correct bulletproof teardown sequence where `pkill` executes after `docker rm -f` and after `while docker ps -a -q` loop (lines 110-141).
   - `e2e/adv_supabase_dns_nxdomain.ts` (lines 15-43) lacks `pkill -9 -f "supabase-go"`, `pkill -9 -f "npx supabase"`, and `pkill -9 -f "bin/supabase"` entirely.
   - `e2e/adv_supabase_teardown_race.ts` (lines 13-32 and lines 47-66), `e2e/test_fuser.ts` (lines 8-33), `e2e/test_pkill.ts` (lines 8-30), and `e2e/test_supabase_pkill.ts` (lines 8-30) execute `pkill -9 -f "supabase-go"` BEFORE the `while docker ps -aq` wait loop.

3. **Process Hierarchy & Invocation Mismatch**:
   - In `TEST_READY.md` line 4, the test runner is invoked via `node node_modules/.bin/tsx e2e/run_e2e.ts`.

4. **Next.js Build `NODE_OPTIONS` Sanitization Mismatch**:
   - In `e2e/run_e2e.ts` line 384, `npm run build` is executed with `NODE_OPTIONS: '--max-old-space-size=4096'`.

5. **DOM Alignment Mismatch between `loading.tsx` and `BudgetPlanner.tsx` (CLS Violation)**:
   - Comparing `src/app/(dashboard)/budget/loading.tsx` and `src/components/BudgetPlanner.tsx` reveals multiple structural and styling mismatches:
     - Root container: `BudgetPlanner.tsx` has `scroll-pt-[120px]` (line 194), while `loading.tsx` lacks it (line 10).
     - Sticky toolbar: `BudgetPlanner.tsx` has `sticky top-0 z-40 bg-white/80 backdrop-blur-xl border border-white/40 shadow-md rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 transition-all` (line 224), while `loading.tsx` has `bg-white/60 backdrop-blur-xl border border-white/40 shadow-md rounded-2xl p-4 flex items-center justify-between gap-4` (line 22), lacking `sticky top-0 z-40`, `bg-white/80`, `flex-wrap`, and `transition-all`.
     - Accordion container: `BudgetPlanner.tsx` has `bg-white/60 backdrop-blur-xl border border-white/30 shadow-sm rounded-3xl overflow-hidden transition-all` (line 484), while `loading.tsx` has `bg-white/60 border border-white/20 shadow-sm rounded-3xl overflow-hidden` (line 35), lacking `backdrop-blur-xl`, `transition-all`, and using `border-white/20` instead of `border-white/30`.
     - Accordion expanded content container: `BudgetPlanner.tsx` has `px-6 pb-6 text-left animate-fade-in border-t border-white/20 pt-4 flex flex-col gap-6` (line 545), while `loading.tsx` has `px-6 pb-6 pt-2 border-t border-zen-lavender/20 flex flex-col gap-6` (line 51).

6. **Seeding Resilience Gap in `e2e/seed.ts`**:
   - In `e2e/seed.ts`, while `deleteUser`, `createUser` (for test user), and table deletions correctly use retry loops, the creation of `founder@an-yen.com` (lines 207-223) and `standard-user@example.com` (lines 225-241) via `supabase.auth.admin.createUser` does NOT use retry loops.

## 2. Logic Chain
1. **Supabase Realtime Health Check**: Accepting HTTP 503 (Service Unavailable) and HTTP 502 (Bad Gateway) allows `run_e2e.ts` to proceed before Supabase Realtime is actually healthy. This violates the `SCOPE.md` contract (`accepting HTTP 200, 404, or res.ok`) and causes E2E tests relying on Realtime to fail.
2. **Teardown Sequence**: Having inconsistent teardown sequences across the 9 locations in `e2e/` causes race conditions and daemon corruption (`supabase-go`), leading to container conflicts and port binding failures during E2E test execution. The contract explicitly requires a standardized bulletproof teardown sequence across all 9 locations where `pkill` executes after `docker rm -f` and after the docker wait loop.
3. **Process Hierarchy**: Invoking `run_e2e.ts` as a child process of `node` rather than using `exec npx tsx e2e/run_e2e.ts` creates an extra process layer, breaking the grandparent PID filtering guardrail in `killLingeringProcessesScoped` (`e2e/run_e2e.ts` lines 66-108).
4. **Next.js Build `NODE_OPTIONS`**: Failing to sanitize `NODE_OPTIONS` to `''` during `npm run build` violates the contract (`NODE_OPTIONS: '' sanitization during npm run build`) and passes unintended flags/memory limits to the Next.js build process.
5. **DOM Alignment (CLS)**: The DOM structure and styling discrepancies between `loading.tsx` and `BudgetPlanner.tsx` cause significant Cumulative Layout Shift (CLS) when the streaming loading skeleton hydrates into the interactive `BudgetPlanner` component, failing the Tier 4 CLS bounding box E2E checks.
6. **Seeding Resilience**: If a transient HTTP 502 Bad Gateway error occurs during the creation of `founder@an-yen.com` or `standard-user@example.com`, their creation fails without retry, leaving `founderId` or `standardId` undefined. This causes subsequent profile upserts and E2E tests (such as `invite_workflow.spec.ts`) to fail.

## 3. Caveats
- **Read-Only Investigation**: As an explorer agent, we have strictly analyzed the codebase and identified the root causes without modifying any files or executing non-hermetic external commands.
- **Local Execution**: All findings are based on the local development environment and contracts specified in `SCOPE.md`.

## 4. Conclusion
To achieve 100% passing Tier 4 E2E tests (Real-World Application Scenarios) with exit code 0, the implementer must execute the following surgical fix strategy:

1. **Update `e2e/run_e2e.ts`**:
   - Modify line 424 to accept only valid health statuses: `if (res.ok || res.status === 200 || res.status === 404)`.
   - Modify line 384 to sanitize `NODE_OPTIONS`: `execSync('npm run build', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '' } });`.

2. **Standardize Teardown Sequences Across All 9 Locations**:
   - Update `e2e/adv_supabase_dns_nxdomain.ts`, `e2e/adv_supabase_teardown_race.ts` (both blocks), `e2e/test_fuser.ts`, `e2e/test_pkill.ts`, and `e2e/test_supabase_pkill.ts` to match the exact `teardownSupabase()` implementation in `e2e/run_e2e.ts` (ensuring `pkill` executes after `docker rm -f` and after the `while docker ps -a -q` loop).

3. **Update `TEST_READY.md`**:
   - Modify line 4 to invoke the test runner via `exec npx tsx e2e/run_e2e.ts`.

4. **Align `src/app/(dashboard)/budget/loading.tsx` with `src/components/BudgetPlanner.tsx`**:
   - Update `loading.tsx` line 10: `<div data-testid="budget-planner-skeleton" className="flex flex-col gap-6 text-left animate-pulse pb-16 scroll-pt-[120px]">`.
   - Update `loading.tsx` line 22: `<div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border border-white/40 shadow-md rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 transition-all">`.
   - Update `loading.tsx` line 35: `<div key={monthName} className="bg-white/60 backdrop-blur-xl border border-white/30 shadow-sm rounded-3xl overflow-hidden transition-all">`.
   - Update `loading.tsx` line 51: `<div className="px-6 pb-6 text-left animate-fade-in border-t border-white/20 pt-4 flex flex-col gap-6">`.

5. **Enhance Seeding Resilience in `e2e/seed.ts`**:
   - Wrap the `supabase.auth.admin.createUser` calls for `founder@an-yen.com` (lines 207-223) and `standard-user@example.com` (lines 225-241) in robust retry loops (15 retries) matching the pattern used for `test-user@example.com`.

## 5. Verification Method
To independently verify the fixes once implemented:
1. Inspect `e2e/run_e2e.ts`, `e2e/seed.ts`, `TEST_READY.md`, `src/app/(dashboard)/budget/loading.tsx`, and the teardown test files to confirm exact match with the recommended changes.
2. Execute the master verification command from `TEST_READY.md`:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec npx tsx e2e/run_e2e.ts
   ```
3. Verify that all tests pass successfully with exit code 0 and zero Cumulative Layout Shift (CLS) or teardown race condition failures.
