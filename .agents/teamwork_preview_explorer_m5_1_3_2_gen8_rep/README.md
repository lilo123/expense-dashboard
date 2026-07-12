# Explorer 2 gen8 rep Working Directory

Task: Investigate `e2e/run_e2e.ts` lines 284 and 290 (now lines 366, 373, 434, and 440) and recommend a concrete fix strategy to include `DB_HOST: '127.0.0.1'` and `SUPABASE_DOCKER_EXTRA_HOSTS: 'supabase_db_expense-dashboard:172.17.0.1,supabase_db_expense-dashboard:172.18.0.1,supabase_db_expense-dashboard:127.0.0.1'` in the `execSync` environment object (matching `e2e/adv_supabase_dns_nxdomain.ts`), and perform genuine independent verification in a clean environment.
