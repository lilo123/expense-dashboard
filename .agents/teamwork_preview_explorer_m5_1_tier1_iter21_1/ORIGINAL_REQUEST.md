## 2026-07-07T01:27:51Z

You are Explorer 1 (Iteration 21) for Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage).
Your working directory is `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_tier1_iter21_1`.
Your identity/role is `teamwork_preview_explorer`.

Read `PROJECT.md`, `.agents/sub_orch_m5_1_tier1/SCOPE.md`, `TEST_READY.md`, `.agents/ORIGINAL_REQUEST.md`, and `task.md`.

### Task Description
Investigate the E2E test runner failure in `e2e/run_e2e.ts` during Supabase start retries.

### Previous Failure Context
In Iteration 20, Worker 1 successfully updated all 9 teardown blocks in `e2e/run_e2e.ts` to execute `docker volume rm -f` before the `while` loop, which permanently eliminated the Docker volume deadlock. Worker 1, Challenger 1, Challenger 2, and the Forensic Auditor all achieved 100% passing tests with exit code 0 (and the Auditor confirmed a CLEAN verdict with zero cheating/facades).
However, Reviewer 1 and Reviewer 2 encountered `exit code 1` during `npx supabase start --ignore-health-check` retries in `setup()`.
Reviewer 1 found:
"The full E2E test runner command (`task-34`) failed with exit code 1 due to a Docker container conflict (`/supabase_db_expense-dashboard` already in use) during Supabase start retries. This exposes a race condition in the teardown blocks where `pkill -9 -f "supabase"` executes after `docker rm -f`, allowing lingering Supabase processes to recreate containers before being killed."
Reviewer 2 found:
"`npx supabase start --ignore-health-check` failed all 3 attempts with `failed to inspect container health: Error response from daemon: No such container: supabase_db_expense-dashboard`."

### Root Cause Analysis & Goal
When `npx supabase start` fails or is stopped, detached `supabase-go` daemons and `npx supabase` wrapper processes remain active in the background trying to spin up containers via Docker Compose.
Because `pkill -9 -f "supabase"` and `pkill -9 -f "supabase-go"` currently execute AFTER `docker rm -f` and `docker volume rm -f`, the detached daemons remain alive while `docker rm -f` runs. They asynchronously recreate containers (`supabase_db_expense-dashboard`) after `docker rm -f` finishes, before `pkill` terminates them. This leaves orphaned containers/networks that collide with the next `npx supabase start` attempt.
Executing `pkill -9 -f "supabase"`, `pkill -9 -f "supabase-go"`, and `pkill -9 -f "npx supabase"` AFTER `npx supabase stop` but BEFORE `docker rm -f` guarantees that all background daemons are terminated before Docker cleanup begins.

### Task Description
1. Inspect `e2e/run_e2e.ts` to locate all 9 teardown/recovery blocks (e.g., `setup()` initial cleanup, `setup()` loop start, `setup()` catch block, `cleanup()`, `run()` health check recovery, `run()` db push recovery, `run()` pre-seed health check recovery, `run()` post-build health check recovery).
2. Recommend a concrete fix strategy to update all 9 teardown blocks in `e2e/run_e2e.ts` to the following exact reordered sequence:
```typescript
try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('pkill -9 -f "supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase"; do sleep 2; done', { stdio: 'inherit' }); } catch(e){}
try { execSync('fuser -k 25432/tcp 54329/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('rm -rf supabase/.temp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}
```
3. Ensure all other architectural guardrails in `e2e/run_e2e.ts` (5000ms polling intervals, 20s stabilization delays, `pg.Client` readiness checks, grandparent PID filtering, `fuser -k 3000/tcp`, absence of `pkill -9 -f next`, absence of `fuser -k 54321/tcp`, genuine error propagation) are strictly preserved.
4. Do NOT implement the fix yourself. Document your findings and the exact replacement strategy in `handoff.md` in your working directory and send a completion message to me.
