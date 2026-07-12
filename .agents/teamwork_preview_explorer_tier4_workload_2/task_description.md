# Task Description: Explorer 2 (Milestone 4: Tier 4 Real-World Workload Scenarios)

## Objective
Analyze the codebase and existing E2E test files to design the implementation strategy for `e2e/planner_tier4_workload.spec.ts`. Specifically, focus on designing the test cases for:
- **Scenario 3**: Adversarial BOLA Attempt on Premium Plan by Free User (F2, F3, F5, F7)
- **Scenario 4**: High-Net-Worth Multi-Account Drawdown & Tax Optimization (F2, F4, F6, F7)

## Scope Boundaries
- **Explore and analyze ONLY**. Do NOT write or modify source code or test files directly.
- Recommend concrete implementation strategies, Playwright locators, and assertions for the Worker.

## Input Information
- User request: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/orchestrator/ORIGINAL_REQUEST.md`
- Project scope: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/orchestrator/PROJECT.md`
- Testing track scope: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_e2e_testing_track_1/SCOPE.md`
- Test Infra spec: `/usr/local/google/home/duynguyenn/expense-dashboard/TEST_INFRA.md`
- Existing test files to examine for consistency: `e2e/planner_tier1_feature.spec.ts`, `e2e/planner_tier2_boundary.spec.ts`, `e2e/planner_tier3_pairwise.spec.ts`, `e2e/seed.ts`, `playwright.config.ts`.

## Output Requirements
- Write your analysis and concrete recommendations to `analysis.md` in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_tier4_workload_2`).
- Write your `handoff.md` in your working directory following the Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method) and send a completion message to your parent.

## Completion Criteria
- Comprehensive analysis of Scenarios 3 & 4 completed, with concrete Playwright code snippets and assertion strategies documented in `analysis.md` and `handoff.md`.
