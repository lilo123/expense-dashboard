# M2.1 Historical Market Data Adversarial Investigation Report

**Core Findings Summary**: The adversarial test suite fails in `getYearMarketData` because passing `NaN` or non-integer floating-point years (e.g., `1950.5`) bypasses the `year < 1901 || year > 2025` range check, resulting in invalid array index calculations on `historicalMarketData` (`Float64Array`). Consequently, the function returns objects containing `undefined` values instead of gracefully returning `null`, violating the expected `{ stocks: number; bonds: number; inflation: number } | null` type contract.

---

## 1. Observation

### Exact File Paths & Target Code
- **Target File**: `src/content/historicalMarketData.ts`
- **Lines 73–83**:
  ```typescript
  export function getYearMarketData(year: number): { stocks: number; bonds: number; inflation: number } | null {
    if (year < 1901 || year > 2025) {
      return null;
    }
    const index = (year - 1901) * 3;
    return {
      stocks: historicalMarketData[index],
      bonds: historicalMarketData[index + 1],
      inflation: historicalMarketData[index + 2],
    };
  }
  ```

- **Adversarial Test File**: `__tests__/planner/adv_historicalMarketData.spec.ts`
- **Lines 59–78**:
  ```typescript
  describe('Gap 4: Adversarial Input Robustness in getYearMarketData', () => {
    it('adv_test 4.1: Calling getYearMarketData with NaN should gracefully return null', () => {
      expect(getYearMarketData(NaN)).toBeNull();
    });

    it('adv_test 4.2: Calling getYearMarketData with non-integer year (e.g. 1950.5) should return null or handle gracefully', () => {
      const result = getYearMarketData(1950.5);
      // If it doesn't return null, it should at least return valid numbers, not undefined
      if (result !== null) {
        expect(typeof result.stocks).toBe('number');
        expect(Number.isFinite(result.stocks)).toBe(true);
        expect(typeof result.bonds).toBe('number');
        expect(Number.isFinite(result.bonds)).toBe(true);
        expect(typeof result.inflation).toBe('number');
        expect(Number.isFinite(result.inflation)).toBe(true);
      } else {
        expect(result).toBeNull();
      }
    });
  });
  ```

### Tool Commands and Verbatim Errors
We executed the Jest test suite via the following terminal command:
```bash
export PATH=/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin:$PATH; npx jest __tests__/planner/adv_historicalMarketData.spec.ts
```

**Verbatim Test Failure Output**:
```
FAIL __tests__/planner/adv_historicalMarketData.spec.ts
  Adversarial Coverage Audit: Historical Market Data (M2.1)
    Gap 4: Adversarial Input Robustness in getYearMarketData
      ✕ adv_test 4.1: Calling getYearMarketData with NaN should gracefully return null (1 ms)
      ✕ adv_test 4.2: Calling getYearMarketData with non-integer year (e.g. 1950.5) should return null or handle gracefully (3 ms)

  ● Adversarial Coverage Audit: Historical Market Data (M2.1) › Gap 4: Adversarial Input Robustness in getYearMarketData › adv_test 4.1: Calling getYearMarketData with NaN should gracefully return null

    expect(received).toBeNull()

    Received: {"bonds": undefined, "inflation": undefined, "stocks": undefined}

      59 |   describe('Gap 4: Adversarial Input Robustness in getYearMarketData', () => {
      60 |     it('adv_test 4.1: Calling getYearMarketData with NaN should gracefully return null', () => {
    > 61 |       expect(getYearMarketData(NaN)).toBeNull();
         |                                      ^
      62 |     });

      at Object.toBeNull (__tests__/planner/adv_historicalMarketData.spec.ts:61:38)

  ● Adversarial Coverage Audit: Historical Market Data (M2.1) › Gap 4: Adversarial Input Robustness in getYearMarketData › adv_test 4.2: Calling getYearMarketData with non-integer year (e.g. 1950.5) should return null or handle gracefully

    expect(received).toBe(expected) // Object.is equality

    Expected: "number"
    Received: "undefined"

      66 |       // If it doesn't return null, it should at least return valid numbers, not undefined
      67 |       if (result !== null) {
    > 68 |         expect(typeof result.stocks).toBe('number');
         |                                      ^
      69 |         expect(Number.isFinite(result.stocks)).toBe(true);

      at Object.toBe (__tests__/planner/adv_historicalMarketData.spec.ts:68:38)
```

---

## 2. Logic Chain

