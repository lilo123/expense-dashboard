# Task: M1.3 Pension Engine Forensic Integrity Audit

## Objective
Perform a strict forensic integrity audit on `src/lib/planner/pensionEngine.ts` and `__tests__/planner/pensionEngine.spec.ts` to ensure all implementations are genuine, robust, and completely free of integrity violations or reward hacking.

## Mandatory Audit Checklist & Forensics
1. **No Hardcoded Test Results**: Verify that `src/lib/planner/pensionEngine.ts` does not contain hardcoded test results, expected outputs, or verification matching strings designed to artificially pass unit tests.
2. **No Dummy/Facade Implementations**: Verify that `pensionEngine.ts` implements genuine statutory formulas for US Social Security Normal Retirement Age (NRA), early claiming penalties (`5/900`, `5/1200`), delayed retirement credits (`2/300`), Canadian CPP early/delayed adjustments (`0.006`, `0.007`), Canadian OAS delayed adjustments (`0.006`), Defined Benefit pensions, inflation compounding, and OAS clawback rules above $90,997.
3. **No Fabricated Outputs**: Verify that all test logs and compilation checks are authentic.
4. **No Circumvention**: Verify that the engine is a pure TypeScript business logic engine with zero side effects, no external database calls, and no store state hooks.
5. **Execute Verification Commands**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
   npx tsc --noEmit
   npm run test __tests__/planner
   git status
   ```
6. Verify 100% passing tests and zero commits pushed to remote git repositories.

## Handoff Report Requirements
Produce a structured handoff report (`handoff.md`) in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_auditor_pension_engine_1`) containing:
1. Detailed evidence chains for each check on the mandatory audit checklist.
2. Verified compilation and test logs.
3. An explicit, unambiguous audit verdict: `CLEAN` or `INTEGRITY VIOLATION`.
