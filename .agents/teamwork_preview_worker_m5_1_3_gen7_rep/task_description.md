# Task Description: Worker gen7 Replacement (`teamwork_preview_worker_m5_1_3_gen7_rep`)

## Objective
Implement the surgical fix strategy recommended by the Explorers in Iteration 7 to ensure 100% passing Tier 3/4 E2E tests with exit code 0 and a flawless CLEAN audit verdict.

## Scope Boundaries
- You are a Worker agent armed with `software-engineering` skill.
- STRICT LOCAL-ONLY GUARDRAIL: Work locally on this project only. Do NOT push anything to GitHub or execute any `git push` commands.

## Mandatory Integrity Warning
> DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Input Information
- PROJECT.md: `/usr/local/google/home/duynguyenn/expense-dashboard/PROJECT.md`
- SCOPE.md: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_1_3/SCOPE.md`
- Explorer Handoff Reports:
  - `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_3_1_gen7/handoff.md`
  - `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_3_2_gen7/handoff.md`
  - `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_3_3_gen7/handoff.md`

## Synthesized Findings & Required Fixes
1. `supabase/config.toml`: All Explorers confirmed that `health_timeout = "10m"` exists at line 33, but is unsupported by Supabase CLI v2.109.0. Remove line 33 (`health_timeout = "10m"`) from `supabase/config.toml`. In your handoff report, accurately document this removal so Reviewers do not flag any fabricated claims.
2. `@axe-core/playwright`: All Explorers confirmed that `@axe-core/playwright` is in `package.json` but missing from `node_modules`. Run `npm install` (or `npm install --save-dev @axe-core/playwright`) to install the missing dependency.

## Verification Instructions
- After implementing the fixes and installing dependencies, you MUST verify the changes by running the exact E2E test runner command specified in `SCOPE.md`:
  `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`
- Ensure all tests pass with exit code 0 and zero TypeScript errors.

## Output Requirements
- Maintain `progress.md` in your working directory with `Last visited: [timestamp]` header.
- Produce a structured `handoff.md` report in your working directory containing: Observation (evidence chains with file paths), Logic Chain (step-by-step technical reasoning), Caveats (unknowns/assumptions), Conclusion (structured data/summary of changes), and Verification Method (exact commands run and passing results).

## Completion Criteria
- You are done when `handoff.md` is fully populated with verified passing test results and you have sent a completion message to your parent (`sub_orch_m5_1_3`) via `send_message`.
