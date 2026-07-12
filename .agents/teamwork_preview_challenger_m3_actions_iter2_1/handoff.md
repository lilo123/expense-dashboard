# Handoff Report — Milestone 3.2: Server Actions (BOLA & Premium Defenses)

## 1. Observation
- **File Paths Investigated**: 
  - `src/app/actions/retirementActions.ts`
  - `__tests__/planner/retirementActions.spec.ts`
  - `src/lib/planner/types.ts`
- **Tool Commands & Verbatim Results**: 
  - Ran `export PATH=/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin:$PATH; npm test __tests__/planner/retirementActions.spec.ts`.
  - Result: `PASS __tests__/planner/retirementActions.spec.ts` (11 passed, 11 total, Time: 0.953 s).
- **Direct Code Observations**:
  - `src/app/actions/retirementActions.ts:7-30`: `getUserAndTier` retrieves the authenticated user and checks `profile.tier`. If `tier !== 'premium'`, it throws `Premium tier required`.
  - `src/app/actions/retirementActions.ts:38-42`: `getPlans` explicitly filters queries with `.eq('user_id', user.id)`.
  - `src/app/actions/retirementActions.ts:73-78`: `getPlan` explicitly filters queries with `.eq('id', id).eq('user_id', user.id)`. No mock return facades (`if (id.length !== 36)`) exist.
  - `src/app/actions/retirementActions.ts:103-121`: `savePlan` validates `id` format and injects defaults for `simulationConfig`. No `delete dataObj.id` exists.
  - `src/app/actions/retirementActions.ts:124-131`: `savePlan` executes `HouseholdSchema.safeParse(planData)` and explicitly separates `user_id` from `planPayload` via `const { id, user_id, ...planPayload } = parsedPlan as any;`.
  - `src/app/actions/retirementActions.ts:134-137`: `savePlan` performs a secondary BOLA premium check on `planPayload.simulationConfig?.historicalRange || planPayload.historicalRange`.
  - `src/app/actions/retirementActions.ts:141-152` & `168-177`: UPDATE and INSERT operations explicitly set `user_id: user.id` in the payload, and UPDATE enforces `.eq('id', id).eq('user_id', user.id)`.

## 2. Logic Chain
1. **Authentication & Authorization Integrity**: Every server action (`getPlans`, `getPlan`, `savePlan`) invokes `getUserAndTier(supabase)` prior to any database operation. This guarantees that unauthenticated requests or non-premium requests are immediately rejected before touching any business logic.
2. **Eradication of Mock Facades & BOLA Bypasses**: A comprehensive inspection of `getPlan` and `savePlan` confirms that all historical mock return facades (e.g., `if (id.length !== 36)`) and BOLA bypass mechanisms (e.g., `delete dataObj.id`) have been fully removed from the codebase.
3. **Robust BOLA Defenses**: 
   - Read operations (`getPlans`, `getPlan`) bind the query to `user.id`.
   - Write operations (`savePlan`) strip any client-provided `user_id` during destructuring (`const { id, user_id, ...planPayload } = parsedPlan`) and force `user_id: user.id` in the database payload.
   - UPDATE queries explicitly enforce `.eq('id', id).eq('user_id', user.id)`, ensuring a user cannot update an arbitrary plan ID belonging to another user.
4. **Premium Feature Defenses**: `getUserAndTier` enforces premium tenancy at the session level. As a defense-in-depth measure, `savePlan` explicitly verifies that restricted simulation configurations (`all_125_years`, `most_recent_50_years`) are not processed if `tier !== 'premium'`.
5. **Validation & Error Handling Rigor**: `HouseholdSchema.safeParse` strictly enforces structural integrity. Catch blocks in all actions prevent stack trace leakage and return standardized `{ success: false, error: ... }` responses.

## 3. Caveats
- **Next.js Cache Revalidation**: `revalidatePath` calls are wrapped in `try...catch` blocks to prevent build-time/static generation errors from failing unit tests or static builds. We assume Next.js cache routes (`/planner`, `/planner/[id]`) match the actual frontend routing structure.
- **Supabase RLS Policies**: The review focuses on Server Actions (application-layer defenses). It is assumed that Supabase Row Level Security (RLS) policies are also configured on the `retirement_plans` table as a database-layer defense.

## 4. Conclusion & Challenge Report

```markdown
## Challenge Summary

**Overall risk assessment**: LOW

## Challenges

### [Low] Challenge 1: Nested Account-Level Premium Parameter Validation
- **Assumption challenged**: The defense-in-depth premium parameter check in `savePlan` inspects `planPayload.simulationConfig?.historicalRange` and `planPayload.historicalRange`, assuming these are the only locations where `historicalRange` can be specified.
- **Attack scenario**: An attacker modifies the payload to include `historicalRange: 'all_125_years'` inside an individual account object within `planPayload.accounts`.
- **Blast radius**: If `getUserAndTier` is ever modified in the future to allow non-premium users access to basic planning, a non-premium user might store premium historical range parameters at the account level.
- **Mitigation**: Currently fully mitigated because `getUserAndTier` strictly requires `tier === 'premium'` for all access. If free tier access is introduced later, `savePlan` should iterate over `planPayload.accounts` to verify `historicalRange` on each account object.

### [Low] Challenge 2: Non-Object Payload Property Access in Pre-Validation Guard
- **Assumption challenged**: `savePlan` checks `if (dataObj.simulationConfig)` and attempts property assignment `dataObj.simulationConfig.numPaths = 1000`, assuming `simulationConfig` is an object if truthy.
- **Attack scenario**: An attacker passes `simulationConfig: true` (a boolean). In strict mode, attempting property assignment on a boolean throws a TypeError.
- **Blast radius**: The execution jumps directly to the `catch` block without reaching Zod validation.
- **Mitigation**: Currently fully mitigated because the outer `try...catch` block traps the TypeError and returns a clean, secure error message (`Uh oh, the system tripped up!...`) without crashing the server.

## Stress Test Results

- `npm test __tests__/planner/retirementActions.spec.ts` → `All 11 tests pass cleanly` → `11 passed / 11 total` → `PASS`
- `Verify absence of if (id.length !== 36)` → `No mock return facades found` → `Confirmed eradicated` → `PASS`
- `Verify absence of delete dataObj.id` → `No BOLA bypasses found` → `Confirmed eradicated` → `PASS`
- `Verify Zod safeParse integration` → `HouseholdSchema.safeParse validates all inputs` → `Handled correctly` → `PASS`
- `Verify BOLA eq('user_id', user.id)` → `Enforced on all select/update queries` → `Handled correctly` → `PASS`

## Unchallenged Areas

- **Database RLS Policies** — out of scope for server action verification.
```

## 5. Verification Method
- **Unit Test Execution**: Run the following command from the project root to verify all server actions, BOLA defenses, and Premium checks:
  ```bash
  export PATH=/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin:$PATH; npm test __tests__/planner/retirementActions.spec.ts
  ```
- **Manual Code Inspection**: Inspect `src/app/actions/retirementActions.ts` to verify that `getUserAndTier` is called at the start of `getPlans`, `getPlan`, and `savePlan`, and that `if (id.length !== 36)` and `delete dataObj.id` remain absent.
