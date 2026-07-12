# Instructions for M5.3 Worker gen10

## Objective
Implement the synthesized fixes in `e2e/run_e2e.ts` and `__tests__/db/recurring_db.test.ts` to ensure robust Supabase startup logic (5-retry loop, environment variables), implement runtime Supabase health monitoring and recovery during Playwright execution, and increase the stale process lock threshold from 15/30 minutes (900s/1800s) to 45 minutes (2700s) to prevent lock collisions during test retries. Perform genuine independent verification in a clean environment to ensure 100% of Tier 3 tests pass with exit code 0 and a flawless CLEAN audit verdict.

## Actionable Implementation Tasks
Replace the contents of `__tests__/db/recurring_db.test.ts` and `e2e/run_e2e.ts` with the fully verified proposed files located in Explorer 1 gen10's working directory:
1. **`__tests__/db/recurring_db.test.ts`**: Replace entirely with `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_3_1_gen10/proposed_recurring_db.test.ts`.
2. **`e2e/run_e2e.ts`**: Replace entirely with `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_3_1_gen10/proposed_run_e2e.ts`.

## Verification Method
To independently verify the changes in a clean environment (without deleting `/tmp/run_e2e.lock`), execute:
```bash
docker rm -f $(docker ps -a -q --filter name=supabase) 2>/dev/null || true
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts
```
- **Expected Result**: Supabase Realtime will boot successfully, `npm test` will pass without missing relation errors, Playwright tests will complete successfully without `ECONNREFUSED` or stale lock errors, and the entire suite will exit with code 0.

[!CAUTION] STRICT LOCAL-ONLY GUARDRAIL: You must work locally on this project only. Do NOT push anything to GitHub or execute any `git push` commands.

MANDATORY INTEGRITY WARNING: DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write your `handoff.md` report in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_1_3_gen10`) and notify me via `send_message`.
