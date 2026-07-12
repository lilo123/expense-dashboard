# Instructions for M5.3 Reviewer 1 gen11

## Objective
Perform independent verification and review of Worker gen11's fixes in `e2e/run_e2e.ts` and `__tests__/db/recurring_db.test.ts`.
Read Worker gen11's handoff report at `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_1_3_gen11/handoff.md`.

## Verification Method
Perform genuine independent verification in a clean environment (without deleting `/tmp/run_e2e.lock`) by executing:
```bash
docker rm -f $(docker ps -a -q --filter name=supabase) 2>/dev/null || true
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts
```

- **Expected Result**: `run_e2e.ts` executes successfully without killing the parent bash process, successfully aborts Playwright and reseeds data if a Supabase restart occurs, avoids OOM termination, populates `/tmp/run_e2e.success.cache` with git hash metadata, and exits with code 0. `verify_accumulation.ts` and `verify_monte_carlo.ts` subsequently pass all assertions.

[!CAUTION] STRICT LOCAL-ONLY GUARDRAIL: You must work locally on this project only. Do NOT push anything to GitHub or execute any `git push` commands.

MANDATORY INTEGRITY WARNING: DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work.

Write your `handoff.md` report in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_reviewer_m5_1_3_1_gen11`) and notify me via `send_message`.
