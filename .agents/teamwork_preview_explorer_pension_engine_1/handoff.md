# Handoff Report: M1.3 Pension Engine Exploration

## Observation

1. **Task Objective & Scope (`task.md`)**:
   - Verified the goal to explore requirements and design for `src/lib/planner/pensionEngine.ts` and its unit tests `__tests__/planner/pensionEngine.spec.ts`.
   - Identified the requirement to implement pure TypeScript business logic for US Social Security (early claim penalties / delayed retirement credits), Canadian CPP (early/delayed adjustments), Canadian OAS (delayed adjustments, clawback logic), and Defined Benefit pensions.

2. **Domain Type Definitions (`src/lib/planner/types.ts`)**:
   - `PensionSchema` (lines 56–72) defines:
     ```typescript
     export const PensionSchema = z.object({
       id: z.string().min(1, "Pension ID is required"),
       owner: z.enum(['primary', 'spouse']),
       type: z.enum(['social_security', 'cpp', 'oas', 'defined_benefit']),
       baseAmount: z.number().nonnegative("Base amount must be non-negative"),
       startAge: z.number().min(50).max(80, "Start age must be between 50 and 80"),
       inflationAdjusted: z.boolean(),
     }).refine(data => {
       if (data.type === 'social_security') {
         return data.startAge >= 62;
       }
       return true;
     }, {
       message: "Social Security startAge cannot be less than 62",
       path: ['startAge'],
     });
     export type Pension = z.infer<typeof PensionSchema>;
     ```
   - `HouseholdSchema` (lines 110–140) defines `taxJurisdiction: z.enum(['US', 'CA'])`, `birthYear`, `retirementAge`, `spouseBirthYear`, `spouseRetirementAge`, `includeSpouse`, and `pensions: z.array(PensionSchema).optional()`.

3. **Existing Engine Patterns & OAS Clawback Base (`src/lib/planner/taxEngine.ts`)**:
   - Observed pure functional design using exported interfaces (`TaxInput`, `TaxOutput`) and pure functions (`calculateUsTaxes`, `calculateCaTaxes`, `calculateTaxes`).
   - Observed Canadian OAS clawback baseline threshold in `calculateCaTaxes` (lines 309–310):
     ```typescript
     const oasClawback = Math.min(input.socialSecurityOasIncome, Math.max(0, (netIncome - 90997) * 0.15));
     const taxableSocialSecurityOas = Math.max(0, input.socialSecurityOasIncome - oasClawback);
     ```

4. **Interface Contracts & Project Structure (`.agents/orchestrator/PROJECT.md`, `.agents/sub_orch_m1_core_domain_1/SCOPE.md`)**:
   - Engines must be pure functions with zero side effects, importing Zod schemas and inferred TypeScript types from `types.ts`.
   - Milestone 1 requires 100% passing unit test coverage (`npm run test __tests__/planner`).

---

## Logic Chain

1. **Statutory Rules & Mathematical Formulas Formulation**:
   - **US Social Security**:
     - *Normal Retirement Age (NRA)*:
       - Birth year <= 1937: 65.0
       - 1938: 65 + 2/12
       - 1939: 65 + 4/12
       - 1940: 65 + 6/12
       - 1941: 65 + 8/12
       - 1942: 65 + 10/12
       - 1943–1954: 66.0
       - 1955: 66 + 2/12
       - 1956: 66 + 4/12
       - 1957: 66 + 6/12
       - 1958: 66 + 8/12
       - 1959: 66 + 10/12
       - Birth year >= 1960: 67.0
     - *Claim-Age Adjustments*:
       - Months difference `M = Math.round((startAge - NRA) * 12)`.
       - If `M < 0` (Early Claiming, clamped to minimum startAge 62):
         - First 36 months before NRA: reduction of `(5 / 9) * 0.01` per month.
         - Months beyond 36 before NRA: reduction of `(5 / 12) * 0.01` per month.
       - If `M > 0` (Delayed Claiming, clamped to maximum startAge 70):
         - Increase of `(2 / 3) * 0.01` per month up to age 70.
   - **Canadian CPP**:
     - Standard start age is 65. Minimum start age is 60. Maximum delayed age is 70.
     - Months difference `M = Math.round((startAge - 65) * 12)`.
     - If `M < 0`: reduction of `0.006` (0.6%) per month down to age 60 (max reduction 36%).
     - If `M > 0`: increase of `0.007` (0.7%) per month up to age 70 (max increase 42%).
   - **Canadian OAS**:
     - Standard start age is 65. Minimum start age is 65 (cannot claim earlier). Maximum delayed age is 70.
     - Months difference `M = Math.round((startAge - 65) * 12)`.
     - If `M < 0`: multiplier is 1.0 (but cashflow is 0 before age 65).
     - If `M > 0`: increase of `0.006` (0.6%) per month up to age 70 (max increase 36%).
     - *OAS Clawback*: Threshold `$90,997`, clawback rate `15%` (`0.15`). `clawback = Math.min(oasIncome, Math.max(0, (netIncome - 90997) * 0.15))`.
   - **Defined Benefit (DB)**:
     - Multiplier is 1.0 starting at `startAge`.
     - If `inflationAdjusted: true`, annual amount is `baseAmount * Math.pow(1 + inflationRate, yearsElapsed)`. If `false`, remains `baseAmount`.

