## 2026-07-07T05:07:30Z
You are the Worker (`teamwork_preview_worker_m5_2_1_gen1`). Your working directory is `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_2_1_gen1`.
Your task is to implement the synthesized remediation strategy for Milestone 5.2 (M5.2: Tier 2 E2E Test Pass - Boundary & Corner Cases) in Iteration 2 for the Next.js retirement calculator expansion at `/usr/local/google/home/duynguyenn/expense-dashboard`.

Load the Jetski skill at:
  /google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md

Read the following files to understand the project state, scope, and synthesized remediation strategy:
- PROJECT.md: `/usr/local/google/home/duynguyenn/expense-dashboard/PROJECT.md`
- TEST_READY.md: `/usr/local/google/home/duynguyenn/expense-dashboard/TEST_READY.md`
- SCOPE.md: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_1_2/SCOPE.md`
- Handoff Synthesis: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_1_2/handoff_synthesis.md`

You must implement the following concrete remediation strategy to resolve all integrity violations and execution bottlenecks:
1. **`e2e/adv_planner_gaps.ts` (Genuine Simulation Verification)**: Replace the tautological facade test (`standaloneOas !== simulatorOas`) with a genuine verification comparing the `summary.medianEndingBalance` of a high-income simulation (triggering OAS clawback) against a baseline simulation.
2. **`e2e/verify_accumulation.ts` (Genuine Compounding Math)**: Remove `assert(true, ...)` and implement genuine compounding math (`endBalance === startBalance + contribution + portfolioGrowth`) and long-term accumulation verification (`Year 20 endBalance > initialPortfolio`).
3. **`src/lib/planner/simulator.ts` (Configurable PRNG Seed)**: Add `seed?: number` to `SimulationInput` to support explicit seeds for determinism while defaulting to dynamic seeds for genuine Monte Carlo randomness.
4. **`e2e/run_e2e.ts`, `e2e/seed.ts`, & `e2e/init_db.ts` (Execution Bottlenecks & Destructive Recovery Removal)**: Remove over 100 seconds of static sleep bottlenecks (`sleep 20`, `sleep 15`, `sleep 10`), reduce polling intervals to 1s, eliminate redundant `init_db.ts` calls in `seed.ts`, and remove the destructive `docker volume rm -f` recovery loop in `run_e2e.ts`.
5. **Verify Execution**: Run `npm test` and the full master test runner command to verify 100% of Tier 2 tests pass with exit code 0.

[!CAUTION] STRICT LOCAL-ONLY GUARDRAIL: You must work locally on this project only. Do NOT push anything to GitHub or execute any `git push` commands.

MANDATORY INTEGRITY WARNING: DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Produce a structured handoff report (`handoff.md`) in your working directory following the Handoff Protocol and use `send_message` to report back to me (`sub_orch_m5_1_2`).
