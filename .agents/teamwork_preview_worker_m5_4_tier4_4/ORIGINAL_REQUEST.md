## 2026-07-07T22:56:42Z

You are a Worker agent (teamwork_preview_worker) for Milestone 5.4 (Tier 4 E2E Test Pass - Real-World Application Scenarios) Iteration 4.
Your working directory is `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_4_tier4_4`.

## Domain Skill
Load and follow the Jetski skill at:
`/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md`

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Objective
Implement the surgical fixes formulated by the Explorers in `e2e/run_e2e.ts` to achieve full `PROJECT.md` contract compliance and permanently eliminate `exit code 137` swarm assassination under concurrency. Then verify your changes by executing the master verification command from `TEST_READY.md`.

## Input Information & Explorer Findings
The Explorers investigated the failure evidence from Iteration 3 and identified two critical flaws in `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts`:
1. **Stale Lock Timeout Non-Conformance**: `PROJECT.md` mandates a 30-minute (`1800` seconds) stale lock timeout in `acquireLock()`. Currently, `e2e/run_e2e.ts` uses `etimes > 900` (15 minutes) and lacks `lockAgeMs`. For the active lock holder check (lines 160-162), it must be updated to calculate `lockAgeMs` and check `if (etimes > 1800 || lockAgeMs > 1800 * 1000)`. For the queued process check (lines 115-117), it must be updated to `etimes > 7200` (2 hours) to prevent prematurely killing waiting test runners in a multi-agent swarm queue.
2. **`ps -eo pid,args` Truncation Flaw (Swarm Assassination / Exit Code 137)**: At line 270 in `killLingeringProcessesScoped()`, `execSync('ps -eo pid,args 2>/dev/null || true')` truncates `args` to 80 columns in non-TTY environments. Because `tsx` spawns `node` with an 82-character `--require` loader prefix, `e2e/run_e2e.ts` appears at character 110 and is silently truncated. Queued swarm instances fail `args.includes('run_e2e')`, are omitted from `protectedPids`, and are subsequently killed by `pgrep -f "node|tsx|jest|webpack"`. Updating line 270 to `ps -eo pid,args --width 4096 2>/dev/null || true` explicitly overrides the 80-column limit, ensuring `e2e/run_e2e.ts` is visible, correctly added to `protectedPids`, and shielded from `pkill`.

## Required Surgical Edits in `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts`
Use `replace_file_content` to make the following three precise edits:

### Edit 1: Update Queued Process Timeout in `acquireLock()` (around lines 115-117)
```typescript
// BEFORE
          const etimes = Number(execSync(`ps -o etimes= -p ${pid} 2>/dev/null || true`, { encoding: 'utf-8' }).trim());
          if (etimes > 900) {
            console.log(`Stale run_e2e process detected (PID ${pid}, running for ${etimes}s > 900s). Removing from queue and terminating...`);

// AFTER
          const etimes = Number(execSync(`ps -o etimes= -p ${pid} 2>/dev/null || true`, { encoding: 'utf-8' }).trim());
          if (etimes > 7200) {
            console.log(`Stale run_e2e process detected (PID ${pid}, running for ${etimes}s > 7200s). Removing from queue and terminating...`);
```

### Edit 2: Update Active Lock Holder Timeout & Add `lockAgeMs` in `acquireLock()` (around lines 160-162)
```typescript
// BEFORE
              const etimes = Number(execSync(`ps -o etimes= -p ${lockPid} 2>/dev/null || true`, { encoding: 'utf-8' }).trim());
              if (etimes > 900) {
                console.log(`Stale lock holder detected (PID ${lockPid}, running for ${etimes}s > 900s). Terminating...`);

// AFTER
              const etimes = Number(execSync(`ps -o etimes= -p ${lockPid} 2>/dev/null || true`, { encoding: 'utf-8' }).trim());
              const lockAgeMs = Date.now() - fs.statSync(lockfile).mtimeMs;
              if (etimes > 1800 || lockAgeMs > 1800 * 1000) {
                console.log(`Stale lock holder detected (PID ${lockPid}, running for ${etimes}s or lock age ${lockAgeMs}ms > 1800s). Terminating...`);
```

### Edit 3: Fix `ps` Truncation Flaw in `killLingeringProcessesScoped()` (around line 270)
```typescript
// BEFORE
      const allPids = execSync(`ps -eo pid,args 2>/dev/null || true`, { encoding: 'utf-8' }).split('\n');

// AFTER
      const allPids = execSync(`ps -eo pid,args --width 4096 2>/dev/null || true`, { encoding: 'utf-8' }).split('\n');
```

## Verification Method
After implementing the edits, execute the master verification command from `TEST_READY.md`:
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec node node_modules/.bin/tsx e2e/run_e2e.ts
```
Verify that the command completes successfully with exit code `0`.

## Output Requirements & Completion Criteria
Write a structured handoff report at `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_4_tier4_4/handoff.md` following the Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
Include your exact verification commands and exit code 0 results in the report.
You are done when `handoff.md` is successfully written to your working directory and you send a completion message to your parent (the caller agent).
