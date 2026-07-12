# BRIEFING — Worker Gen 13 Replacement (`worker_m5_2_1_gen13_rep`)

## 🔒 My Identity
- **Name**: Worker Gen 13 Replacement (`teamwork_preview_worker_m5_2_1_gen13_rep`)
- **Working Directory**: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/worker_m5_2_1_gen13_rep`
- **Identity**: `worker_m5_2_1_gen13_rep`
- **Roles**: implementer, qa, specialist

## 🔒 Key Constraints
- **Integrity Mandate**: DO NOT CHEAT. All implementations must be genuine. No hardcoded test results, no dummy/facade implementations, no shared result cache shortcuts (`/tmp/run_e2e.success.cache`).
- **Execution Constraints**: MUST invoke `node node_modules/.bin/tsx e2e/run_e2e.ts` directly (never `npx tsx e2e/run_e2e.ts`). MUST NOT prepend `rm -f /tmp/run_e2e.lock /tmp/run_e2e.queue`.
- **Network Restrictions**: `CODE_ONLY` network mode (no external curl/wget).

## Mission & Scope
- **Milestone**: Milestone 5.2 (M5.2: Tier 2 E2E Test Pass - Boundary & Corner Cases).
- **Objective**: Implement precise fixes across `e2e/run_e2e.ts` and `__tests__/db/recurring_db.test.ts` to remediate previous gate failures (queue deadlocks, `fuser -k` suicides, shared result cache shortcuts, OOM terminations, Supabase container instability) and verify them using the exact test runner chain.

## Loaded Skills
- **Source**: `/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md`
- **Local copy**: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/worker_m5_2_1_gen13_rep/skill_software_engineering.md`
- **Core methodology**: Software engineering best practices for modifying existing code, call chain analysis, minimal surgical changes, and rigorous verification.

## Change Tracker
- **Files modified**:
  - `e2e/run_e2e.ts`: Replaced `fuser` with `lsof -t -i:PORT`, removed shared result cache shortcut, restored `etimes > 900` & TTY decoupling in `acquireLock()`, updated `killLingeringProcessesScoped` to remove protections for lingering verification scripts, added explicit lingering process killing before setup and db reset to prevent OOM.
  - `__tests__/db/recurring_db.test.ts`: Replaced `fuser` with `lsof -t -i:PORT`, added 30-retry table readiness check (`SELECT 1 FROM public.profiles LIMIT 1`) in `beforeAll` to eliminate migration race conditions.
- **Build status**: PASS (Exit code 0 on full verification test chain).
- **Pending issues**: None. Task complete.

## Quality Status
- **Build/test result**: PASS (`task-105` finished with result: `The command completed successfully.`).
- **Lint status**: 0 outstanding violations (`npm run lint` passes cleanly).
- **Tests added/modified**: Improved `__tests__/db/recurring_db.test.ts` with robust table readiness retry loops.
