# Task Description: Worker 3 (Milestone 5.4 Iteration 3)

## Objective
Implement the synthesized surgical fix strategy in `e2e/run_e2e.ts` and `TEST_READY.md` to resolve `exit code 137` (swarm assassination), `exit code 1` (unhandled `init_db.ts` exception in `robustSupabaseRestart`), and `TEST_READY.md` contract violations for Milestone 5.4 (Tier 4 E2E Test Pass - Real-World Application Scenarios).

## Scope & Constraints
- **Role**: Versatile worker (`teamwork_preview_worker`).
- **Working Directory**: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_4_tier4_3`
- **PROJECT.md Path**: `/usr/local/google/home/duynguyenn/expense-dashboard/PROJECT.md`
- **SCOPE.md Path**: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_4_tier4/SCOPE.md`
- **Domain Skill Path**: `/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md`
- **Output**: When complete, write `handoff.md` in your working directory and send a completion message to your parent (`7e0044de-32e4-4663-b0f1-61f2fcd039b1`).

---

## MANDATORY INTEGRITY WARNING
> DO NOT CHEAT. All implementations must be genuine. DO NOT
> hardcode test results, create dummy/facade implementations, or
> circumvent the intended task. A Forensic Auditor will independently
> verify your work. Integrity violations WILL be detected and your
> work WILL be rejected.

---

## Synthesized Findings & Surgical Fix Strategy

### Consensus
1. **`TEST_READY.md` Contract Violation**: `PROJECT.md` establishes an explicit interface contract: `All test invocation strings must invoke node node_modules/.bin/tsx e2e/run_e2e.ts directly to prevent npx from masking failures.` `TEST_READY.md` currently uses `exec npx tsx e2e/run_e2e.ts`. This must be surgically updated to `exec node node_modules/.bin/tsx e2e/run_e2e.ts`. (Supported by Explorers 7, 8, 9).
2. **Stale Process Elimination Flaw (`exit code 137`)**: Under multi-agent swarm concurrency (e.g., 18 agents), test runners wait in the FIFO queue (`/tmp/run_e2e.queue`) for up to 2 hours (`attempts = 1440`, 7200s). Applying `etimes > 900` (15 minutes) in `acquireLock()` and `killLingeringProcessesScoped()` causes waiting test runners to be systematically assassinated with `SIGKILL` before they can execute.
   - For queued processes in `acquireLock()` (line 76) and `killLingeringProcessesScoped()` (line 242), the timeout must be increased to `etimes > 7200` (2 hours) to match the queue waiting limit. (Supported by Explorers 7, 8, 9).
   - For the active lock owner in `acquireLock()` (line 125), `etimes > 1800` (30 minutes) must be used per `PROJECT.md` contract. (Supported by Explorers 7, 8, 9). Combining this with checking the lock file's modification time (`Date.now() - fs.statSync(lockfile).mtimeMs > 1800 * 1000`) provides an excellent additional safeguard. (Supported by Explorer 7).

### Resolved Conflicts
1. **Robust Supabase Restart Flaw (`exit code 1`)**: When `npx supabase db reset` fails on its first attempt, `robustSupabaseRestart()` is called to cleanly restart Supabase before retrying `db reset`. Because `db reset` has not succeeded yet, database tables (`expenses`, `categories`) do not exist. Executing `init_db.ts` at this stage fails. Because `execSync('npx tsx e2e/init_db.ts')` is not wrapped in a try/catch block, its failure throws an unhandled exception that breaks the `while (dbPushRetries > 0)` retry loop and crashes `run_e2e.ts`.
   - *Resolution*: Explorer 7 & 9 recommend wrapping `execSync('npx tsx e2e/init_db.ts', ...)` in a `try/catch` block. Explorer 8 recommends deleting it entirely since `init_db.ts` is called later in `run()`. Wrapping it in a `try { ... } catch (e) { console.warn('e2e/init_db.ts failed during robustSupabaseRestart (tables may not be ready yet). Proceeding...'); }` block is adopted as the most robust consensus solution because it preserves the permission restoration logic for post-build restarts while safely preventing crashes during `db reset` retries.

### Dissenting Views
- None. All Explorers agree on the root causes and the surgical fixes required.

### Gaps
- None.

---

## Required Implementation Steps

### 1. Align `TEST_READY.md` with `PROJECT.md` Interface Contract
- **Target File**: `/usr/local/google/home/duynguyenn/expense-dashboard/TEST_READY.md`
- **Modification**: Replace `exec npx tsx e2e/run_e2e.ts` with `exec node node_modules/.bin/tsx e2e/run_e2e.ts`.

### 2. Resolve Swarm Assassination & Stale Lock Detection in `e2e/run_e2e.ts`
- **Target File**: `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts`
- **Modification A (Line ~76 - Queued Processes)**: Change `etimes > 900` to `etimes > 7200`.
- **Modification B (Line ~125 - Lock File Owner)**: Change `etimes > 900` to check `etimes > 1800` (and optionally lockfile age `mtimeMs`).
- **Modification C (Line ~242 - `killLingeringProcessesScoped`)**: Change `etimes > 900` to `etimes > 7200`.

### 3. Wrap `init_db.ts` in `robustSupabaseRestart()` with Try/Catch
- **Target File**: `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts`
- **Modification (Line ~462)**: Wrap `execSync('npx tsx e2e/init_db.ts', ...)` in a try/catch block.

---

## Verification
After applying the changes, you MUST verify the implementation by executing the master verification command from `TEST_READY.md`:
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec node node_modules/.bin/tsx e2e/run_e2e.ts
```
Verify that all tests pass successfully with exit code 0. Document the command and results in your `handoff.md`.
