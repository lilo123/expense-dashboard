## 2026-07-07T01:35:49Z

You are Worker 1 (Iteration 21) for Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage).
Your working directory is `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_1_tier1_iter21_1`.
Your identity/role is `teamwork_preview_worker`.

Read `PROJECT.md`, `.agents/sub_orch_m5_1_tier1/SCOPE.md`, `TEST_READY.md`, `.agents/ORIGINAL_REQUEST.md`, `task.md`, and the Explorer's handoff report at `.agents/teamwork_preview_explorer_m5_1_tier1_iter21_1/handoff.md`.

### Mandatory Integrity Warning
> DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

### Task Description
1. Inspect `e2e/run_e2e.ts` to verify the exact line numbers and leading indentation for all 9 teardown blocks (e.g., `setup()` initial cleanup, `setup()` loop start, `setup()` catch block, `cleanup()`, `run()` health check recovery, `run()` db push recovery, `run()` pre-seed health check recovery, `run()` post-build health check recovery).
2. Use `multi_replace_file_content` (or `replace_file_content` if done individually) to update all 9 teardown blocks in `e2e/run_e2e.ts` to the exact reordered sequence where `pkill` commands execute before Docker cleanup commands, as defined in the Explorer's handoff report:
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
*(Note: Be sure to match the exact leading indentation and `catch(e)` vs `catch(err)` syntax for each specific block).*
3. Ensure all other architectural guardrails in `e2e/run_e2e.ts` (5000ms polling intervals, 20s stabilization delays, `pg.Client` readiness checks, grandparent PID filtering, `fuser -k 3000/tcp`, absence of `pkill -9 -f next`, absence of `fuser -k 54321/tcp`, genuine error propagation) are strictly preserved.
4. Run prerequisite cleanups: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && fuser -k 3000/tcp 54321/tcp 54322/tcp 25432/tcp 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true && docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true`.
5. Run TypeScript compilation check: `npx tsc --noEmit`.
6. Run unit tests: `npm run test __tests__/planner`.
7. Run the full E2E test runner command: `npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`. Ensure all tests pass successfully with exit code 0.
8. When complete, write `handoff.md` in your working directory and send a completion message to me.
