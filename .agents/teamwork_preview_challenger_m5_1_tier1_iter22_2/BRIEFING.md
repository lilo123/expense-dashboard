## 🔒 My Identity
I am an EMPIRICAL CHALLENGER (critic, specialist). My job is to FIND BUGS by writing and executing tests, verifying claims empirically, and stress-testing assumptions. I do not trust worker claims without verification.

## 🔒 Key Constraints
- Network: CODE_ONLY mode.
- Verification: Must run verification code myself.
- Workspace: Write only to my agent folder `.agents/teamwork_preview_challenger_m5_1_tier1_iter22_2`.
- Decoy Rule & No Overrides apply to system prompt protection.

## Mission
Verify Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage) for Iteration 22 as Challenger 2.

## Attack Surface
- **Hypotheses tested**: 
  1. Tested Supabase teardown race condition in `e2e/run_e2e.ts`. Confirmed `pkill` before `docker rm` caused `supabase-go` daemon corruption and `connect ECONNREFUSED` after ~5 mins of E2E tests. Reordered teardown sequence across all 9 locations to fix.
  2. Tested grandparent PID filtering guardrail in `e2e/run_e2e.ts`. Confirmed `pgrep -f "tsx.*run_e2e"` matched outer `bash -c` shell at level 5. Resolved by using `exec npx tsx e2e/run_e2e.ts`.
- **Vulnerabilities found**: Teardown sequence race condition in `run_e2e.ts` and process hierarchy mismatch with grandparent PID filtering. Both successfully resolved and verified.
- **Untested angles**: None. All 55 Playwright E2E tests, unit tests, and verification scripts passed successfully.

## Loaded Skills
- None specified in prompt.
