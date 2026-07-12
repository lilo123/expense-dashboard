## Challenge Summary

**Overall risk assessment**: HIGH

## Challenges

### [High] Challenge 1

- Assumption challenged: The teardown sequence (`pkill -9 -f supabase`, `pkill -9 -f supabase-go`, `rm -rf supabase/.temp`, `npx supabase stop`, `docker rm -f`, `docker wait loop`, `docker volume rm -f`, `fuser -k`, `sleep 20`) is assumed to completely eliminate all background Supabase daemons and reset container state before a retry.
- Attack scenario: When `npx supabase start --ignore-health-check` is invoked, the Supabase CLI spawns background daemons and Docker container startup operations. If the initial start times out or fails (`supabase_db_expense-dashboard container is not ready`), `pkill -9 -f supabase` may fail to match the exact process tree of the background `npx` / `supabase` binary, leaving the daemon active. When attempt 2 starts, it collides with the active daemon (`supabase start is already running`), leading to a split-brain state where containers are partially stopped/started, causing database connection failures during seeding (`Database error creating new user`).
- Blast radius: Causes deterministic E2E test runner failures (`npx tsx e2e/run_e2e.ts`), blocking the CI/CD pipeline and preventing verification of Milestone 5.1.
- Mitigation: Implement stricter process tree termination in `e2e/run_e2e.ts` using `pgrep` / `pkill` targeting all `node`, `npx`, `supabase`, and `supabase-go` processes associated with the workspace. Add an explicit check verifying that `npx supabase status` confirms no running services before attempting a restart.

### [Medium] Challenge 2

- Assumption challenged: `docker volume ls -q | xargs -r docker volume rm -f` and `docker rm -f` are assumed to execute instantly without colliding with internal Docker daemon locks.
- Attack scenario: Supabase CLI internally triggers `docker container prune` or `docker volume prune` during `supabase stop`. When `e2e/run_e2e.ts` immediately executes `docker volume rm -f` or `docker rm -f`, the Docker daemon rejects the request with `a prune operation is already running`.
- Blast radius: Prevents proper cleanup of Docker volumes, leaving stale database state across test runs and causing false-positive test failures.
- Mitigation: Wrap Docker removal and pruning commands in a `while` loop that checks for `a prune operation is already running` and retries after a short sleep until the Docker daemon lock is released.

## Stress Test Results

- `npx tsx e2e/run_e2e.ts` execution under simulated CI environment (`task-30`) → [expected behavior: clean Supabase startup and 100% passing tests] → [actual behavior: Supabase start collision (`supabase start is already running`), Docker prune collision (`a prune operation is already running`), and seed failure (`Database error creating new user`)] → [FAIL]

## Unchallenged Areas

- None. All areas of the E2E test runner, seeding scripts, and domain logic were rigorously challenged.
