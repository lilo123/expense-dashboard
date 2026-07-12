# BRIEFING

## 🔒 My Identity
- **Identity**: teamwork_preview_worker_m5_3_1_1_gen4
- **Working Directory**: /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_3_1_1_gen4
- **Roles**: implementer, qa, specialist

## 🔒 Key Constraints
- **Network Mode**: CODE_ONLY (No external network/HTTP client access, no curl/wget/lynx).
- **Integrity Mandate**: DO NOT CHEAT. All implementations must be genuine. No hardcoded test results, dummy facades, or circumvention.
- **Project Specific Rules**: Never run python with `python3` (use blaze). Prefix GChat messages with `🤖 jetski `. Use gdocs skill for Google Docs.
- **Next.js Rules**: Heed breaking changes in Next.js.
- **User Rules**: Think Before Coding, Simplicity First, Surgical Changes, Goal-Driven Execution, No Reward Hacking.

## Mission & Scope
- **Mission**: Implement bulletproof `run_e2e.ts` clean reset and `PlatformError` retry loops required for Milestone 5.3 (M5.3: Tier 3 E2E Test Pass - Cross-Feature Combinations) in Iteration 4.
- **Scope**: Wrap Supabase startup in a 5-retry loop catching `PlatformError` / `ChildProcess.exitCode`, execute `teardownSupabase()`, and retry until healthy. Replace `migration up` with `db reset`. Ensure OOM immunity and prevent process elimination wars.

## Change Tracker
- **Files modified**:
  - `e2e/adv_supabase_dns_nxdomain.ts`: Implemented robust `PlatformError` retry loop, added `docker ps` active while loop, `docker network rm`, `rm -rf $HOME/.supabase`, and removed `npx supabase stop` to prevent killing process group.
  - `e2e/run_e2e.ts`: Implemented robust `PlatformError` retry loop, added `docker ps` active while loop, `docker network rm`, `rm -rf $HOME/.supabase`, removed `npx supabase stop`, added `SUPABASE_DAEMON_ENABLE=false`, added `NODE_OPTIONS=--max-old-space-size=512` to `db reset`, added `ancestorPids` check to `killLingeringProcessesScoped`, and exempted test runner/server from OOM killer (`oom_score_adj = -1000`).
  - `supabase/config.toml`: Removed invalid `health_timeout` keys from `[api]`, `[realtime]`, `[auth]`, and `[db]` to fix Supabase CLI v2.109.0 decoding failures.
- **Build status**: PASS (All E2E verification tests passed with exit code 0).
- **Pending issues**: None.

## Quality Status
- **Build/test result**: PASS. `adv_supabase_dns_nxdomain.ts`, `run_e2e.ts`, `verify_accumulation.ts`, and `verify_monte_carlo.ts` completed successfully with 100% success rate across all 8 Tier 3 pairwise feature interaction test cases and 246 Jest unit tests.
- **Lint status**: Zero TypeScript errors.
- **Tests added/modified**: Enhanced E2E test runner robustness and retry loops.

## Loaded Skills
- **Source**: /google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md
- **Local copy**: /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_3_1_1_gen4/skill_software_engineering.md
- **Core methodology**: Software engineering best practices for modifying existing code, performing surgical edits, assessing side effects, and verifying correctness via builds and tests.
