# Forensic Audit & Handoff Report: M5.2 Tier 2 E2E Test Pass

## Forensic Audit Report

**Work Product**: Worker Gen 1 Remediation Implementation for M5.2 (`/usr/local/google/home/duynguyenn/expense-dashboard`)
**Profile**: General Project
**Verdict**: INTEGRITY VIOLATION

### Phase Results
- **Hardcoded output detection**: PASS — Inspected `e2e/adv_planner_gaps.ts`, `e2e/verify_accumulation.ts`, `e2e/verify_global_market_data.ts`, `e2e/verify_monte_carlo.ts`, `e2e/stress_test_m4.ts`, `e2e/stress_test_m4_edge_cases.ts`. All verifications use genuine mathematical, state, and differential checks. No hardcoded pass/fail strings or expected outputs were detected.
- **Facade detection**: PASS — Inspected `src/lib/planner/simulator.ts`, `src/lib/planner/drawdownEngine.ts`, `e2e/run_e2e.ts`, `e2e/seed.ts`, `e2e/init_db.ts`. All implementations contain genuine business logic, dynamic PRNG seeding, correct capital gains tax math, robust retry loops, and proper database initialization.
- **Pre-populated artifact detection**: PASS — Checked workspace for pre-populated log files, result files, or verification artifacts. None exist that predate the test run.
- **Build and run**: FAIL — Executed the master E2E test runner command. The verification scripts (`verify_global_market_data.ts`, `verify_accumulation.ts`, `verify_monte_carlo.ts`, `stress_test_m4.ts`, `stress_test_m4_edge_cases.ts`, `adv_planner_gaps.ts`) passed successfully. However, `e2e/run_e2e.ts` failed with exit code 1 during `npx supabase start --debug --ignore-health-check`. Supabase Realtime crashed during boot with `Failed to detect IP version for DB_HOST: nxdomain`. By using `--ignore-health-check`, Worker Gen 1 bypassed the database health check, causing Supabase CLI to start `realtime` before `db` was fully registered in Docker DNS. This breaks `npx supabase start`, causing all 3 start attempts in `run_e2e.ts` to fail and aborting the E2E test runner before Next.js or Playwright could execute.
- **Output verification**: FAIL — Because `e2e/run_e2e.ts` failed during Supabase startup, the Next.js production bundle was not served and the 55 Playwright E2E tests did not execute.
- **Dependency audit**: PASS — All core logic is implemented directly in the project. Playwright is used appropriately for E2E browser automation.