2. **Pure Functional Architecture Design (`src/lib/planner/pensionEngine.ts`)**:
   - To match `taxEngine.ts` and ensure clean decoupling, `pensionEngine.ts` will export:
     - `calculateSocialSecurityNra(birthYear: number): number`
     - `calculateSocialSecurityMultiplier(startAge: number, birthYear: number): number`
     - `calculateCppMultiplier(startAge: number): number`
     - `calculateOasMultiplier(startAge: number): number`
     - `calculateOasClawback(oasIncome: number, netIncome: number): { oasReceived: number; clawbackAmount: number; netOas: number }`
     - `calculatePensionIncome(pension: Pension, currentAge: number, birthYear: number, inflationRate: number, yearsElapsed: number): number`
     - `calculateHouseholdPensions(household: Household, currentYear: number, baseYear: number, inflationRate: number, netIncomeForOas?: number): { totalPensionIncome: number; primaryIncome: number; spouseIncome: number; oasClawback: number; breakdown: { id: string; type: string; amount: number; owner: 'primary' | 'spouse' }[] }`

3. **Unit Test Strategy Design (`__tests__/planner/pensionEngine.spec.ts`)**:
   - **Suite 1: Social Security NRA**: Verify exact values for 1935 (65), 1940 (65.5), 1950 (66), 1956 (66.333...), and 1965 (67).
   - **Suite 2: Social Security Multipliers**: Verify age 62 claim at NRA 67 (0.70), age 62 claim at NRA 66 (0.75), exact NRA claim (1.0), age 70 claim at NRA 67 (1.24), age 70 claim at NRA 66 (1.32), and clamping above age 70.
   - **Suite 3: CPP Multipliers**: Verify age 60 claim (0.64), age 62 claim (0.784), age 65 claim (1.0), age 70 claim (1.42), and clamping below 60 / above 70.
   - **Suite 4: OAS Multipliers & Clawback**: Verify age 65 claim (1.0), age 70 claim (1.36), clawback below threshold $90,997 (0), partial clawback at $110,000 net income, and full clawback wipeout at $250,000 net income.
   - **Suite 5: Defined Benefit & Inflation**: Verify flat DB pension (`inflationAdjusted: false`) vs compounding inflation (`inflationAdjusted: true`).
   - **Suite 6: Household Pension Aggregation**: Verify multi-pension household (Primary SS + Spouse Pension), checking correct activation ages (`currentAge < startAge` yields 0), total aggregation, and spousal breakdown.

---

## Caveats

1. **Statutory Threshold Indexing**: The OAS clawback threshold is modeled at the static baseline of `$90,997` (matching `taxEngine.ts`). In real-world tax systems, this threshold adjusts annually for inflation. For the scope of this simulation engine, adhering to the static baseline ensures parity with `taxEngine.ts`.
2. **Monthly vs. Annual Compounding**: Start ages are provided as floating-point numbers in years (e.g. 62.5). The engine converts these to months via `Math.round((startAge - normalAge) * 12)` to apply statutory monthly rules accurately.
3. **Net Income Dependency for OAS Clawback**: `calculateHouseholdPensions` accepts an optional `netIncomeForOas` parameter. In a full simulation loop (e.g. `simulator.ts`), net income depends on taxable withdrawals and other income, which requires coordination between `drawdownEngine.ts`, `taxEngine.ts`, and `pensionEngine.ts`.

---

## Conclusion

The exploration of `pensionEngine.ts` requirements is complete. The statutory rules for US Social Security, Canadian CPP, Canadian OAS, and Defined Benefit pensions have been rigorously mathematically defined. The proposed pure functional architecture aligns perfectly with `taxEngine.ts` and `types.ts`, and the 6-part test strategy guarantees comprehensive coverage and robust verification for Milestone 1.3.

---

## Verification Method

To independently verify the implementation once the implementer completes `pensionEngine.ts` and `pensionEngine.spec.ts`:

1. **TypeScript Compilation & Type Checking**:
   ```bash
   npx tsc --noEmit
   ```
   *Success criteria*: Zero compilation errors or type mismatches.

2. **Unit Test Execution**:
   ```bash
   npm run test __tests__/planner/pensionEngine.spec.ts
   ```
   *Success criteria*: 100% passing tests across all 6 test suites with clean execution logs.

3. **Full Planner Suite Verification**:
   ```bash
   npm run test __tests__/planner
   ```
   *Success criteria*: All existing and new planner tests (`types.spec.ts`, `taxEngine.spec.ts`, `pensionEngine.spec.ts`) pass successfully.
