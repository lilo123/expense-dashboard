# BRIEFING

## 🔒 My Identity
You are an EMPIRICAL CHALLENGER. Your job is to FIND BUGS by writing and executing tests — generators, oracles, and stress harnesses. You MUST run verification code yourself. Do NOT trust the worker's claims or logs. If you cannot reproduce a bug empirically, it does not count.
You are a Stellar Teamwork agent with roles: critic, specialist.
- **critic**: Adversarial challenge: stress-test assumptions, find failure modes, propose counter-examples.
- **specialist**: External domain expert: loads and follows methodology from user-specified Jetski skill paths.

## 🔒 Key Constraints
- Opaque-box, requirement-driven empirical verification and adversarial stress-testing analysis of `e2e/planner_tier3_pairwise.spec.ts`.
- Do NOT modify any source code or test files in `e2e/`.
- Maintain all agent metadata within your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_challenger_tier3_pairwise_2`).
- Verify clean compilation via `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin; npx tsc --noEmit`.
- Maintain `BRIEFING.md`, `progress.md`, and produce `handoff.md`.

## Attack Surface
- **Hypotheses tested**: 
  1. Clean TypeScript compilation of `e2e/planner_tier3_pairwise.spec.ts` via `npx tsc --noEmit`. Result: PASSED (exit code 0, zero errors).
  2. Pairwise combinatorial completeness across 7 features. Result: Verified exactly 21 unique pairs ($7 \times 6 / 2 = 21$) across 32 test cases.
  3. Adversarial review of locators, auth handoff assumptions, BOLA DOM injections, and Web Worker simulation timeouts. Result: Identified multiple potential failure modes and locator fragilities in CI environments.
- **Vulnerabilities found**:
  1. *Auth Handoff Race Condition*: `loginAs` relies on `waitForURL` which may resolve before client-side cookies/stores finish persisting, making immediate `page.goto` vulnerable to auth loss.
  2. *Locator Fragility*: Relying on `.plan-card.first()` across multiple tests creates order/concurrency coupling. `document.querySelector('form')` for BOLA injection risks targeting global search/header forms instead of the plan builder form.
  3. *Simulation Timeout Under CI Load*: 15s timeout for 5,000+ Monte Carlo paths may flake on throttled CI workers.
  4. *Server Action API Route Dependency*: `fetch('/api/actions/savePlan')` assumes a REST wrapper rather than Next.js native Server Action headers.
- **Untested angles**: Execution of Playwright test suite against a running server (deferred to Milestone 4 UI implementation as established in `PROJECT.md`).

## Loaded Skills
- **Source**: None specified in prompt.
- **Local copy**: N/A
- **Core methodology**: Teamwork baseline, Empirical Challenger adversarial review and verification protocol.
