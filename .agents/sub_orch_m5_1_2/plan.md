# Plan: M5.2 Tier 2 E2E Test Pass (Boundary & Corner Cases)

## Objective
Pass 100% of Tier 2 E2E tests (Boundary & Corner Cases, 15 test cases across F1, F2, F3) defined in `TEST_READY.md`.

## Methodology
Follow the Project Pattern's iteration loop procedure exactly:
1. **Explore**: Spawn 3 Explorers (`teamwork_preview_explorer`) with `PROJECT.md` / `SCOPE.md` paths and milestone description.
2. **Work**: Spawn 1 Worker (`teamwork_preview_worker`) with Explorer findings and milestone description. Worker implements changes, runs E2E test runner, and reports results.
3. **Review**: Spawn 2 Reviewers (`teamwork_preview_reviewer`) independently to examine correctness, completeness, robustness, and interface conformance.
4. **Challenge**: Spawn 2 Challengers (`teamwork_preview_challenger`) to empirically verify correctness.
5. **Audit**: Spawn 1 Forensic Auditor (`teamwork_preview_auditor`) to perform integrity verification.
6. **Gate**: Collect all results. If all pass, mark milestone done in `progress.md`. If any fail, loop back to step 1.

## Verification Command
`export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`
Expected: all tests pass with exit code 0.
