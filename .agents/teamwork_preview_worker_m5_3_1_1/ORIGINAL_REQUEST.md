## 2026-07-07T06:16:03Z

Your identity is teamwork_preview_worker_m5_3_1_1 and your working directory is /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_3_1_1.

Load the Jetski skill at:
  /google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md

This skill provides software engineering best practices for modifying existing code, performing cross-file refactors, changing APIs, and adding features.

Your task is to implement the fixes and features required for Milestone 5.3 (M5.3: Tier 3 E2E Test Pass - Cross-Feature Combinations) for the Next.js retirement calculator expansion at `/usr/local/google/home/duynguyenn/expense-dashboard`.

### Synthesized Explorer Findings & Recommended Fix Strategy
The 3 Explorer subagents independently investigated the codebase and reached full consensus on the following architectural gaps and required fixes:

1. **Implement State Store (`src/store/useRetirementStore.tsx`)**:
   - Create `useRetirementStore.tsx` using Zustand to synchronize `QuickCheckParams` and `SimulationConfig` between the quick check widget and the full calculator.

2. **Implement Dual-Entry UI (`src/components/QuickCheckWidget.tsx`)**:
   - Create `QuickCheckWidget.tsx` to provide a lightweight input card that dispatches quick check simulations and reflects updates in the main calculator view.
   - Integrate `QuickCheckWidget` into `src/app/calculator/CalculatorParams.tsx` (or another appropriate calculator view component).

3. **Implement Backend Server Actions (`src/app/actions/retirementActions.ts`)**:
   - Create `saveSimulationConfig(config: SimulationConfig)`.
   - Enforce BOLA defense: verify `auth.uid() === config.userId`.
   - Enforce Premium entitlement checks: verify `profiles.tier === 'premium'` before allowing users to save advanced configurations (e.g., 125-year range or custom guardrails).
   - Integrate `saveSimulationConfig` into `src/app/calculator/CalculatorParams.tsx` (or another appropriate calculator view component).

4. **Update Web Worker (`src/workers/simulation.worker.ts`)**:
   - Add `quickCheck(params: QuickCheckParams): SimulationResultsSummary` to `simulationService` to fulfill the `PROJECT.md` worker contract.

5. **Author 8 Tier 3 E2E Test Cases (`e2e/verify_tier3_interactions.ts` and/or `e2e/calculator_tier3.spec.ts`)**:
   - Implement the 8 pairwise interaction tests required by `SCOPE.md`:
     1. `QuickCheckWidget + Full Calculator State`
     2. `Scrambled Monte Carlo + BOLA Defense`
     3. `Drawdown Engine + Premium Entitlement Checks`
     4. `Global Market Data + Accumulation Phase`
     5. `Scrambled Monte Carlo + Accumulation Phase`
     6. `QuickCheckWidget + Scrambled Monte Carlo`
     7. `Drawdown Engine + Global Market Data`
     8. `Full Calculator State + Premium Entitlement Checks`
   - Update `e2e/run_e2e.ts` to include the new Tier 3 verification script/spec in its test runner execution list if necessary.

6. **Stabilize E2E Test Runner (`e2e/run_e2e.ts`)**:
   - Fix Docker container conflicts and cleanup issues: add explicit `docker rm -f supabase_db_expense-dashboard supabase_kong_expense-dashboard supabase_auth_expense-dashboard supabase_rest_expense-dashboard supabase_realtime_expense-dashboard supabase_storage_expense-dashboard 2>/dev/null || true` to `setup()` and `cleanup()`.
   - Increase `sleep` duration or retry threshold following `npx supabase start` to ensure robust database initialization before launching Playwright.

### Verification Requirement
You must execute the E2E test runner to verify your changes:
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts
```
Ensure all tests pass with exit code 0 and zero TypeScript errors.

MANDATORY INTEGRITY WARNING:
> DO NOT CHEAT. All implementations must be genuine. DO NOT
> hardcode test results, create dummy/facade implementations, or
> circumvent the intended task. A Forensic Auditor will independently
> verify your work. Integrity violations WILL be detected and your
> work WILL be rejected.

Produce a structured handoff report (`handoff.md`) in your working directory documenting your changes, verification commands, and passing test results. Use `send_message` to notify me when complete.
