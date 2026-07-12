## 2026-07-06T16:04:51Z

You are Explorer 3 (Iteration 10) for Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage).
Your working directory is `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_tier1_iter10_3`.
Your identity/role is `teamwork_preview_explorer`.

Read `PROJECT.md`, `.agents/sub_orch_m5_1_tier1/SCOPE.md`, `TEST_READY.md`, and `.agents/ORIGINAL_REQUEST.md`.

### FORENSIC AUDIT FAILURE & VERIFICATION SWARM FINDINGS (Iteration 9)
The previous iteration failed due to an INTEGRITY VIOLATION identified by the Forensic Auditor (Iter 9), as well as critical vulnerabilities uncovered by the Reviewers and Challengers.
You MUST analyze the failures and recommend a concrete fix strategy that addresses these specific issues. Do NOT implement the fix yourself.

#### 1. Forensic Auditor (Iter 9) Findings (INTEGRITY VIOLATION)
...
[Refer to full prompt for details]
...
### Objective
Your objective is to investigate `src/lib/planner/simulator.ts`, `src/lib/planner/drawdownEngine.ts`, `e2e/run_e2e.ts`, `e2e/seed.ts`, `supabase/config.toml`, and the codebase, analyze the root causes of these failures, and recommend a concrete, bulletproof fix strategy.
1. Recommend the exact code changes to `src/lib/planner/simulator.ts` to remove the hardcoded `netIncomeForOas = 50000` and correctly calculate `netIncomeForOas` dynamically based on actual taxable withdrawals, pension income, and other taxable inflows in each simulation year so OAS clawbacks are accurately applied.
2. Recommend the exact code changes to `src/lib/planner/drawdownEngine.ts` to correctly track and tax only the growth/capital gains portion of withdrawals from NonRegistered accounts (rather than applying the 50% capital gains inclusion rate to the entire withdrawal amount including principal).
3. Recommend the exact code changes to `e2e/run_e2e.ts` and `e2e/seed.ts` to add `rm -rf supabase/.temp` before every `npx supabase start` invocation to permanently eliminate Supabase CLI daemon locks (`supabase start is already running.`).
4. Recommend the exact code changes to `e2e/seed.ts` to remove the aggressive Supabase restart logic (`execSync('npx supabase start --ignore-health-check')`) during Auth polling so PostgREST schema cache initialization is not disrupted.
5. Recommend the exact code changes to `supabase/config.toml` to increase `email_sent` under `[auth.rate_limit]` (e.g., `email_sent = 1000`) to eliminate Supabase Auth rate limit exhaustion during `e2e/settings.spec.ts`.
6. Ensure `pkill -9 -f next` remains removed (replaced by `fuser -k 3000/tcp`) in `e2e/run_e2e.ts` to prevent process suicide.
7. Ensure `execSync('npx tsx e2e/init_db.ts', ...)` and Playwright test execution remain without `try...catch` blocks to ensure genuine error propagation.
8. Ensure `e2e/run_e2e.ts` retains the asynchronous `child_process.spawn` for Playwright tests, `sleep 10` decoupling, warmup delays, resilient Next.js server keep-alive/respawn mechanism, and port `25432` migration.
9. Ensure `src/lib/planner/*.ts` and `supabase/migrations/20260624000000_retirement_planner.sql` remain genuinely implemented with strict RLS (`auth.uid() = user_id`) and Premium tier check triggers.

When complete, write `handoff.md` in your working directory and send a completion message to me.

## 2026-07-06T16:05:58Z

**Context**: Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage) - Iteration 10 Explorer Investigation
**Content**: Challenger 1 (Iteration 9) has just submitted its final stress test report. It uncovered a critical race condition and watchdog fork bomb in `e2e/run_e2e.ts`. Specifically, `watchdogInterval` and `nextServer.on('exit')` conflict during heavy test load, prematurely killing the Next.js server mid-test (`net::ERR_CONNECTION_REFUSED`), causing port collisions (`listen EADDRINUSE: address already in use 127.0.0.1:3000`), and corrupting the `.next` build cache (`Could not find a production build in the '.next' directory`).
**Action**: Please review Challenger 1's handoff report at `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_challenger_m5_1_tier1_iter9_1/handoff.md` and include a concrete fix strategy to refactor and harmonize the conflicting watchdog mechanisms in `e2e/run_e2e.ts` (e.g., ensuring `watchdogInterval` and `nextServer.on('exit')` share a single `isRestarting` mutex lock or removing `watchdogInterval` entirely in favor of a clean `nextServer.on('exit')` respawn). Document your recommendations in `handoff.md`.
