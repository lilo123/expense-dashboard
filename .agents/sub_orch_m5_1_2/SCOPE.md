# Scope: M5.2 Tier 2 E2E Test Pass (Boundary & Corner Cases)

## Architecture
- **Goal**: Execute and pass 100% of Tier 2 boundary & corner case E2E tests (15 test cases across F1, F2, F3) defined in `TEST_READY.md`.
- **Methodology**: Iterate through the Explorer → Worker → Reviewer → Gate cycle until 100% of Tier 2 tests pass with exit code 0, no reviewer vetoes, challenger confirms correctness, and Forensic Auditor returns a flawless CLEAN verdict.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M5.2.1: Tier 2 Verification & Fix Loop | 15 test cases (5 per feature covering edge cases, Zod refinements, PRNG boundaries) | M5.1 | IN_PROGRESS |

## Interface Contracts
### `TEST_READY.md` ↔ M5.2 Sub-orchestrator
- Test Runner: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && npx tsx e2e/run_e2e.ts`
- Expected: all tests pass with exit code 0

## Code Layout
- `supabase/config.toml`: Supabase configuration (Realtime enabled, Pooler, Auth rate limits, Port 25432).
- `e2e/run_e2e.ts`: Master E2E test runner (bulletproof teardown sequence with `pkill` after `docker rm -f`, Realtime health check loop).
- `src/app/(dashboard)/budget/loading.tsx`: Budget streaming loading skeleton (aligned with BudgetPlanner.tsx).
- `src/lib/planner/*.ts`: Retirement planner business logic engines (tax, pension, spending, drawdown, simulator).
- `__tests__/planner/planner.test.ts`: Comprehensive unit tests.
