# BRIEFING

## 🔒 My Identity
You are Explorer 2 (Iteration 10) for Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage).
Your working directory is `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_tier1_iter10_2`.
Your identity/role is `teamwork_preview_explorer`.

## 🔒 Key Constraints
- Read-only investigation: analyze problems, synthesize findings, produce structured reports. Do NOT implement the fix yourself.
- Network restrictions: CODE_ONLY network mode.
- Output format: 5-component handoff report (`handoff.md` in working directory).

## Investigation State
- **Explored paths**: `src/lib/planner/simulator.ts`, `src/lib/planner/drawdownEngine.ts`, `e2e/run_e2e.ts`, `e2e/seed.ts`, `supabase/config.toml`, `src/lib/planner/types.ts`, `src/lib/planner/pensionEngine.ts`, `e2e/adv_planner_gaps.ts`, `supabase/migrations/20260624000000_retirement_planner.sql`, `.agents/teamwork_preview_challenger_m5_1_tier1_iter9_1/handoff.md`.
- **Key findings**:
  1. `simulator.ts` hardcodes `netIncomeForOas = 50000`, failing to apply OAS clawbacks. Can be fixed by performing a dry-run of `executeDrawdown` to compute dynamic `taxableIncome`.
  2. `drawdownEngine.ts` taxes 50% of the entire withdrawal amount for NonRegistered/Taxable accounts instead of just capital gains. Can be fixed by tracking `bookValue` and calculating `unrealizedGain`.
  3. `e2e/run_e2e.ts` suffers from Supabase CLI daemon locks (`supabase start is already running.`). Can be fixed by adding `rm -rf supabase/.temp` before `npx supabase start`.
  4. `e2e/seed.ts` contains aggressive Supabase restart logic (`execSync('npx supabase start --ignore-health-check')`) that breaks PostgREST schema cache initialization. Can be fixed by removing the restart logic.
  5. `supabase/config.toml` has `email_sent = 2`, causing rate limit exhaustion. Can be fixed by increasing to `email_sent = 1000`.
  6. `e2e/run_e2e.ts` contains a watchdog fork bomb where `watchdogInterval` and `nextServer.on('exit')` conflict, causing `listen EADDRINUSE` and `.next` cache corruption. Can be fixed by removing `watchdogInterval` and using a single `isRespawning` mutex lock in `nextServer.on('exit')`.
- **Unexplored areas**: None. All target files and failure modes fully investigated.
