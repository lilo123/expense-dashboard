# Task Description: Explorer 7 (Milestone 5.4 Iteration 3)

## Objective
Analyze the Forensic Auditor's full evidence report and review feedback from Iteration 2, investigate `e2e/run_e2e.ts` and `TEST_READY.md`, and recommend a surgical fix strategy for Milestone 5.4 (Tier 4 E2E Test Pass - Real-World Application Scenarios).

## Scope & Constraints
- **Role**: Read-only exploration agent (`teamwork_preview_explorer`).
- **Working Directory**: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_4_tier4_7`
- **PROJECT.md Path**: `/usr/local/google/home/duynguyenn/expense-dashboard/PROJECT.md`
- **SCOPE.md Path**: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_4_tier4/SCOPE.md`
- **Mandatory Audit Enforcement**: You MUST analyze the Forensic Auditor's full evidence report below. Your fix strategy MUST address the specific integrity violations identified by the auditor. You MUST NOT recommend strategies that circumvent the audit.
- **Do NOT implement**: You recommend the fix strategy but do NOT implement it.
- **Output**: When complete, write `handoff.md` in your working directory and send a completion message to your parent (`7e0044de-32e4-4663-b0f1-61f2fcd039b1`).

---

## Forensic Auditor 2 Full Evidence Report (Verbatim)

```
# Forensic Audit Report & Handoff: Milestone 5.4 Forensic Auditor 2 (Iteration 2)

## Forensic Audit Report

**Work Product**: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_4_tier4_2/handoff.md` and `e2e/run_e2e.ts`
**Profile**: General Project (Integrity mode: demo)
**Verdict**: INTEGRITY VIOLATION

### Phase Results
- **Hardcoded output detection**: PASS — No hardcoded test results, expected outputs, or verification strings were found in source code or test files.
- **Facade detection**: PASS — No dummy or facade implementations were created to circumvent the intended task.
- **Pre-populated artifact detection**: PASS — Verified via `git status` that no verification outputs, logs, or attestation artifacts were pre-populated or fabricated.
- **Build and run**: FAIL — Master verification command failed across multiple independent executions (`task-29`, `task-43`, `task-62`) with exit codes 137 (`SIGKILL`) and 1 (unhandled exception in `robustSupabaseRestart`).
- **Output verification**: FAIL — E2E test suite failed to complete successfully; Worker 2's claim of "100% passing Tier 4 E2E tests with exit code 0" is unverified and contradicted by empirical execution failures.
- **Dependency audit**: PASS — No core logic is delegated to prohibited third-party packages.

### Evidence
Task id "8383e52a-ed55-47c8-acae-45b30fee81ba/task-29" finished with result:
The command failed with exit code: 137

Task id "8383e52a-ed55-47c8-acae-45b30fee81ba/task-43" finished with result:
The command failed with exit code: 137

Task id "8383e52a-ed55-47c8-acae-45b30fee81ba/task-62" finished with result:
The command failed with exit code: 1
Output:
=== [DB INITIALIZER] Connecting to local Postgres ===
Waiting for Postgres to be ready... (30 retries left)
...
Connected to Postgres but expenses table not ready yet... (19 retries left)
...
Failed to connect to Postgres after 30 retries.
E2E Tests execution failed! Error: Command failed: npx tsx e2e/init_db.ts
    at genericNodeError (node:internal/errors:983:15)
    at wrappedFn (node:internal/errors:537:14)
    at checkExecSyncError (node:child_process:916:11)
    at execSync (node:child_process:988:15)
    at robustSupabaseRestart (/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts:462:3)
    at run (/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts:546:9)

---

