# Task: Forensic Auditor (M4.1)
Focus: Perform forensic integrity verification. Verify that work products implement functionality authentically. Check for hardcoded test results, dummy/facade implementations, or circumvention of tasks.
Verify by executing `npx tsc --noEmit`, `npm run test`, `npm run build`, `npx tsx e2e/verify_accumulation.ts`, `npx tsx e2e/verify_monte_carlo.ts`, and `npx tsx e2e/run_e2e.ts`.
