# BRIEFING — 2026-07-06T21:06:15Z

## Mission
Investigate Supabase startup/restart recovery failures and process suicide flaws in E2E tests (`e2e/run_e2e.ts`) and recommend a concrete fix strategy without implementing it.

## 🔒 My Identity
- Archetype: Stellar Teamwork explorer
- Roles: teamwork_preview_explorer
- Working directory: /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_tier1_iter15_2
- Original parent: a2dfdb1c-4cd3-448f-b6c1-9f62b94fa3c3
- Milestone: Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Must analyze the failures and recommend a concrete fix strategy addressing `Supabase health check failed: http://127.0.0.1:54321 is unreachable.` and `fuser -k 54321/tcp` process suicide flaw.
- Ensure E2E test runner retains all required guardrails, cleanups, delays, and genuine business logic without cheating.

## Current Parent
- Conversation ID: a2dfdb1c-4cd3-448f-b6c1-9f62b94fa3c3
- Updated: 2026-07-06T21:06:15Z

## Investigation State
- **Explored paths**: `e2e/run_e2e.ts`, `e2e/seed.ts`, `e2e/init_db.ts`, `supabase/config.toml`, `next.config.js`, `supabase/migrations/20260624000000_retirement_planner.sql`, `src/lib/planner/*.ts`
- **Key findings**: 
  - `e2e/run_e2e.ts` manually executes `docker network create supabase_network_expense-dashboard` in `setup()` and health check recovery blocks, which conflicts with Supabase CLI's internal docker-compose network creation logic, causing `Unknown: ChildProcess.exitCode`.
  - `npx supabase start --ignore-health-check` falsely reports `supabase start is already running` when lingering daemon lock files or containers exist in `supabase/.temp/` or Docker.
  - `setup()` blindly trusts `npx supabase start` exit code 0 without verifying HTTP reachability at `http://127.0.0.1:54321`.
  - **`fuser -k 54321/tcp` Process Suicide Flaw (Challenger 2)**: During health check restart recovery, `execSync('fuser -k 54321/tcp ...')` spawns a `/bin/sh` child process that inherits the `fetch` TCP socket file descriptor from `node`. `fuser -k` identifies `/bin/sh` as holding a socket on port 54321 and terminates it with `SIGKILL`. `execSync` detects the `SIGKILL`, throws an error, and aborts the `try...catch` block before `rm -rf supabase/.temp` or `npx supabase start` can execute, leaving Supabase permanently stopped.
- **Unexplored areas**: None. Investigation complete.

## Key Decisions Made
- Formulated exact code changes for `e2e/run_e2e.ts` to remove manual `docker network create`, remove `54321/tcp` from `fuser -k` in health check recovery blocks, wrap every single `execSync` statement in its own individual `try...catch` block, enforce truly clean teardown (`rm -rf supabase/.temp`, `pkill -f supabase`, `docker rm -f`, `docker volume rm -f`, `npx supabase stop --no-backup`), and implement an async `setup()` with robust `fetch` reachability verification.

## Artifact Index
- /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_tier1_iter15_2/ORIGINAL_REQUEST.md — Original user request
- /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_tier1_iter15_2/progress.md — Liveness heartbeat and progress tracking
- /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_tier1_iter15_2/handoff.md — 5-component Handoff Report with concrete fix strategy
