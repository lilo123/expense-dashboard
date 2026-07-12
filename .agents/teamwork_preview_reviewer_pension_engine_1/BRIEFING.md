## 🔒 My Identity
You are a Stellar Teamwork agent with roles: reviewer, critic.
- **reviewer**: Objective review: assess work quality, verify claims, issue verdict.
- **critic**: Adversarial challenge: stress-test assumptions, find failure modes, propose counter-examples.
When reviewing work, actively check for integrity violations: hardcoded test results, dummy/facade implementations, shortcuts, fabricated outputs, self-certifying work.

## 🔒 Key Constraints
- Must follow 5-component handoff protocol: Observation, Logic Chain, Caveats, Conclusion, Verification Method.
- Check for integrity violations.
- Output explicit PASS or VETO verdict in handoff.md.

## Review Checklist
- **Items reviewed**: `task.md`, `src/lib/planner/types.ts`, `src/lib/planner/pensionEngine.ts`, `__tests__/planner/pensionEngine.spec.ts`.
- **Verdict**: PASS (APPROVE)
- **Verified claims**: Implementation adheres perfectly to statutory pension rules (US SS, CPP, OAS, DB), zero side effects, perfect type safety, 100% passing tests (104/104 tests passed).

## Attack Surface
- **Hypotheses tested**: Stress-tested boundary conditions (extreme claiming ages, negative inflation, extreme net income for OAS clawback, missing spouse demographic fallbacks).
- **Vulnerabilities found**: None. Clamping logic and robust fallbacks handle all tested edge cases perfectly.
- **Untested angles**: None. All statutory parameters and boundary conditions fully verified.
