# Task Description: Tier 3 E2E Explorer 1 (Iteration 7, Gen 2)

## Objective
Investigate the Forensic Auditor's INTEGRITY VIOLATION verdict and Reviewer 1 & 2 REQUEST_CHANGES vetoes from Iteration 6, and recommend a concrete fix strategy for Milestone 5.3 (Tier 3 E2E Test Pass - Cross-Feature Combinations). Do NOT implement the fixes yourself.

## Input Information
Read the following files:
- `/usr/local/google/home/duynguyenn/expense-dashboard/PROJECT.md`
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_3_tier3_gen2/SCOPE.md`
- `/usr/local/google/home/duynguyenn/expense-dashboard/TEST_READY.md`
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_auditor_m5_3_tier3_iter6_1_gen2/handoff.md`
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_reviewer_m5_3_tier3_iter6_1_gen2/handoff.md`
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_reviewer_m5_3_tier3_iter6_2_gen2/handoff.md`

### Forensic Auditor 1 Full Evidence Report (Iteration 6)
```
On branch main
Your branch is up to date with 'origin/main'.

--- Test Case 8/8: [F1: global] + [F2: retirement_and_accumulation] + [F3: monte_carlo] ---
✔ Zod schema validation passed for combination 8
✔ Simulation successfully executed 1000 runs
✔ Timeline duration correctly equals 50 years (got 50)
✔ Success rate is valid number (99.9%)
✔ Median ending balance is valid number ($16981057.6308324)

=== [E2E VERIFICATION] Tier 3 Pairwise Feature Interaction Tests PASSED (100% Success) ===

Building fresh Next.js production bundle...

> tmp_next@0.1.0 build
> rm -rf .next && next build --webpack

▲ Next.js 16.2.4 (webpack)
- Environments: .env.local
- Experiments (use with caution):
  · cpus: 1
  ✓ memoryBasedWorkersCount
  ? outputFileTracing (invalid experimental key)

  Creating an optimized production build ...
✓ Compiled successfully in 22.5s

<--- Last few GCs --->

[1622755:0xa0f3000]    10448 ms: Mark-Compact (reduce) 510.7 (524.7) -> 510.1 (522.0) MB, pooled: 0 MB, 225.50 / 0.00 ms  (+ 0.1 ms in 0 steps since start of marking, biggest step 0.0 ms, walltime since start of marking 237 ms) (average mu = 0.104, curren

<--- JS stacktrace --->

FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0xe42d60 node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin/node]
 2: 0x121ded0 v8::Utils::ReportOOMFailure(v8::internal::Isolate*, char const*, v8::OOMDetails const&) [/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin/node]
 3: 0x121e1a7 v8::internal::V8::FatalProcessOutOfMemory(v8::internal::Isolate*, char const*, v8::OOMDetails const&) [/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin/node]
 4: 0x144d015  [/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin/node]
 5: 0x144d043  [/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin/node]
 6: 0x146611a  [/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin/node]
 7: 0x14692e8  [/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin/node]
 8: 0x1cd07a1  [/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin/node]
Next.js build worker exited with code: null and signal: SIGABRT
E2E Tests execution failed! Error: Command failed: npm run build
```
- **Auditor Finding**: `e2e/run_e2e.ts` line 358 explicitly sets `NODE_OPTIONS: '--max-old-space-size=512'`, which starves the Next.js webpack production build of memory. Must increase `--max-old-space-size` (e.g., to `4096`).

### Reviewer 1 & 2 Findings (Iteration 6)
1. **Reviewer 1 Finding (`e2e/run_e2e.ts`)**: `killLingeringProcessesScoped` kills concurrent waiting test runners sharing the same TTY with `kill -9` (exit code 137). Must modify `killLingeringProcessesScoped` to explicitly exclude processes that are currently waiting for the mutex lock, or exclude any active `run_e2e` process entirely from the kill list (e.g., only target actual orphaned Next.js/Jest/Webpack worker processes rather than the test runner itself).
2. **Reviewer 2 Finding (`supabase/config.toml`)**: `health_timeout = "5m"` remains at line 6 of `supabase/config.toml`, causing Supabase CLI 2.109.0 to fail instantly with `'config.config' has invalid keys: health_timeout`. Must completely remove `health_timeout = "5m"` from `supabase/config.toml`.

## Scope Boundaries
- Read-only exploration and analysis.
- Do NOT modify any source code, configuration files, or test scripts.
- Do NOT execute `blaze build`, `blaze test`, or `npm run` commands that modify state.

## Output Requirements & Completion Criteria
When your investigation is complete, write `handoff.md` in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_3_tier3_iter7_1_gen2`) following the Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method). Your report must provide a concrete, actionable fix strategy for the Worker to resolve all three issues above.
When done, send a completion message to your parent (`fbb8e945-2a98-4e23-89f2-f6529a71f015`).
