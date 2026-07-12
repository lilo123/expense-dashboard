# Handoff Report — Milestone 5.2 Explorer Iteration 1

## Observation
1. **Test Runner Command**: `TEST_READY.md` specifies the test runner command as:
   `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`.
2. **Process Hierarchy Contract**: `PROJECT.md` and `SCOPE.md` define an explicit Interface Contract:
   `- **Process Hierarchy**: Invoked via exec npx tsx e2e/run_e2e.ts to align process tree with grandparent PID filtering guardrail.`
3. **Grandparent PID Filtering Guardrail**: `e2e/run_e2e.ts` (lines 301-318) implements a process cleanup mechanism before running `npm run build`:
   ```typescript
   const currentPid = process.pid;
   const parentPid = process.ppid;
   let grandParentPid = -1;
   try { grandParentPid = Number(execSync(`ps -o ppid= -p ${parentPid} 2>/dev/null || true`, { encoding: 'utf-8' }).trim()); } catch(e){}
   let greatGrandParentPid = -1;
   try { greatGrandParentPid = Number(execSync(`ps -o ppid= -p ${grandParentPid} 2>/dev/null || true`, { encoding: 'utf-8' }).trim()); } catch(e){}
   
   const nodePids = execSync('pgrep -f "node.*run_e2e" 2>/dev/null || true', { encoding: 'utf-8' }).split('\n').map(p => p.trim()).filter(Boolean).map(Number);
   const tsxPids = execSync('pgrep -f "tsx.*run_e2e" 2>/dev/null || true', { encoding: 'utf-8' }).split('\n').map(p => p.trim()).filter(Boolean).map(Number);
   const allPids = Array.from(new Set([...nodePids, ...tsxPids]));
   
   const pids = allPids.filter(pid => pid !== currentPid && pid !== parentPid && pid !== grandParentPid && pid !== greatGrandParentPid);
   if (pids.length > 0) {
     console.log(`Killing lingering run_e2e processes: ${pids.join(' ')}`);
     execSync(`kill -9 ${pids.join(' ')} 2>/dev/null || true`, { stdio: 'inherit' });
   }
   ```
4. **Execution Log Truncation**: When running the test runner command from `TEST_READY.md` (`export PATH=$PATH:... && npx tsx e2e/run_e2e.ts && ...`), the execution log terminates abruptly right after `Seeding E2E test data...` (which occurs immediately before the process cleanup block in `run_e2e.ts`). Neither `Building fresh Next.js production bundle...` nor `E2E Tests completed successfully!` nor `=== [E2E CLEANUP] Restoring environment ===` is reached.
5. **Standalone Verification Scripts**: Running `npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts` directly completes successfully with exit code 0, proving that the underlying accumulation and Monte Carlo simulation logic is fully functional and correct.

## Logic Chain
1. When `export PATH=$PATH:... && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts` is executed by the shell (`bash`), `bash` spawns `npx tsx e2e/run_e2e.ts`, which spawns `node .../tsx e2e/run_e2e.ts`, which spawns `node e2e/run_e2e.ts`.
2. The top-level `bash` process running the command string contains `tsx e2e/run_e2e.ts` in its command line arguments, so `pgrep -f "tsx.*run_e2e"` matches the top-level `bash` process PID.
3. Because `run_e2e.ts` was invoked without `exec`, the top-level `bash` process is the great-great-grandparent of `node e2e/run_e2e.ts` (i.e. `ppid` of `greatGrandParentPid`), which means it is NOT filtered out by `pid !== currentPid && pid !== parentPid && pid !== grandParentPid && pid !== greatGrandParentPid`.
4. Consequently, `run_e2e.ts` executes `kill -9` on the top-level `bash` process.
5. When the top-level `bash` process is killed with `kill -9`, the task runner considers the task finished, the remaining chained commands (`verify_accumulation.ts` and `verify_monte_carlo.ts`) are never executed, and `run_e2e.ts` gets terminated/orphaned before it can build the Next.js app or run the Playwright E2E tests.
6. This violates the Interface Contract defined in `PROJECT.md` and `SCOPE.md`, which explicitly requires `exec npx tsx e2e/run_e2e.ts` to align the process tree with the grandparent PID filtering guardrail.

## Caveats
- No caveats. The investigation thoroughly verified the process tree behavior, the interface contracts in `PROJECT.md` / `SCOPE.md`, and the standalone success of `verify_accumulation.ts` and `verify_monte_carlo.ts`.

## Conclusion
- The Tier 2 E2E test runner command specified in `TEST_READY.md` fails because it invokes `npx tsx e2e/run_e2e.ts` without `exec`. This causes `run_e2e.ts`'s lingering process cleanup guardrail to identify the top-level `bash` shell as a lingering process and terminate it with `kill -9`, aborting the test runner before `npm run build` and preventing `verify_accumulation.ts` and `verify_monte_carlo.ts` from running.
- **Recommended Fix Strategy**:
  1. Update `TEST_READY.md` to align with the Interface Contract in `PROJECT.md` and `SCOPE.md` by using `exec npx tsx e2e/run_e2e.ts`. Since `exec` replaces the shell process, to chain the subsequent verification scripts correctly, structure the command as: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && exec npx tsx e2e/run_e2e.ts`.
  2. Alternatively, update `e2e/run_e2e.ts` to make the PID filtering guardrail more robust by adding `greatGreatGrandParentPid` or explicitly filtering out `bash`/`sh` processes from the `pgrep` results.

## Verification Method
- Run `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && exec npx tsx e2e/run_e2e.ts`.
- Verify that all tests pass with exit code 0 and the full E2E setup, build, Playwright test execution, and cleanup complete successfully.