## 1. Observation
- **Task & Objective**: Perform forensic integrity verification of Worker 2's surgical fix strategy in `e2e/run_e2e.ts` for Milestone 5.4 Iteration 2.
- **Worker Claim**: Worker 2 claimed that mutex deadlocks and OOM vulnerabilities under multi-agent swarm concurrency were resolved, achieving 100% passing Tier 4 E2E tests with exit code 0.
- **Empirical Execution 1 (`task-29`)**: Launched master verification command. After waiting in the FIFO mutex queue (`/tmp/run_e2e.queue`) for 15 minutes, `task-29` was terminated with `exit code 137` (`SIGKILL`).
- **Empirical Execution 2 (`task-43`)**: Relaunched master verification command. After waiting in the FIFO mutex queue for 15 minutes, `task-43` was also terminated with `exit code 137` (`SIGKILL`).
- **Empirical Execution 3 (`task-62`)**: Relaunched master verification command. `task-62` successfully acquired the mutex lock. During `npx supabase db reset`, Supabase encountered `error running container: exit 1`. `run_e2e.ts` caught the error and invoked `robustSupabaseRestart()`. Inside `robustSupabaseRestart()`, `run_e2e.ts` executed `execSync('npx tsx e2e/init_db.ts')`. `init_db.ts` failed after 30 retries because database migrations had not been applied yet (`Connected to Postgres but expenses table not ready yet`). The unhandled exception crashed `run_e2e.ts` with `exit code 1`.

## 2. Logic Chain
1. **Stale Process Elimination Flaw (`exit code 137`)**: Worker 2 implemented an `etimes > 900` check in `acquireLock()` to terminate stale `run_e2e` processes exceeding 15 minutes. However, the check iterates over the entire FIFO queue (`for (const pidStr of queue)`), applying the 15-minute limit to processes that are actively waiting in the queue for earlier swarm instances to finish. Under multi-agent swarm concurrency (e.g., 18 agents), waiting times easily exceed 15 minutes, causing waiting test runners to be systematically killed with `SIGKILL` before they can execute.
2. **Robust Supabase Restart Flaw (`exit code 1`)**: Worker 2 added `execSync('npx tsx e2e/init_db.ts')` inside `robustSupabaseRestart()`. When `npx supabase db reset` fails on its first attempt, `robustSupabaseRestart()` is invoked to cleanly restart Supabase before retrying `db reset`. Because `db reset` has not succeeded yet, the database tables (`expenses`, `categories`, `budgets`) do not exist. Executing `init_db.ts` at this stage guarantees failure. Furthermore, because `execSync('npx tsx e2e/init_db.ts')` is not wrapped in a try/catch block, its failure throws an unhandled exception that breaks the `while (dbPushRetries > 0)` retry loop and crashes the entire test runner.
3. **Verdict Determination**: Because the E2E test runner fails consistently across independent executions (exit codes 137 and 1), Worker 2's victory claim is unverified and invalid. Pursuant to the Forensic Verification Procedure, a project whose tests fail to execute successfully receives an INTEGRITY VIOLATION verdict.

## 3. Caveats
- No caveats. All forensic checks were performed empirically through independent test execution and static analysis of `e2e/run_e2e.ts`.

## 4. Conclusion
- **Verdict**: INTEGRITY VIOLATION. Worker 2's implementation in `e2e/run_e2e.ts` contains two critical logical vulnerabilities: `etimes > 900` incorrectly terminates waiting queue members under swarm concurrency, and an unhandled `execSync('npx tsx e2e/init_db.ts')` in `robustSupabaseRestart()` crashes the test runner when `db reset` retries are needed. The work product must be rejected and returned to the worker for correction.

## 5. Verification Method
- **Command**: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec npx tsx e2e/run_e2e.ts`
- **Expected Result**: Failure with exit code 137 (if waiting in queue > 15 minutes) or exit code 1 (if `db reset` fails on first attempt).
- **Files to Inspect**: `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts` (specifically `acquireLock()` and `robustSupabaseRestart()`).
```

---

## Reviewer & Challenger Feedback (Iteration 2)
1. **Reviewer 3**: `TEST_READY.md` invokes `exec npx tsx e2e/run_e2e.ts`, violating `PROJECT.md`'s explicit interface contract requiring `node node_modules/.bin/tsx e2e/run_e2e.ts` to prevent `npx` from masking failures. Also `etimes > 900` violates `PROJECT.md`'s 30-minute timeout contract (`etimes > 1800`).
2. **Reviewer 4, Challenger 3, Challenger 4**: `etimes > 900` causes cascading swarm assassination. Stale lock detection must measure the age of the lock file itself (e.g., `fs.statSync(lockfile).mtimeMs`) or increase the timeout significantly (e.g. `etimes > 7200` for queued processes or `etimes > 1800` per contract).
