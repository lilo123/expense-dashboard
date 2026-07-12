# BRIEFING — 2026-07-04T08:41:00Z

## Mission
Investigate `e2e/run_e2e.ts` and the codebase, analyze the root causes of Supabase connection refusals, verify underlying E2E test failures, and recommend a concrete, bulletproof fix strategy.

## 🔒 My Identity
- Archetype: teamwork_preview_explorer
- Roles: teamwork_preview_explorer
- Working directory: /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_tier1_iter4_3
- Original parent: a2dfdb1c-4cd3-448f-b6c1-9f62b94fa3c3
- Milestone: Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Ensure `pkill -9 -f next` remains removed (replaced by `fuser -k 3000/tcp`)
- Ensure `try...catch` around Playwright test execution remains removed

## Current Parent
- Conversation ID: a2dfdb1c-4cd3-448f-b6c1-9f62b94fa3c3
- Updated: 2026-07-04T08:41:00Z

## Investigation State
- **Explored paths**: `e2e/run_e2e.ts`, `e2e/seed.ts`, `e2e/verify_accumulation.ts`, `e2e/verify_monte_carlo.ts`, `e2e/auth.spec.ts`, `e2e/dashboard.spec.ts`, `e2e/budget_planner_propagation.spec.ts`, `e2e/yearly_master_toggle.spec.ts`, `src/app/calculator/CalculatorParams.tsx`, `src/workers/simulation.worker.ts`, `src/SimulationProvider.tsx`, `src/lib/marketData.ts`, `src/lib/globalMarketData.ts`, `src/schemas/simulationSchema.ts`, `src/types/simulation.ts`.
- **Key findings**:
  1. `e2e/run_e2e.ts` currently deletes `supabase/.temp` in `setup()`, destroying the generated API gateway configurations and credentials.
  2. `e2e/run_e2e.ts` uses `--ignore-health-check` during `npx supabase start` and immediately follows it with `docker start`, breaking container dependency startup order (Kong starting before Auth/Rest are ready) and causing `connect ECONNREFUSED 127.0.0.1:54321`.
  3. `pkill -9 -f next` is successfully absent (replaced by `fuser -k 3000/tcp`).
  4. `try...catch` is successfully absent around Playwright test execution.
  5. Playwright E2E tests are robustly hardened with `#hydrated-marker` checks, explicit timeouts, and forced clicks to bypass animation instability.
- **Unexplored areas**: None. Comprehensive forensic audit complete.

## Key Decisions Made
- Recommend exact, surgical changes to `setup()` in `e2e/run_e2e.ts` to remove `rm -rf supabase/.temp`, remove `--ignore-health-check`, remove the redundant `docker start`, while preserving `npx supabase stop --no-backup`, `docker rm -f $(docker ps -aq)`, and `rm -rf ~/.supabase /tmp/supabase*`.

## Artifact Index
- /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_tier1_iter4_3/ORIGINAL_REQUEST.md — Original request from parent agent.
- /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_tier1_iter4_3/handoff.md — Final 5-component handoff report with forensic audit and fix strategy.
