# Task Description: Tier 3 E2E Worker 1 (Iteration 7, Gen 2)

Load the Jetski skill at:
  /google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md

This skill provides a software engineering methodology for modifying existing code, performing refactors, and ensuring correctness.

## Objective & Scope
Implement the concrete 3-part fix strategy recommended by Explorers 1, 2, and 3 in Iteration 7 to resolve the Supabase CLI Viper decoding failure (`health_timeout`), Next.js Webpack OOM crash (`--max-old-space-size`), and fratricidal process termination (`killLingeringProcessesScoped`) for Milestone 5.3 (Tier 3 E2E Test Pass - Cross-Feature Combinations).

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Input Information & Explorer Findings
Read Explorer 2's handoff report at `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_3_tier3_iter7_2_gen2/handoff.md`.
Also read `PROJECT.md`, `SCOPE.md`, `TEST_READY.md`, `ORIGINAL_REQUEST.md`, `supabase/config.toml`, and `e2e/run_e2e.ts`.

### Required Fixes
1. **Fix Supabase CLI Configuration (`supabase/config.toml`)**: Completely remove line 33 (`health_timeout = "10m"`).
2. **Fix Next.js Webpack OOM Crash (`e2e/run_e2e.ts`)**: Modify line 380 to increase `--max-old-space-size` from `512` to `4096`.
   ```typescript
   // Before (Line 380)
   execSync('npm run build', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });

   // After
   execSync('npm run build', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096' } });
   ```
3. **Fix Fratricidal Process Termination (`e2e/run_e2e.ts`)**: Modify `killLingeringProcessesScoped` (lines 90-98) to inspect the command line arguments of each PID and explicitly exclude any process matching `run_e2e`, `verify_`, `stress_test_`, or `adv_`. Also delete Line 377 (`killLingeringProcessesScoped('node.*run_e2e|tsx.*run_e2e');`).
   ```typescript
   // Before (Lines 90-98)
   const pidsToKill = pids.filter(pid => {
     if (ancestorPids.has(pid)) return false;
     try {
       const pTty = execSync(`ps -p ${pid} -o tty= 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
       return pTty === myTty;
     } catch (e) {
       return false;
     }
   });

   // After
   const pidsToKill = pids.filter(pid => {
     if (ancestorPids.has(pid)) return false;
     try {
       const args = execSync(`ps -p ${pid} -o args= 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
       if (args.includes('run_e2e') || args.includes('verify_') || args.includes('stress_test_') || args.includes('adv_')) {
         return false;
       }
       const pTty = execSync(`ps -p ${pid} -o tty= 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
       return pTty === myTty;
     } catch (e) {
       return false;
     }
   });
   ```

## Verification & Output Requirements
After implementing the fixes, you MUST execute the master E2E test runner command defined in `TEST_READY.md`:
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && node node_modules/.bin/tsx e2e/run_e2e.ts
```
Verify that all tests pass successfully with exit code 0.
When complete, write `handoff.md` in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_3_tier3_iter7_1_gen2`) following the Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method) documenting your changes and the passing test results.
When done, send a completion message to your parent (`fbb8e945-2a98-4e23-89f2-f6529a71f015`).
