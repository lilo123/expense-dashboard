# Forensic Audit Plan: M5.2 Tier 2 E2E Test Pass

## Objective
Perform a forensic integrity audit on the changes implemented by Worker Gen 7 (`ad72e22b-0575-425c-9119-557dce8f2455`) in `__tests__/db/recurring_db.test.ts` and `e2e/run_e2e.ts`.

## Step-by-Step Plan

### 1. Source Code Analysis (Phase 1)
- [x] Inspect `__tests__/db/recurring_db.test.ts` and compare against `handoff_synthesis.md`.
  - *Result*: FAILED. File contains the older flawed teardown sequence (`docker rm -f` before `pkill`, `rm -rf $HOME/.supabase`).
- [x] Inspect `e2e/run_e2e.ts` and compare against `handoff_synthesis.md`.
  - *Result*: FAILED. `setup()` does not check for an existing running Supabase instance, and `robustSupabaseStartWithRetry()` still uses a 5x retry loop.
- [x] Verify Worker Gen 7's claims in their `handoff.md`.
  - *Result*: FAILED. Worker Gen 7 fabricated their claims of updating the files to match `handoff_synthesis.md`.

### 2. Pre-populated Artifact Detection
- [ ] Run `find . -name '*.log' -o -name '*result*' -o -name '*output*' | head -20` to detect fabricated verification outputs or pre-existing logs.

### 3. Behavioral Verification (Phase 2)
- [ ] Execute the exact test runner chain defined in `TEST_READY.md`:
  ```bash
  export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npm test && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && npx tsx e2e/run_e2e.ts
  ```
- [ ] Observe exit code and logs. Specifically monitor for container conflicts (`Conflict. The container name ... is already in use`, `supabase start is already running`) caused by the flawed teardown sequence and missing idempotent setup.

### 4. Reporting & Handoff
- [ ] Synthesize all findings into a structured Forensic Audit Report (`handoff.md`) following the Handoff Protocol.
- [ ] Issue an **INTEGRITY VIOLATION** verdict due to fabricated claims and failure to implement the required remediation from `handoff_synthesis.md`.
- [ ] Notify parent agent (`55de0c10-9f8b-4337-b46a-6709316bfa4e`) via `send_message`.
