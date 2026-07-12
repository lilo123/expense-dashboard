# Task Description: Worker 1 (Milestone 5.4 - Tier 4 E2E Test Pass)

## Objective
Implement the surgical fix strategy recommended by the Explorers to achieve 100% passing Tier 4 E2E tests (Real-World Application Scenarios) with exit code 0.

## Mandatory Integrity Warning
> DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Domain Skill
Load and follow the Jetski skill at:
`/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md`

## Synthesis of Explorer Findings

### Consensus
- **Business Logic & Tier 1-3 Integrity**: All 7 standalone verification scripts (`verify_global_market_data.ts`, `verify_accumulation.ts`, `verify_monte_carlo.ts`, `verify_tier3_combinations.ts`, `stress_test_m4.ts`, `stress_test_m4_edge_cases.ts`, `adv_planner_gaps.ts`) complete successfully with exit code 0 and 0 failures.
- **E2E Test Runner Concurrency Safety**: The file-based mutex lock `/tmp/run_e2e.lock` correctly prevents concurrent database resets and port collisions between swarm workers.
- **Missing Accessibility Audits (Explorer 1 & 2)**: `package.json` does not include `@axe-core/playwright` and no Playwright test file in `e2e/` executes automated accessibility audits on the Financial Retirement Planner views (`QuickCheckWidget.tsx`, `/plans`, `/calculator`, Premium Lock card).
- **Interface Contract Violations (Explorer 3)**: Identified 6 distinct discrepancies and gaps across Supabase Realtime health checks (`e2e/run_e2e.ts`), teardown sequences in 9 locations (`e2e/adv_supabase_dns_nxdomain.ts`, `e2e/adv_supabase_teardown_race.ts`, `e2e/test_fuser.ts`, `e2e/test_pkill.ts`, `e2e/test_supabase_pkill.ts`), process hierarchy invocation (`TEST_READY.md`), Next.js build `NODE_OPTIONS` sanitization (`e2e/run_e2e.ts`), DOM alignment/CLS (`src/app/(dashboard)/budget/loading.tsx`), and seeding resilience (`e2e/seed.ts`).

### Resolved Conflicts
- None. All Explorers are in complete alignment.

### Dissenting Views
- None.

### Gaps
- The automated `@axe-core/playwright` accessibility audits mandated by `ORIGINAL_REQUEST.md` and `TEST_READY.md` are missing.
- Contract violations exist in `e2e/run_e2e.ts`, `e2e/seed.ts`, `TEST_READY.md`, `src/app/(dashboard)/budget/loading.tsx`, and teardown test files.

## Surgical Fix Strategy

### 1. Install Dependency & Create Tier 4 Test Suite
- **`package.json`**: Add `"@axe-core/playwright": "^4.9.1"` to `devDependencies`. (Run `npm install` if necessary).
- **`e2e/calculator_tier4.spec.ts`**: Create this file to implement the 7 Real-World Application Scenario test cases, specifically importing `AxeBuilder` from `@axe-core/playwright` and running `const accessibilityScanResults = await new AxeBuilder({ page }).analyze(); expect(accessibilityScanResults.violations).toEqual([]);` across the Dual Entry Quick Check widget (`/`), the authenticated Detailed Plan Builder (`/calculator`), and the Premium Lock card views.

### 2. Update `e2e/run_e2e.ts`
- Modify line 424 to accept only valid health statuses: `if (res.ok || res.status === 200 || res.status === 404)` (remove 503 and 502).
- Modify line 384 to sanitize `NODE_OPTIONS`: `execSync('npm run build', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '' } });`.

### 3. Standardize Teardown Sequences Across All 9 Locations
- Update `e2e/adv_supabase_dns_nxdomain.ts`, `e2e/adv_supabase_teardown_race.ts` (both blocks), `e2e/test_fuser.ts`, `e2e/test_pkill.ts`, and `e2e/test_supabase_pkill.ts` to match the exact `teardownSupabase()` implementation in `e2e/run_e2e.ts` (ensuring `pkill` executes after `docker rm -f` and after the `while docker ps -a -q` loop).

### 4. Update `TEST_READY.md`
- Modify line 4 to invoke the test runner via `exec npx tsx e2e/run_e2e.ts` (replacing `node node_modules/.bin/tsx e2e/run_e2e.ts`).

### 5. Align `src/app/(dashboard)/budget/loading.tsx` with `src/components/BudgetPlanner.tsx` (CLS Fix)
- Update `loading.tsx` line 10: `<div data-testid="budget-planner-skeleton" className="flex flex-col gap-6 text-left animate-pulse pb-16 scroll-pt-[120px]">`.
- Update `loading.tsx` line 22: `<div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border border-white/40 shadow-md rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 transition-all">`.
- Update `loading.tsx` line 35: `<div key={monthName} className="bg-white/60 backdrop-blur-xl border border-white/30 shadow-sm rounded-3xl overflow-hidden transition-all">`.
- Update `loading.tsx` line 51: `<div className="px-6 pb-6 text-left animate-fade-in border-t border-white/20 pt-4 flex flex-col gap-6">`.

### 6. Enhance Seeding Resilience in `e2e/seed.ts`
- Wrap the `supabase.auth.admin.createUser` calls for `founder@an-yen.com` (lines 207-223) and `standard-user@example.com` (lines 225-241) in robust retry loops (15 retries) matching the pattern used for `test-user@example.com`.

## Verification & Output Requirements
1. Run `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec npx tsx e2e/run_e2e.ts`.
2. Ensure all tests pass successfully with exit code 0.
3. Write `handoff.md` in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_4_tier4_1`) documenting your changes and verification results, then send a completion message to your parent.
