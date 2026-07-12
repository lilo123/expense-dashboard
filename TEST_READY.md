# E2E Test Suite Ready

## Test Runner
- Command: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec node node_modules/.bin/tsx e2e/run_e2e.ts`
- Expected: all tests pass with exit code 0

## Coverage Summary
| Tier | Count | Description |
|------|------:|-------------|
| 1. Feature Coverage | 15 | 5 per feature across F1, F2, F3 |
| 2. Boundary & Corner | 15 | 5 per feature covering edge cases, Zod refinements, and PRNG boundaries |
| 3. Cross-Feature | 8 | Pairwise coverage of major feature interactions and pre-push smoke tests |
| 4. Real-World Application | 7 | Multi-browser matrix, accessibility audits, hydration resilience, and CLS bounding box checks |
| **Total** | **45** | Comprehensive opaque-box test suite adhering to 4-Tier Productivity Workflow |

## Feature Checklist
| Feature | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---------|:------:|:------:|:------:|:------:|
| F1: Global Market Data Toggle | 5 | 5 | ✓ | ✓ |
| F2: Accumulation Phase & Timeline Toggle | 5 | 5 | ✓ | ✓ |
| F3: Simulation Mode Toggle (Monte Carlo) | 5 | 5 | ✓ | ✓ |