1. **Boundary Check Bypass on NaN**: 
   - In `getYearMarketData`, the boundary check evaluates `if (year < 1901 || year > 2025)`.
   - When `year` is `NaN`, per IEEE 754 floating-point comparison rules, `NaN < 1901` is `false` and `NaN > 2025` is `false`.
   - Thus, `NaN < 1901 || NaN > 2025` evaluates to `false`, allowing execution to proceed past the guard condition.
2. **Float64Array Indexing with NaN**:
   - The index calculation `const index = (NaN - 1901) * 3` evaluates to `NaN`.
   - `historicalMarketData` is a `Float64Array`. Accessing `Float64Array[NaN]` returns `undefined`.
   - The function returns `{ stocks: undefined, bonds: undefined, inflation: undefined }`, violating both the explicit TypeScript return type and `adv_test 4.1`'s expectation of `null`.
3. **Boundary Check Bypass and Float64Array Indexing on Floating-Point Years**:
   - When `year` is `1950.5`, `1950.5 < 1901 || 1950.5 > 2025` evaluates to `false`.
   - The index calculation `const index = (1950.5 - 1901) * 3` evaluates to `148.5`.
   - Accessing `Float64Array[148.5]` returns `undefined` because `148.5` is not an integer array index.
   - The function returns `{ stocks: undefined, bonds: undefined, inflation: undefined }`.
   - In `adv_test 4.2`, because the return value is not `null`, the test checks `expect(typeof result.stocks).toBe('number')`. Since `typeof undefined` is `'undefined'`, the test fails.
4. **Resolution via Integer Validation**:
   - Adding `!Number.isInteger(year)` to the guard condition guarantees that any input that is `NaN`, `Infinity`, `-Infinity`, or a non-integer floating-point number will cause the condition to evaluate to `true`, immediately returning `null`.

---

## 3. Caveats

- **Scope Limitation**: This investigation is strictly read-only as per Explorer archetype constraints. No direct code modifications were made to `src/content/historicalMarketData.ts`.
- **Handling of Non-Integer Years**: The proposed solution treats any fractional year (e.g., `1950.5`) as an invalid lookup, returning `null`. This perfectly aligns with `adv_test 4.2`'s requirement (`should return null or handle gracefully`) and avoids the complexity of introducing interpolation between historical years, which was not requested by the user or the test specification.

---

## 4. Conclusion

### Final Assessment & Actionable Recommendation
To resolve the vulnerability and ensure full compliance with the adversarial test suite, the implementation agent must update the guard condition in `getYearMarketData` within `src/content/historicalMarketData.ts` to include `!Number.isInteger(year)`.

### Summary of Proposed Changes
| Target File | Lines | Change Description |
| :--- | :--- | :--- |
| `src/content/historicalMarketData.ts` | 73–83 | Prepend `!Number.isInteger(year)` to the existing range check `if (year < 1901 || year > 2025)` |

### Before → After Code Snippet

**Before (`src/content/historicalMarketData.ts`, lines 73–83)**:
```typescript
export function getYearMarketData(year: number): { stocks: number; bonds: number; inflation: number } | null {
  if (year < 1901 || year > 2025) {
    return null;
  }
  const index = (year - 1901) * 3;
  return {
    stocks: historicalMarketData[index],
    bonds: historicalMarketData[index + 1],
    inflation: historicalMarketData[index + 2],
  };
}
```

**After (`src/content/historicalMarketData.ts`, lines 73–83)**:
```typescript
export function getYearMarketData(year: number): { stocks: number; bonds: number; inflation: number } | null {
  if (!Number.isInteger(year) || year < 1901 || year > 2025) {
    return null;
  }
  const index = (year - 1901) * 3;
  return {
    stocks: historicalMarketData[index],
    bonds: historicalMarketData[index + 1],
    inflation: historicalMarketData[index + 2],
  };
}
```

---

## 5. Verification Method

### Execution Commands
Once the implementer applies the recommended code change, verify the fix independently using the following command from the project root directory:

```bash
export PATH=/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin:$PATH; npx jest __tests__/planner/adv_historicalMarketData.spec.ts
```

### Expected Verification Outcome
- The command must return `PASS __tests__/planner/adv_historicalMarketData.spec.ts`.
- Specifically, `adv_test 4.1` and `adv_test 4.2` must execute successfully without errors.

### Invalidation Conditions
- If `adv_test 4.1` or `adv_test 4.2` continue to fail, verify that the `!Number.isInteger(year)` check was correctly placed before the array indexing logic.
- Verify that no regressions are introduced into `adv_test 1.1`, `adv_test 2.1`, `adv_test 2.2`, or `adv_test 3.1`.
