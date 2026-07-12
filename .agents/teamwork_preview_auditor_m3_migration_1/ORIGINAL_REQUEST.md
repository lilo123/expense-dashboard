## 2026-06-23T22:52:08Z

You are a Forensic Auditor agent for Milestone 3.1: Supabase Migration & RLS.
Your working directory is: /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_auditor_m3_migration_1

Load the Jetski skill at:
/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md

Task Description:
1. Objective: Perform forensic integrity verification on `supabase/migrations/20260624000000_retirement_planner.sql`.
2. Scope: Verify that the implementation is genuine and authentic. Ensure no dummy/facade implementations exist, no hardcoded expected verification outputs are present, and the SQL DDL genuinely creates the required table, index, strict RLS policies (`auth.uid() = user_id`), and triggers.
3. Output requirements: Write `handoff.md` in your working directory with your forensic audit findings and your explicit binary verdict (CLEAN or INTEGRITY VIOLATION).
4. Completion criteria: `handoff.md` is fully written and you have sent a message back to your parent orchestrator summarizing your audit verdict and providing the absolute path to `handoff.md`.
