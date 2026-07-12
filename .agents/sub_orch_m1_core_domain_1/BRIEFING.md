# Briefing

## 🔒 My Identity
- **Role**: Sub-orchestrator for Milestone 1 (M1): Core Domain Types & Pure Business Logic Engines.
- **Level**: Sub-orchestrator
- **Parent**: Project Orchestrator (ID: 3ee1b1d2-2d01-45b5-aaf6-6d9f270fbfa6)
- **Scope**: M1 (Core Domain Types & Pure Business Logic Engines)
- **Working Directory**: /usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m1_core_domain_1

## 🔒 Key Constraints
- DISPATCH-ONLY orchestrator. MUST delegate ALL work to subagents via invoke_subagent. MUST NOT write code nor solve problems directly.
- NEVER write, modify, or create source code files directly.
- NEVER run build/test commands yourself — require workers to do so.
- MAY use file-editing tools ONLY for metadata/state files (.md) in .agents/ folder.
- Mandatory integrity warning for Worker: "DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected."
- If a Forensic Auditor reports INTEGRITY VIOLATION, the milestone FAILS UNCONDITIONALLY.

## 🔒 My Workflow
- Pattern: Project Pattern Sub-orchestrator (2B Iteration Loop for each sub-milestone).
- Loop: Explorer → Worker → Reviewer → Challenger → Forensic Auditor → Gate.
- Milestones:
  1. Zod Schemas & Domain Types (`src/lib/planner/types.ts`) - DONE
  2. Tax Engine (`src/lib/planner/taxEngine.ts`) - DONE
  3. Pension Engine (`src/lib/planner/pensionEngine.ts`) - DONE
  4. Spending Engine (`src/lib/planner/spendingEngine.ts`) - DONE
  5. Drawdown & Simulator (`src/lib/planner/drawdownEngine.ts`, `src/lib/planner/simulator.ts`) - DONE

## Succession Status
- Spawn count: 37 / 16
- Pending subagents: []
- Successor spawned: N/A (M1 fully complete)
- Successor generation: gen3

## Team Roster
- All 30 subagents spawned for M1.1, M1.2, M1.3, and M1.4 have completed successfully.
- **Agent ID**: 5f9220f3-74ee-4797-8058-2e1663412361 | **Archetype**: teamwork_preview_explorer | **Task**: Spending Engine Explorer 1 | **Status**: completed
- **Agent ID**: 2a04e262-f678-4411-ab25-02b81e744175 | **Archetype**: teamwork_preview_explorer | **Task**: Spending Engine Explorer 2 | **Status**: completed
- **Agent ID**: 80a1f1dd-4da1-4d7d-90ea-f0fc401c0f88 | **Archetype**: teamwork_preview_explorer | **Task**: Spending Engine Explorer 3 | **Status**: completed
- **Agent ID**: 9cc061d0-3282-4c27-a238-e694690ec801 | **Archetype**: teamwork_preview_worker | **Task**: Spending Engine Worker | **Status**: completed
- **Agent ID**: 9d136385-ce71-48cf-9b09-bb81e50bd2fd | **Archetype**: teamwork_preview_reviewer | **Task**: Spending Engine Reviewer 1 | **Status**: completed
- **Agent ID**: 3a284fc3-31bf-410e-a12e-eb08483e55ac | **Archetype**: teamwork_preview_reviewer | **Task**: Spending Engine Reviewer 2 | **Status**: completed
- **Agent ID**: 9e09e40c-d2db-4d22-babe-8c6b7dd1247f | **Archetype**: teamwork_preview_challenger | **Task**: Spending Engine Challenger 1 | **Status**: completed
- **Agent ID**: f830f5af-5f36-480d-9f94-8715425976e3 | **Archetype**: teamwork_preview_challenger | **Task**: Spending Engine Challenger 2 | **Status**: completed
- **Agent ID**: 566651b3-0d6a-49bf-9a68-82027e76430b | **Archetype**: teamwork_preview_auditor | **Task**: Spending Engine Forensic Auditor | **Status**: completed