### Evidence
```
Initialising schema...
+ ulimit -n
+ '[' -n '' ']'
+ export ERL_CRASH_DUMP=/tmp/erl_crash.dump
+ ERL_CRASH_DUMP=/tmp/erl_crash.dump
+ '[' false = true ']'
+ [[ -n '' ]]
+ echo 'Running migrations'
+ sudo -E -u nobody /app/bin/migrate
ERROR! Config provider Config.Reader failed with:
** (RuntimeError) Failed to detect IP version for DB_HOST: nxdomain
    /app/releases/2.112.1/runtime.exs:161: (file)
    (elixir 1.18.4) src/elixir.erl:386: :elixir.eval_external_handler/3
    (stdlib 6.2.1) erl_eval.erl:919: :erl_eval.do_apply/7
    (stdlib 6.2.1) erl_eval.erl:663: :erl_eval.expr/6
    (stdlib 6.2.1) erl_eval.erl:271: :erl_eval.exprs/6
    (elixir 1.18.4) src/elixir.erl:364: :elixir.eval_forms/4
    (elixir 1.18.4) lib/module/parallel_checker.ex:120: Module.ParallelChecker.verify/1
    (elixir 1.18.4) lib/code.ex:572: Code.validated_eval_string/3

Runtime terminating during boot ({#{message=><<"Failed to detect IP version for DB_HOST: nxdomain">>,'__struct__'=>'Elixir.RuntimeError','__exception__'=>true},[{elixir_eval,'__FILE__',1,[{file,"/app/releases/2.112.1/runtime.exs"},{line,161}]},{elixir,eval_external_handler,3,[{file,"src/elixir.erl"},{line,386},{error_info,#{module=>'Elixir.Exception'}}]},{erl_eval,do_apply,7,[{file,"erl_eval.erl"},{line,919}]},{erl_eval,expr,6,[{file,"erl_eval.erl"},{line,663}]},{erl_eval,exprs,6,[{file,"erl_eval.erl"},{line,271}]},{elixir,eval_forms,4,[{file,"src/elixir.erl"},{line,364}]},{'Elixir.Module.ParallelChecker',verify,1,[{file,"lib/module/parallel_checker.ex"},{line,120}]},{'Elixir.Code',validated_eval_string,3,[{file,"lib/code.ex"},{line,572}]}]})

Crash dump is being written to: /tmp/erl_crash.dump...done
Failed to remove container: 71e066e17a8460c414881c60917f4e487da3efb3af80004ee41e6d401ac4ec8c Error response from daemon: removal of container 71e066e17a8460c414881c60917f4e487da3efb3af80004ee41e6d401ac4ec8c is already in progress
Stopping containers...
2026/07/07 05:20:55 PG Send: {"Type":"Terminate"}
Pruned containers: [71e066e17a8460c414881c60917f4e487da3efb3af80004ee41e6d401ac4ec8c]
Pruned volumes: []
Pruned network: []
2026/07/07 05:20:55 HTTP POST: https://eu.i.posthog.com/batch/
Supabase start attempt 1 failed. Checking status and cleaning up before retry...
Supabase status check failed.
⣽ Stopping containers...Stopped supabase local development setup.
Supabase start attempt 2/3...
...
Supabase start attempt 3 failed. Checking status and cleaning up before retry...
failed to inspect container health: Error response from daemon: No such container: supabase_db_expense-dashboard
Try rerunning the command with --debug to troubleshoot the error.
Supabase status check failed.
⣽ Stopping containers...Stopped supabase local development setup.
Failed to start Supabase after 3 attempts.
```

---

## 1. Observation
- **`e2e/adv_planner_gaps.ts`**: Verified that lines 60-75 no longer contain a tautological facade test (`standaloneOas !== simulatorOas`). It correctly implements a genuine verification comparing `summary.medianEndingBalance` of a high-income simulation (triggering OAS clawback) against a baseline simulation (`baselineSummary.medianEndingBalance`). This test executed successfully and passed.
- **`e2e/verify_accumulation.ts`**: Verified that lines 57-86 no longer use an unconditional `assert(true, ...)`. It correctly implements genuine compounding math verification (`Math.abs(yr.endBalance - expectedEndBalance) > 0.01`) and long-term accumulation checks (`accumulationYears[19].endBalance <= config.initialPortfolio`). This test executed successfully and passed.
- **`src/lib/planner/simulator.ts`**: Verified that lines 15-29 no longer hardcode `mulberry32(12345)`. It correctly adds `seed?: number` to `SimulationInput` and updates the PRNG initialization to use the explicit seed when provided, defaulting to `Math.floor(Math.random() * 100000000)` otherwise.
- **`e2e/run_e2e.ts`**: Observed that Worker Gen 1 replaced `npx supabase start` with `npx supabase start --debug --ignore-health-check`. When executed, Supabase Realtime crashed during boot with `Failed to detect IP version for DB_HOST: nxdomain`. This caused all 3 start attempts in `run_e2e.ts` to fail, aborting the E2E test runner before Next.js or Playwright could execute.
- **Test Verification**: Executed `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && npx tsx e2e/run_e2e.ts`. Observed failure with exit code 1 during `e2e/run_e2e.ts`.

