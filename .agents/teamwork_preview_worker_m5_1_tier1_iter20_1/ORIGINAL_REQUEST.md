## 2026-07-07T00:54:34Z

You are Worker 1 (Iteration 20) for Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage).
Your working directory is `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_1_tier1_iter20_1`.
Your identity/role is `teamwork_preview_worker`.

Load the Jetski skill at:
  `/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md`

Read `PROJECT.md`, `.agents/sub_orch_m5_1_tier1/SCOPE.md`, `TEST_READY.md`, `.agents/ORIGINAL_REQUEST.md`, and `task.md`.

### VERIFICATION FAILURE (Iteration 19)
The previous iteration failed during independent verification where the E2E test runner (`npx tsx e2e/run_e2e.ts`) failed with exit code 1 due to a critical deadlock uncovered by Challenger 1 (`c430e51a-0922-4477-b8ac-220bd55eba46`).

#### Challenger 1 (Iter 19) Findings
- **Critical Deadlock in `e2e/run_e2e.ts`**: When `npx supabase start` fails or during teardown blocks, the script executes `while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase"; do sleep 2; done` BEFORE `docker volume ls -q | xargs -r docker volume rm -f`. If a Supabase Docker volume exists (e.g., `expense-dashboard_supabase_db_expense-dashboard`), `docker volume ls -q | grep -q "supabase"` evaluates to true (`0`). Because the volume removal command (`docker volume rm -f`) is placed AFTER the `while` loop, the volume is never removed while the loop is running! Thus, the `while` loop hangs infinitely (`while true; do sleep 2; done`), permanently deadlocking the E2E test runner!
- **Mitigation Recommended by Challenger 1 & Explorers**: Correct the ordering of the volume removal and `while` loop in `e2e/run_e2e.ts`. Specifically, execute `docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true` BEFORE the `while` loop across all 9 teardown blocks.

### Objective
Your objective is to implement the exact fix strategy synthesized by the Explorers in `e2e/run_e2e.ts` and verify that all Tier 1 E2E tests pass flawlessly with exit code 0.

#### Exact Code Replacements in `e2e/run_e2e.ts`
Modify `e2e/run_e2e.ts` across all 9 teardown blocks (lines 38-47, 54-63, 93-102, 119-128, 168-177, 225-234, 243-252, 275-284, 340-349) to implement the corrected, bulletproof teardown sequence:

```typescript
// Corrected Teardown Sequence (apply to lines 38-47, 54-63, 93-102, 119-128, 168-177, 275-284, 340-349):
try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase"; do sleep 2; done', { stdio: 'inherit' }); } catch(e){}
try { execSync('pkill -9 -f "supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('fuser -k 25432/tcp 54329/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('rm -rf supabase/.temp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}

// Corrected Teardown Sequence for blocks using 'err' in catch (apply to lines 225-234 and 243-252):
try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase"; do sleep 2; done', { stdio: 'inherit' }); } catch(err){}
try { execSync('pkill -9 -f "supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
try { execSync('fuser -k 25432/tcp 54329/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
try { execSync('rm -rf supabase/.temp 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
try { execSync('sleep 20', { stdio: 'inherit' }); } catch(err){}
```

### Architectural Guardrails & Invariants (Must Verify & Maintain)
1. Ensure `e2e/run_e2e.ts` retains `5000` ms polling intervals (`await new Promise(resolve => setTimeout(resolve, 5000))`) across all health check loops, post-start stabilization delays (`sleep 20`) after `npx supabase start --ignore-health-check` in all recovery blocks, explicit `pg.Client` Postgres database readiness verification at port `25432`, and full stop/start recovery on migration failure.
2. Ensure `e2e/run_e2e.ts` retains `npx supabase migration up --include-all` (non-interactive), `NODE_OPTIONS: ''` sanitization, precise lingering process cleanup (`node.*run_e2e`, `tsx.*run_e2e`) with grandparent PID filtering, `fuser -k 3000/tcp`, asynchronous `child_process.spawn` for Playwright tests, `sleep 10` decoupling, warmup delays, Next.js keep-alive/respawn mechanism, port `25432` migration, and `async setup()`.
3. Ensure `pkill -9 -f next` remains removed (replaced by `fuser -k 3000/tcp`) in `e2e/run_e2e.ts` to prevent process suicide.
4. Ensure `fuser -k 54321/tcp` remains removed from `e2e/run_e2e.ts` to prevent socket inheritance process suicides.
5. Ensure `execSync('npx tsx e2e/init_db.ts', ...)` and Playwright test execution remain without `try...catch` blocks to ensure genuine error propagation.
6. Ensure `e2e/seed.ts` retains robust retry loops around data deletion and user creation/deletion, `schemaRetries = 50`, and `execSync('npx tsx e2e/init_db.ts')` inside the category fetching loop.
7. Ensure `e2e/init_db.ts` retains the 10s post-notification delay (`setTimeout(resolve, 10000)`).
8. Ensure `next.config.js` retains `outputFileTracing: false`.
9. Ensure `src/lib/planner/*.ts` and `supabase/migrations/20260624000000_retirement_planner.sql` remain genuinely implemented with strict RLS (`auth.uid() = user_id`) and Premium tier check triggers.

### Verification Steps (Must Execute & Document)
1. Run prerequisite cleanups: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && fuser -k 3000/tcp 54321/tcp 54322/tcp 25432/tcp 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true && docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true`.
2. Run TypeScript compilation check: `npx tsc --noEmit`.
3. Run unit tests: `npm run test __tests__/planner`.
4. Run the full E2E test runner command: `npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`. Ensure all tests pass successfully with exit code 0.

### MANDATORY INTEGRITY WARNING
> DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
