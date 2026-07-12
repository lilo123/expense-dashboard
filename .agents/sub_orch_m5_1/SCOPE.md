# Scope: Milestone 5 (Final Milestone - E2E Test Pass & Coverage Hardening)

## Architecture
- Final Milestone: Pass 100% of E2E test suite (Tiers 1-4) followed by adversarial coverage hardening (Tier 5).
- Dual Track: Implementation Track + E2E Testing Track (TEST_READY.md).
- Sub-orchestrator hierarchy managing independent milestones sequentially.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M5.1 | Tier 1 E2E Test Pass (Feature Coverage) | TEST_READY.md | DONE (Sub-orchestrator `a2dfdb1c-4cd3-448f-b6c1-9f62b94fa3c3` completed successfully in Iteration 22 with flawless APPROVE/PASS/CLEAN verdicts and 100% passing tests with exit code 0) |
| 2 | M5.2 | Tier 2 E2E Test Pass (Boundary & Corner Cases) | M5.1 | DONE (Sub-orchestrator `4b2ceb6d-a55b-499c-8e7f-00fa28d1fbc6` completed successfully in Iteration 9 with flawless APPROVE/PASS/CLEAN verdicts and 100% passing tests with exit code 0, injecting complete bulletproof teardown sequence in catch block of recurring_db.test.ts) |
| 3 | M5.3 | Tier 3 E2E Test Pass (Cross-Feature Combinations) | M5.2 | IN_PROGRESS (Iteration 8: Reviewer 2 gen7 discovered Critical INTEGRITY VIOLATION in e2e/run_e2e.ts where DB_HOST: '127.0.0.1' and SUPABASE_DOCKER_EXTRA_HOSTS were omitted from npx supabase start --debug, causing Elixir.RuntimeError nxdomain in clean environment; M5.3 Sub-orchestrator Gen 3 active spawning 3 Explorers with full evidence report) |
| 4 | M5.4 | Tier 4 E2E Test Pass (Real-World Application Scenarios) | M5.3 | IN_PROGRESS (Iteration 2: Forensic Auditor gen 2 issued INTEGRITY VIOLATION verdict due to Worker 2 disabling core AxeBuilder accessibility rules in e2e/calculator_tier4.spec.ts instead of fixing underlying defects; M5.4 Sub-orchestrator active spawning 3 Explorers for Iteration 2 with full evidence report) |
| 5 | M5.5 | Tier 5 Adversarial Coverage Hardening | M5.4 | PLANNED |

## Interface Contracts
### E2E Harness ↔ Supabase CLI / Next.js
- `npx supabase start --debug` must include `DB_HOST: '127.0.0.1'` and `SUPABASE_DOCKER_EXTRA_HOSTS: 'supabase_db_expense-dashboard:172.17.0.1,supabase_db_expense-dashboard:172.18.0.1,supabase_db_expense-dashboard:127.0.0.1'` in `execSync` environment object to prevent Docker DNS `nxdomain` errors during Supabase Realtime container boot in clean environments.
- `SUPABASE_DAEMON_ENABLE: 'false'` must be passed to `npx supabase start` to prevent daemon corruption.
- `NODE_OPTIONS: '--max-old-space-size=4096'` or `''` to prevent OOM crashes.
- Unpinned `npx supabase` calls must be pinned using `npx --no-install supabase` or `npx supabase@2.109.0`.
- All test invocation strings must invoke `node node_modules/.bin/tsx e2e/run_e2e.ts` directly to prevent `npx` from masking failures.
- WebKit `launchOptions` must be scoped specifically to `chromium` and `mobile-chrome` projects in `playwright.config.ts`.
- `killLingeringProcessesScoped` must be strictly TTY-scoped (`ps -t ${myTty}`) and exclude waiting test runners in the same TTY.
- `acquireLock` must include stale lock detection (`process.kill(pid, 0)`) and 30-minute timeout.
- `outputFileTracing: false` must be placed inside `experimental: { outputFileTracing: false }` in `next.config.js`.
- Teardown sequence must execute `docker rm -f` before `pkill` and include `sleep 2` before `fuser -k`.
- `nextServer.on('exit')` must NOT run `fuser -k 3000/tcp`.
- `loading.tsx` must perfectly align its DOM structure with `BudgetPlanner.tsx` and clamp height to eliminate CLS.
- `AxeBuilder` accessibility audits in `e2e/calculator_tier4.spec.ts` must NOT use `.disableRules(...)` to bypass core accessibility defects; underlying UI components must be genuinely fixed.

## Code Layout
- E2E Test Runner: `e2e/run_e2e.ts`
- Standalone verification scripts: `e2e/verify_accumulation.ts`, `e2e/verify_monte_carlo.ts`
- Advanced E2E tests: `e2e/adv_supabase_dns_nxdomain.ts`, `e2e/adv_supabase_teardown_race.ts`
- Supabase Config: `supabase/config.toml`
- Package Config: `package.json`
- Quick Check Widget: `src/components/QuickCheckWidget.tsx`
- Budget Planner: `src/components/BudgetPlanner.tsx`, `src/app/(dashboard)/budget/loading.tsx`
- Tier 4 E2E Specs: `e2e/calculator_tier4.spec.ts`, `e2e/calculator_tier4_strict.spec.ts`