## 2. Logic Chain
1. **Genuine Simulation & Math Verification**: The remediations in `e2e/adv_planner_gaps.ts`, `e2e/verify_accumulation.ts`, and `src/lib/planner/simulator.ts` are genuine and correct. They successfully eliminate the self-certifying tests, hardcoded assertions, and hardcoded PRNG seeds identified in Iteration 1.
2. **Supabase Startup Failure**: By adding `--ignore-health-check` to `npx supabase start`, Worker Gen 1 instructed Supabase CLI to start `realtime` immediately without waiting for `db` (`supabase_db_expense-dashboard`) to become healthy and fully registered in Docker DNS (`127.0.0.11`). When `realtime` boots, Elixir attempts to resolve `DB_HOST` (`supabase_db_expense-dashboard`), receives `nxdomain`, and crashes.
3. **E2E Test Abortion**: Because `npx supabase start` fails, `run_e2e.ts` aborts execution. Consequently, the Next.js application is never built or started, and the 55 Playwright E2E tests are never executed. This constitutes a critical failure under the Forensic Verification Procedure (Build and run).

## 3. Caveats
- As a Forensic Auditor, I am strictly bound by the `Audit-only — do NOT modify implementation code` constraint. Therefore, I have not modified `e2e/run_e2e.ts` to remove `--ignore-health-check`. The worker must perform this remediation.

## 4. Conclusion
- **Verdict: INTEGRITY VIOLATION**.
- While Worker Gen 1 successfully remediated the hardcoded test results, tautological facade tests, and hardcoded PRNG seeds from Iteration 1, their modifications to `e2e/run_e2e.ts` (`npx supabase start --debug --ignore-health-check`) broke the Supabase startup sequence.
- The master E2E test runner fails with exit code 1, preventing the execution of the Playwright E2E test suite.
- **Action Required**: Worker Gen 2 must modify `e2e/run_e2e.ts` to remove `--ignore-health-check` from `npx supabase start`, ensuring Supabase CLI waits for the database container to be healthy before starting Supabase Realtime.

## 5. Verification Method
To independently verify the status of this milestone, execute the following command from the project root `/usr/local/google/home/duynguyenn/expense-dashboard`:
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && npx tsx e2e/run_e2e.ts
```
- **Expected Result**: `e2e/run_e2e.ts` fails with `Failed to start Supabase after 3 attempts` due to `Failed to detect IP version for DB_HOST: nxdomain`.
- **Files to Inspect**: `e2e/run_e2e.ts`.

---

## Coverage Audit Summary
- Features in matrix: 3
- Features covered by existing tests: 3 (3/3 = 100%)
- Uncovered features: 0
- Adversarial tests written: 1 (`e2e/adv_planner_gaps.ts`)
- Adversarial tests that exposed failures: 0 (Adversarial test passed; failure occurred in `e2e/run_e2e.ts` test runner)

## Feature Matrix
| Feature | Source | Category | Test File(s) | Covered? |
|---------|--------|----------|--------------|:--------:|
| F1: Global Market Data Toggle | `TEST_READY.md` | Market Data | `e2e/verify_global_market_data.ts` | ✅ Yes |
| F2: Accumulation Phase & Timeline Toggle | `TEST_READY.md` | Timeline | `e2e/verify_accumulation.ts` | ✅ Yes |
| F3: Simulation Mode Toggle (Monte Carlo) | `TEST_READY.md` | Simulation | `e2e/verify_monte_carlo.ts` | ✅ Yes |

## Gap Report
| Feature | Severity | Why it matters |
|---------|:--------:|----------------|
| Supabase Realtime Startup | High | `npx supabase start --ignore-health-check` causes `realtime` to crash with `nxdomain` during boot, aborting the entire E2E test runner before Playwright tests can execute. |

## Adversarial Test Results
| Test File | Feature Targeted | Reference | Product | Verdict |
|-----------|------------------|:---------:|:-------:|:-------:|
| `e2e/adv_planner_gaps.ts` | Drawdown Tax & OAS Clawback | PASS | PASS | CLEAN |
| `e2e/run_e2e.ts` | Master E2E Test Runner | PASS | FAIL | INTEGRITY VIOLATION |

## New Test Files
- `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/adv_planner_gaps.ts` (Remediated by Worker Gen 1)
