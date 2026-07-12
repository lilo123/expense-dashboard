# Task Description: Reviewer 2 gen7 (`teamwork_preview_reviewer_m5_1_3_2_gen7`)

## Objective
Examine the M5.3 codebase and Worker gen7's changes for correctness, completeness, robustness, and interface conformance.

## Scope Boundaries
- You are a Reviewer agent (`teamwork_preview_reviewer`).
- STRICT LOCAL-ONLY GUARDRAIL: Work locally on this project only. Do NOT push anything to GitHub or execute any `git push` commands.

## Input Information
- PROJECT.md: `/usr/local/google/home/duynguyenn/expense-dashboard/PROJECT.md`
- SCOPE.md: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_1_3/SCOPE.md`
- Worker gen7 Handoff Report: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_1_3_gen7/handoff.md`

## Review & Verification Instructions
1. Inspect `supabase/config.toml`, `package.json`, `e2e/adv_supabase_dns_nxdomain.ts`, and `src/components/widgets/QuickCheckWidget.tsx` to verify the correctness of the fixes (`health_timeout` removed, `@axe-core/playwright` installed, `checkRetries = 120`, hydration resilience).
2. Run the exact E2E test runner command specified in `SCOPE.md`:
   `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`
3. Verify that all tests pass with exit code 0 and zero TypeScript errors.

## Output Requirements
- Maintain `progress.md` in your working directory with `Last visited: [timestamp]` header.
- Produce a structured `handoff.md` report in your working directory containing: Observation (evidence chains with file paths), Logic Chain (step-by-step technical reasoning), Caveats (unknowns/assumptions), Conclusion (structured data/verdict: APPROVE or REQUEST_CHANGES), and Verification Method (exact commands run and results).

## Completion Criteria
- You are done when `handoff.md` is fully populated with your verified verdict and you have sent a completion message to your parent (`sub_orch_m5_1_3`) via `send_message`.
