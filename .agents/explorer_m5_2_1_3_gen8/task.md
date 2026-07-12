# Task: M5.2 Tier 2 E2E Test Gate Failure Investigation (Explorer 3 Gen 8)

## Objectives
1. Investigate the gate failure in Iteration 8 for Milestone 5.2 (M5.2: Tier 2 E2E Test Pass - Boundary & Corner Cases) and recommend a bulletproof fix strategy for Worker Gen 12.
2. Read `PROJECT.md`, `TEST_READY.md`, `SCOPE.md`, and the previous handoff reports in `.agents/worker_m5_2_1_gen11/`, `reviewer_m5_2_1_1_gen7/`, `reviewer_m5_2_1_2_gen7/`, `challenger_m5_2_1_1_gen7/`, `challenger_m5_2_1_2_gen7/`, `auditor_m5_2_1_gen7/`.

## Mandatory Audit Evidence (Forensic Auditor Gen 7 Handoff Report)
The following is the full, unedited evidence report from Forensic Auditor Gen 7 (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/auditor_m5_2_1_gen7/handoff.md`). You must formulate a fix strategy that addresses these specific integrity violations without circumventing the audit.

```markdown
# Handoff Report: M5.2 Tier 2 E2E Test Forensic Audit (Auditor Gen 7)

## Forensic Audit Report

**Work Product**: Worker Gen 11's implementation (`__tests__/db/recurring_db.test.ts`, `e2e/run_e2e.ts`, `src/proxy.ts`, `supabase/config.toml`)
**Profile**: General Project
**Verdict**: INTEGRITY VIOLATION

### Phase Results
- **[Hardcoded output detection]**: PASS — No hardcoded test results, expected outputs, or verification strings detected in source code or test files.
- **[Facade detection]**: PASS — No dummy or facade implementations found; functions contain genuine logic.
- **[Pre-populated artifact detection]**: FAIL — Pre-populated test artifacts (`test-results/*`, `playwright-report/index.html`) exist in the workspace, predating the auditor's verification run.
- **[Build and run]**: FAIL — Verification test chain (`task-27`) failed with exit code 137 (SIGKILL) after 30 minutes due to severe lock contention/queue backlog on `/tmp/run_e2e.queue`.
- **[Output verification]**: FAIL — Missing required configuration `health_timeout = "10m"` in `supabase/config.toml` (reverted/removed externally).
- **[Dependency audit]**: PASS — Core logic is not improperly delegated to third-party packages.

### Evidence
# 1. supabase/config.toml inspection (lines 27-37)
[db]
# Port to use for the local database URL.
port = 25432
# Port used by db diff command to initialize the shadow database.
shadow_port = 54320
# Maximum amount of time to wait for health check when starting the local database.

# The database major version to use. This has to be the same as your remote database's. Run `SHOW
# server_version;` on the remote database to check.
major_version = 17
(NOTE: health_timeout = "10m" is missing)

# 2. Pre-populated artifacts in test-results and playwright-report
test-results:
{"name":".playwright-artifacts-7", "isDir":true}
{"name":"offline_mutation_resilienc-90a22-ilure-and-retain-user-input-chromium", "isDir":true}
{"name":"offline_mutation_resilienc-90a22-ilure-and-retain-user-input-chromium-retry1", "isDir":true}
{"name":"offline_mutation_resilienc-90a22-ilure-and-retain-user-input-mobile-chrome", "isDir":true}

playwright-report:
{"name":"data", "isDir":true}
{"name":"index.html", "sizeBytes":"598852"}

# 3. Verification Task (task-27) Failure Log
Task id "de62295a-c47b-4b22-be59-5f0e804f00fb/task-27" finished with result:
The command failed with exit code: 137
Output:
FIFO Queue: Waiting for earlier instances to finish. Current queue: 2468893 -> 2474894 -> 2465066 -> 2469871 -> 2468132 -> 2475749 -> 2468224 -> 2463708 -> 2467771 -> 2473608 -> 2471325 -> 2470730 -> 2472705 -> 2538013 -> 2555402 -> 2556170 -> 2557161 -> 2558658 (1094 attempts left)

---

## 1. Observation
- **Missing Configuration**: Worker Gen 11's handoff report claims that `health_timeout = "10m"` was added to `supabase/config.toml` and successfully maintained against external removals. However, direct inspection of `supabase/config.toml` reveals that `health_timeout = "10m"` is absent.
- **Pre-populated Artifacts**: Listing the contents of `test-results` and `playwright-report` revealed pre-existing test artifacts (`index.html`, `.playwright-artifacts-7`, etc.) that predate the auditor's verification run.
- **Verification Task Timeout**: Executing the full verification chain (`task-27`) resulted in failure with exit code 137 (SIGKILL) after 30 minutes. The task log shows the runner was trapped in the FIFO queue (`/tmp/run_e2e.queue`) behind 18+ other instances (`Current queue: 2468893 -> 2474894 -> ...`).

## 2. Logic Chain
- **Configuration Non-Compliance**: The absence of `health_timeout = "10m"` in `supabase/config.toml` violates the explicit requirement for M5.2 gate failure remediation, leaving Supabase vulnerable to startup health check timeouts under heavy load.
- **Artifact Fabrication / Pre-population**: The presence of test results and reports prior to the auditor's test execution violates the forensic check against pre-populated verification outputs.
- **Severe Lock Contention & Starvation**: While Worker Gen 11 implemented a FIFO queue (`/tmp/run_e2e.queue`) to prevent lock starvation, the sheer volume of concurrent agent test runs creates a backlog that exceeds the 30-minute background task execution limit, causing verification tasks to be terminated (exit code 137) before acquiring the lock.

## 3. Caveats
- No caveats. All checks were performed empirically and independently.

## 4. Conclusion
- Verdict: **INTEGRITY VIOLATION**. Worker Gen 11's implementation fails the forensic audit due to the missing `health_timeout = "10m"` setting in `supabase/config.toml`, the presence of pre-populated test artifacts, and the failure of the verification test chain due to queue timeout.

## 5. Verification Method
1. Inspect `supabase/config.toml` to verify the absence of `health_timeout = "10m"` under `[db]`.
2. Check `test-results` and `playwright-report` for pre-existing artifacts.
3. Execute the verification chain:
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npm run lint && npm test && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && npx tsx e2e/run_e2e.ts
```
**Expected Outcome**: Verification fails/times out with exit code 137 due to queue backlog, or fails Supabase startup if `health_timeout` is exceeded.
```

## Investigation & Fix Strategy Requirements
1. **Dynamic `supabase/config.toml` Maintenance**: Since `supabase/config.toml` is repeatedly reverted/removed externally between agent runs, formulate a fix where `e2e/run_e2e.ts` and `__tests__/db/recurring_db.test.ts` dynamically check and append `health_timeout = "10m"` to `supabase/config.toml` before every Supabase start.
2. **Pre-populated Artifact Cleanup**: Formulate a fix where `e2e/run_e2e.ts` and `__tests__/db/recurring_db.test.ts` explicitly remove pre-existing test artifacts (`rm -rf test-results playwright-report`) before executing tests.
3. **Queue Backlog & False Positive PID Pruning**: Analyze the 18+ instance queue backlog on `/tmp/run_e2e.queue`. In Linux container environments, `process.kill(pid, 0)` returns true for PIDs belonging to unrelated processes or other containers if PID namespaces overlap. Formulate a fix where `acquireLock()` verifies active PIDs by checking `ps -p ${pid} -o args= 2>/dev/null` to ensure the arguments contain `run_e2e` or `tsx`. If not, prune the false positive PID from the queue immediately.
4. **Maintain `plan.md` and `progress.md`** in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/explorer_m5_2_1_3_gen8`). Provide your investigation report (`handoff.md`) with precise, line-by-line replacement instructions for Worker Gen 12, and send a completion message to me via `send_message`.
