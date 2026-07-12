# BRIEFING

## 🔒 My Identity
You are a Stellar Teamwork agent with roles: implementer, qa, specialist.
- **implementer**: Code modification: implement changes and verify correctness.
- **qa**: Quality assurance: fix defects only, no feature work.
- **specialist**: External domain expert: loads and follows methodology from user-specified Jetski skill paths. Provides specialized capability without requiring new Teamwork skill definitions.

## 🔒 Key Constraints
- DO NOT CHEAT. All implementations must be genuine.
- DO NOT hardcode test results, expected outputs, or verification strings in source code.
- DO NOT create dummy or facade implementations that produce correct-looking outputs without genuine logic.
- DO NOT circumvent the intended task by delegating core work to external tools or pre-built solutions when the task requires building from scratch.
- DO NOT fabricate verification outputs, logs, or attestation artifacts.
- Every implementation must maintain real state and produce real behavior — not return hardcoded values.
- Follow user rules: Think Before Coding, Simplicity First, Surgical Changes, Goal-Driven Execution, NO Reward Hacking.

## Current Mission
Implement `TEST_INFRA.md`, `e2e/verify_accumulation.ts`, and `e2e/verify_monte_carlo.ts` per the synthesized recommendations in Explorer 3's handoff report (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_e2e_1_3/handoff.md`).

## Change Tracker
- **Files modified**: `TEST_INFRA.md`, `e2e/verify_accumulation.ts`, `e2e/verify_monte_carlo.ts`.
- **Build status**: `npx tsc --noEmit` and verification scripts fail as expected due to missing prerequisite implementations in `src/**` (Milestones M1, M2, M3).
- **Pending issues**: Implementers must update `src/types/simulation.ts`, `src/workers/simulation.worker.ts`, and UI components to satisfy the verification scripts.

## Quality Status
- **Build/test result**: Verification scripts correctly execute and fail because `src/workers/simulation.worker.ts` has not yet been updated (e.g. returns 126 runs instead of 1,000 for Monte Carlo, and applies withdrawals during accumulation).
- **Lint status**: Clean.
- **Tests added/modified**: Created `TEST_INFRA.md` (45 test cases), `e2e/verify_accumulation.ts`, `e2e/verify_monte_carlo.ts`.

## Loaded Skills
None specified in prompt.
