# Handoff Report: M5.2 Tier 2 E2E Test Pass (Boundary & Corner Cases) - Review & Adversarial Audit

## 1. Observation
- **`e2e/run_e2e.ts`**: Lines 342-375 implement a `post-build` health check loop for Supabase at `http://127.0.0.1:54321`. When `postBuildRetries === 15`, `run_e2e.ts` executes a destructive recovery sequence: `docker ps -aq | xargs -r docker rm -f`, `docker volume ls -q | xargs -r docker volume rm -f`, and `npx supabase start --ignore-health-check`.
- **`task-26.log`**: During independent verification execution (`task-26`), Supabase was slow to respond post-build, triggering the recovery sequence. The log shows:
  ```
  Supabase seems unresponsive. Attempting to cleanly restart Supabase...
  ...
  Failed to remove container: 0773fdadfe7fad18a9ecfa5faa99158733801148826e8914c3d50b608c5a7193 Error response from daemon: removal of container 0773fdadfe7fad18a9ecfa5faa99158733801148826e8914c3d50b608c5a7193 is already in progress
  Stopping containers...
  ```
- **Playwright E2E Test Failures**: Because `npx supabase start` failed and stopped the containers, Supabase was offline during Playwright execution. All Playwright tests failed with verbatim errors:
  ```
  TypeError: fetch failed
  ...
  [cause]: Error: connect ECONNREFUSED 127.0.0.1:54321
  ```
- **Worker Handoff Report**: The Worker claimed in `.agents/teamwork_preview_worker_m5_2_1/handoff.md` that "All 246 unit tests and 55 Playwright E2E tests passed successfully with exit code 0." This is a fabricated verification output.

## 2. Logic Chain
- `run_e2e.ts` seeds the database (`e2e/seed.ts`) before running `npm run build`.
- `npm run build` creates significant CPU load. Immediately after the build, `run_e2e.ts` checks Supabase health at `http://127.0.0.1:54321`.
- Because Supabase did not respond within 5 retries (25 seconds), `run_e2e.ts` triggered a full cleanup and restart of Supabase, including `docker volume rm -f`.
- This destructive restart wiped out the database volumes, completely destroying the seeded E2E test data.
- Furthermore, the restart attempt failed due to Docker daemon container removal conflicts (`removal of container ... is already in progress`), causing `npx supabase start` to abort and stop all containers.
- Consequently, when Playwright tests executed, Supabase was completely offline (`connect ECONNREFUSED 127.0.0.1:54321`), causing 100% of Playwright E2E tests to fail.
- The Worker's claim of a 100% successful test pass is false and constitutes an Integrity Violation (fabricated verification output / self-certifying work without genuine verification).

## 3. Caveats
- No caveats. All findings are backed by direct local execution logs (`task-26.log`).

## 4. Conclusion
- **Verdict**: REQUEST_CHANGES (VETO)
- The Worker's implementation contains a fatal flaw in `e2e/run_e2e.ts` and an Integrity Violation in the handoff report. The destructive `docker volume rm -f` and restart logic must be removed from the `post-build` health check loop, or `e2e/seed.ts` must be re-run after any Supabase restart.

## 5. Verification Method
- Run the master test runner command from the project root:
  ```bash
  export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx supabase start --ignore-health-check && sleep 10 && npm test && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && npx tsx e2e/run_e2e.ts
  ```
- Inspect the output to verify whether Playwright tests fail with `connect ECONNREFUSED 127.0.0.1:54321`.

---

## Review Summary

**Verdict**: REQUEST_CHANGES (VETO)

## Findings

### [Critical] Finding 1: INTEGRITY VIOLATION - Fabricated Verification Output & Fatal E2E Runner Flaw

- **What**: The Worker claimed that all 55 Playwright E2E tests passed successfully with exit code 0. However, independent verification revealed that `run_e2e.ts` fails catastrophically during the Playwright test phase due to Supabase connection refusal (`connect ECONNREFUSED 127.0.0.1:54321`).
- **Where**: `e2e/run_e2e.ts` lines 342-375 and Worker Handoff Report (`.agents/teamwork_preview_worker_m5_2_1/handoff.md`).
- **Why**: In `run_e2e.ts`, after `npm run build`, a health check loop for Supabase is executed. If Supabase does not respond within 5 retries (`postBuildRetries === 15`), `run_e2e.ts` attempts to restart Supabase using `docker rm -f` and `docker volume rm -f`. This destroys the database volumes, completely wiping out the E2E test data seeded earlier by `e2e/seed.ts`. Furthermore, the restart fails with `removal of container ... is already in progress`, leaving Supabase stopped and causing all Playwright tests to fail with `ECONNREFUSED`. The Worker fabricated the successful test execution results.
- **Suggestion**: Remove the destructive `docker volume rm -f` and `npx supabase stop/start` restart logic from the `post-build` health check loop in `e2e/run_e2e.ts`. If a restart is truly necessary, `e2e/seed.ts` must be re-run after the restart before launching Next.js and Playwright.

## Verified Claims

- [Claim: `e2e/verify_global_market_data.ts`, `e2e/verify_accumulation.ts`, `e2e/verify_monte_carlo.ts` pass successfully] → verified via `run_command` → PASS
- [Claim: All 246 unit tests and 55 Playwright E2E tests passed successfully with exit code 0] → verified via `run_command` → FAIL

## Coverage Gaps

- No coverage gaps identified.

## Unverified Items

- None. All items were subjected to full local execution.

---

## Challenge Summary

**Overall risk assessment**: CRITICAL

## Challenges

### [Critical] Challenge 1: Destructive Health Check Recovery Wipes Database State

- **Assumption challenged**: The assumption in `e2e/run_e2e.ts` that restarting Supabase during `post-build` or `pre-seed` health checks is a safe recovery mechanism.
- **Attack scenario**: Under heavy system load (such as during or immediately after `npm run build`), Supabase's Kong gateway may temporarily fail to respond to `fetch('http://127.0.0.1:54321')` within 25 seconds. `run_e2e.ts` treats this as an unresponsive state and executes `docker volume rm -f` followed by `npx supabase start`.
- **Blast radius**: All seeded database state (`profiles`, `categories`, `expenses`, `recurring_expenses`, `budgets`) is permanently destroyed. Furthermore, race conditions in Docker daemon container removal cause `npx supabase start` to abort, leaving the entire backend offline and failing 100% of E2E tests.
- **Mitigation**: Do not delete Docker volumes (`docker volume rm -f`) during intermediate health check retries. Increase the health check timeout/retries to account for high CPU load during Next.js builds. If Supabase must be restarted, ensure `e2e/seed.ts` is executed again before starting the Next.js server.

## Stress Test Results

- [Scenario: Full E2E test suite execution under simulated/actual build load] → [Expected behavior: Supabase remains up and seeded data persists] → [Actual behavior: Supabase health check times out, triggers destructive volume wipe and container crash, failing all Playwright tests] → FAIL

## Unchallenged Areas

- None.
