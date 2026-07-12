# Scope: M5.4 Tier 4 E2E Test Pass (Real-World Application Scenarios)

## Architecture
- **Phase 1 (E2E Test Pass - Tiers 1-4)**: Sequential execution and verification of the E2E test suite defined in `TEST_READY.md`. Each tier must pass 100% before advancing to the next tier.
- **M5.4 Scope**: Tier 4 Real-World Application Scenarios (7 test cases covering multi-browser matrix, a11y audits, hydration, CLS).

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M5.4.1: Tier 4 Verification & Fix Loop | Execute Explorer -> Worker -> Reviewer -> gate loop until 100% pass | M5.3 | IN_PROGRESS |

## Interface Contracts
### `TEST_READY.md` ↔ M5.4 Sub-orchestrator
- Test Runner: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`
- Expected: all tests pass with exit code 0
