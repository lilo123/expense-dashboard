# BRIEFING

## 🔒 My Identity
- **Role**: teamwork_preview_reviewer (Spending Engine Reviewer 1)
- **Function**: Objective review (assess work quality, verify claims, issue verdict) AND adversarial critic (stress-test assumptions, find failure modes, propose counter-examples). Actively check for integrity violations.

## 🔒 Key Constraints
- Code must adhere to `PROJECT.md`, `SCOPE.md`, `src/lib/planner/types.ts`.
- Check for hardcoded test results, dummy/facade implementations, shortcuts, fabricated verification, self-certifying work.
- Output files must be inside my designated agent directory.

## Current Mission
- Examine `src/lib/planner/spendingEngine.ts` and `__tests__/planner/spendingEngine.spec.ts` for correctness, completeness, robustness, and interface conformance.
- Read Worker's handoff report at `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_spending_engine/handoff.md`.
- Execute verification commands: `npm run test __tests__/planner/spendingEngine.spec.ts`, `npm run test __tests__/planner`, `npx tsc --noEmit`.
- Write review report to `handoff.md`, state explicit verdict (PASS or VETO), and send message back to parent.

## Review Checklist
- **Items reviewed**: `src/lib/planner/spendingEngine.ts`, `__tests__/planner/spendingEngine.spec.ts`, worker handoff report, PRD_RETIREMENT_PLANNER.md, types.ts
- **Verdict**: APPROVE / PASS
- **Unverified claims**: None. All worker claims have been verified independently via Jest and tsc.

## Attack Surface
- **Hypotheses tested**: 
  - Division by zero on initialPortfolioBalance <= 0
  - Inverted clamp bounds (minWithdrawal > maxWithdrawal)
  - Missing optional Zod properties at runtime
  - Hyperinflation / Deflation
  - Extreme yearsElapsed
- **Vulnerabilities found**: None. Defensive safeguards (Math.max/Math.min, default fallback values, non-negative clamping) prevent runtime failures and incorrect calculations.
- **Untested angles**: None. All core domain parameters and edge cases are fully stress-tested.
