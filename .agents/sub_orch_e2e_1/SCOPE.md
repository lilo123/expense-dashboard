# Scope: E2E Testing Track

## Architecture
- Requirement-driven, opaque-box test suite verifying R1, R2, R3 and acceptance criteria.
- Automated verification scripts: `e2e/verify_accumulation.ts`, `e2e/verify_monte_carlo.ts`.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | E2E.1: Design Test Infra & Cases | `TEST_INFRA.md`, `e2e/verify_accumulation.ts`, `e2e/verify_monte_carlo.ts` | none | PLANNED |
| 2 | E2E.2: Publish TEST_READY.md | `TEST_READY.md` | E2E.1 | PLANNED |

## Coverage Goals
- Verify accumulation phase applies zero withdrawals, adds contributions, and compounds returns.
- Verify Scrambled Monte Carlo generates exactly 1,000 runs and is deterministic.
- Verify UI toggles and grey-out logic.
