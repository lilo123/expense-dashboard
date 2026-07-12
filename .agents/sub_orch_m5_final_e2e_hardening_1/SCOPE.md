# Scope: M5 - Final Milestone: E2E Test Verification & Adversarial Hardening

## Architecture
- Phase 1 — E2E Test Pass (Tiers 1-4): Decomposes by test tier as sequential sub-milestones (Tier 1 → 2 → 3 → 4), each delegated to a sub-orchestrator iterating: Explorer analyzes failures → Worker fixes → Reviewer verifies → gate. A later tier does not start until the previous passes. Verifies 100% pass rate using `npx tsx e2e/run_e2e.ts`.
- Phase 2 — Adversarial Coverage Hardening (Tier 5): White-box analysis of implementation source to find untested code paths and potential bugs, then generate adversarial test cases. Loop initiates with 2 Challenger(s) (armed with `test-coverage-audit`) → produce gap report + adversarial test cases → Worker integrates tests and fixes exposed bugs → Reviewer verifies → Gate.
- Confirms zero git commits pushed to remote (`git status`).

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Tier 1 Feature Coverage Verification | `e2e/planner_tier1_feature.spec.ts` | M1, M2, M3, M4, TEST_READY.md | IN_PROGRESS |
| 2 | Tier 2 Boundary & Corner Cases Verification | `e2e/planner_tier2_boundary.spec.ts`, `e2e/adv_planner_tier2_boundary.spec.ts` | M5.1 | PLANNED |
| 3 | Tier 3 Cross-Feature Combinations Verification | `e2e/planner_tier3_pairwise.spec.ts` | M5.2 | PLANNED |
| 4 | Tier 4 Real-World Workload Scenarios Verification | `e2e/planner_tier4_workload.spec.ts`, `npx tsx e2e/run_e2e.ts` | M5.3 | PLANNED |
| 5 | Tier 5 Adversarial Coverage Hardening (Phase 2) | White-box source analysis, gap report, adversarial test generation & fixes | M5.4 | PLANNED |

## Interface Contracts
### `npx tsx e2e/run_e2e.ts` ↔ Application
- Playwright E2E integration tests verify Dual Entry state handoff, Premium Lock validation, and automated `@axe-core/playwright` accessibility audits (zero WCAG 2.1 AA/AAA violations).
- All changes must remain strictly local with zero commits pushed to remote git repositories.
