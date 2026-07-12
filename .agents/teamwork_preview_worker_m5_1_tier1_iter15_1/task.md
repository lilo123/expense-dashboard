# Task: Worker 1 M5.1 Tier 1 E2E Test Fix Implementation (Iteration 15)
Implement the exact fix strategy formulated by Explorer 1 in Iteration 15 to resolve Supabase startup failures, false-positive already running states, and fuser process suicides in `e2e/run_e2e.ts`.
1. Convert `setup()` to an `async` function and call `await setup();` in `run()`.
2. Remove manual `docker network create`, `docker network rm`, and `fuser -k 54321/tcp` from `setup()` & wrap every `execSync` in individual `try...catch` blocks.
3. Add robust HTTP reachability verification (`await fetch('http://127.0.0.1:54321')`) and clean teardown in `setup()` loop.
4. Remove `fuser -k 54321/tcp` and `docker network create/rm` from health check restart recovery blocks in `run()` & wrap every `execSync` in individual `try...catch` blocks.
5. Ensure all other requirements (RLS, Premium triggers, no `pkill -9 -f next`, no `try...catch` around `init_db`/Playwright) remain perfectly intact.
6. Verify TypeScript compilation (`npx tsc --noEmit`), unit tests (`npm run test __tests__/planner`), and full E2E test runner command (`npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`).
