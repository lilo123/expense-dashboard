# Scope: E2E Testing Track

## Architecture
- Requirement-driven, opaque-box E2E testing track derived from `ORIGINAL_REQUEST.md`.
- No dependency on implementation internals; exercise the product as an end user would using Playwright (`npx tsx e2e/run_e2e.ts`).
- Verify Dual Entry architecture (Quick Check widget vs authenticated 7-tab SPA), state handoff via URL search params, Premium Lock validation (An-yen frosted glass Premium Lock card for free tiers), and automated `@axe-core/playwright` accessibility audits (zero WCAG 2.1 AA/AAA violations).

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Test Infra & Tier 1 Feature Coverage | `TEST_INFRA.md`, `e2e/planner_tier1_feature.spec.ts` | none | DONE |
| 2 | Tier 2 Boundary & Corner Cases | `e2e/planner_tier2_boundary.spec.ts`, `e2e/adv_planner_tier2_boundary.spec.ts` | none | DONE |
| 3 | Tier 3 Cross-Feature Combinations | `e2e/planner_tier3_pairwise.spec.ts` | none | DONE |
| 4 | Tier 4 Real-World Workload Scenarios | `e2e/planner_tier4_workload.spec.ts`, publish `TEST_READY.md` | none | DONE |
