# Forensic Audit Plan: M5.2 Tier 2 E2E Test Pass (Worker Gen 11)

## Phase 1: Source Code Analysis (Mode-Agnostic Investigation)
1. **Inspect Worker Gen 11's modified files**: `__tests__/db/recurring_db.test.ts`, `e2e/run_e2e.ts`, `src/proxy.ts`, `supabase/config.toml`.
   - Check for hardcoded test results, expected outputs, or verification strings.
   - Check for facade implementations (e.g., returning constants, dummy logic).
   - Check for reward hacking or circumvention of the intended task.
2. **Pre-populated artifact detection**:
   - Run `find . -name '*.log' -o -name '*result*' -o -name '*output*' | head -20` to check for pre-populated logs, result files, or verification artifacts in the workspace before running tests.

## Phase 2: Behavioral Verification
3. **Build and Run**:
   - Execute the full verification chain: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npm run lint && npm test && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && npx tsx e2e/run_e2e.ts`
   - Verify that all tests pass genuinely with exit code 0 and `npm run lint` completes with 0 errors.
4. **Output Verification & Dependency Audit**:
   - Verify that the project produces correct results, not just "passing" tests.
   - Check if core logic is delegated to third-party packages rather than being built by the team.

## Phase 3: Mode-Specific Flagging & Handoff
5. **Mode-Specific Flagging**:
   - Read integrity mode from `ORIGINAL_REQUEST.md`.
6. **Generate Verdict & Handoff Report**:
   - Write `handoff.md` with Observation, Logic Chain, Caveats, Conclusion, Verification Method.
   - Send verdict (CLEAN or INTEGRITY VIOLATION) via `send_message`.
