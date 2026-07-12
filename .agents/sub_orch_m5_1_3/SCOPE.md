# Scope: M5.3 Tier 3 E2E Test Pass (Cross-Feature Combinations)

## Architecture
- **E2E Testing Harness (`e2e/run_e2e.ts`, `e2e/verify_*.ts`)**: Playwright test runner executing 8 Tier 3 test cases covering pairwise feature interactions (e.g., QuickCheckWidget interacting with Full Calculator state, Scrambled Monte Carlo interacting with BOLA defense, drawdown engine interacting with Premium entitlement checks).
- **Verification Flow**: Iterates through Explorer → Worker → Reviewer → Challenger → Auditor loop until 100% of Tier 3 tests pass with exit code 0 and a flawless CLEAN audit verdict.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M5.3.1: Tier 3 Verification & Fix Loop | Execute 8 Tier 3 pairwise feature interaction tests, analyze failures, implement fixes, and verify 100% passing tests with exit code 0 | M5.2 | IN_PROGRESS |

## Interface Contracts
### `e2e/run_e2e.ts` ↔ Playwright Test Runner
- **Command**: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`
- **Expected**: All tests pass with exit code 0. Zero TypeScript errors. Flawless CLEAN audit verdict.
