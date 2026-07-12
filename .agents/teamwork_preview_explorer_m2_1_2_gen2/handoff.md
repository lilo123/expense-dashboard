# Handoff Report: M2.1 Historical Market Data Adversarial Test Investigation & Fix Strategy

## 1. Observation
We investigated the adversarial test failures reported in `__tests__/planner/adv_historicalMarketData.spec.ts` concerning `src/content/historicalMarketData.ts`.

### Direct Code Inspection
In `src/content/historicalMarketData.ts`, lines 73–83 define `getYearMarketData`:
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

### Test Suite Inspection
In `__tests__/planner/adv_historicalMarketData.spec.ts`, lines 59–78 define two adversarial tests:
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

### Test Execution & Verbatim Errors
We executed the adversarial test suite via:
```bash
export PATH=/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin:$PATH; ./node_modules/.bin/jest __tests__/planner/adv_historicalMarketData.spec.ts
```
Which produced the following verbatim failure output:
```
FAIL __tests__/planner/adv_historicalMarketData.spec.ts
  Adversarial Coverage Audit: Historical Market Data (M2.1)
    Gap 1: Full Historical Anomalies Verification
      ✓ adv_test 1.1: Verify exact empirical values for 1974, 2008, and 2022 anomalies (6 ms)
    Gap 2: Comprehensive Buffer Ownership & Value Alignment Verification
      ✓ adv_test 2.1: Verify getMarketDataSlice buffer sharing and boundary values for 50 and 125 years (5 ms)
      ✓ adv_test 2.2: Verify getMarketDataCopy buffer independence and boundary values for 50 and 125 years (1 ms)
    Gap 3: Runtime Invalid Range Handling
      ✓ adv_test 3.1: Calling slice/copy helpers with invalid range throws TypeError at runtime (12 ms)
    Gap 4: Adversarial Input Robustness in getYearMarketData
      ✕ adv_test 4.1: Calling getYearMarketData with NaN should gracefully return null (2 ms)
      ✕ adv_test 4.2: Calling getYearMarketData with non-integer year (e.g. 1950.5) should return null or handle gracefully (3 ms)

  ● Adversarial Coverage Audit: Historical Market Data (M2.1) › Gap 4: Adversarial Input Robustness in getYearMarketData › adv_test 4.1: Calling getYearMarketData with NaN should gracefully return null

    expect(received).toBeNull()

    Received: {"bonds": undefined, "inflation": undefined, "stocks": undefined}

      59 |   describe('Gap 4: Adversarial Input Robustness in getYearMarketData', () => {
      60 |     it('adv_test 4.1: Calling getYearMarketData with NaN should gracefully return null', () => {
    > 61 |       expect(getYearMarketData(NaN)).toBeNull();
         |                                      ^
      62 |     });
      63 |
      64 |     it('adv_test 4.2: Calling getYearMarketData with non-integer year (e.g. 1950.5) should return null or handle gracefully', () => {

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
      70 |         expect(typeof result.bonds).toBe('number');
      71 |         expect(Number.isFinite(result.bonds)).toBe(true);

      at Object.toBe (__tests__/planner/adv_historicalMarketData.spec.ts:68:38)
```

---

## 2. Logic Chain

1. **Failure Mechanism for `NaN` (adv_test 4.1)**:
   - When `year` is `NaN`, the comparison `year < 1901` evaluates to `false`, and `year > 2025` evaluates to `false` (per IEEE 754 floating-point comparison rules).
   - Consequently, `if (year < 1901 || year > 2025)` evaluates to `false`, allowing `NaN` to bypass the boundary check entirely.
   - The subsequent index calculation `(NaN - 1901) * 3` results in `NaN`.
   - Accessing `historicalMarketData[NaN]` on a `Float64Array` returns `undefined`.
   - The function returns `{ stocks: undefined, bonds: undefined, inflation: undefined }` instead of `null`, causing the `expect(...).toBeNull()` assertion to fail.

2. **Failure Mechanism for Non-Integer Floating-Point Years (adv_test 4.2)**:
   - When `year` is `1950.5`, the comparison `1950.5 < 1901 || 1950.5 > 2025` evaluates to `false`.
   - The index calculation `(1950.5 - 1901) * 3` results in `148.5`.
   - Because `148.5` is a fractional index, `historicalMarketData[148.5]` returns `undefined`.
   - The function returns an object with `undefined` properties. The test checks `if (result !== null)` and asserts `expect(typeof result.stocks).toBe('number')`. Since `typeof undefined` is `'undefined'`, the test fails.

3. **Recommended Fix Strategy**:
   - Adding an explicit integer validation check using `!Number.isInteger(year)` at the start of `getYearMarketData` addresses both issues simultaneously.
   - `Number.isInteger(NaN)` evaluates to `false`, so `!Number.isInteger(NaN)` is `true`, immediately returning `null`.
   - `Number.isInteger(1950.5)` evaluates to `false`, so `!Number.isInteger(1950.5)` is `true`, immediately returning `null`.
   - For valid integer years (e.g., `1950`), `Number.isInteger(1950)` is `true`, allowing the function to proceed normally to the range check and index lookup.

---

## 3. Caveats
- **No caveats.** The root cause is fully understood, verified via runtime execution, and directly addressed by standard ECMAScript built-in methods (`Number.isInteger`). No other functions in `src/content/historicalMarketData.ts` accept a `year` parameter or suffer from this vulnerability.

---

## 4. Conclusion
The adversarial test failures in `__tests__/planner/adv_historicalMarketData.spec.ts` stem from a lack of integer validation in `getYearMarketData`, allowing `NaN` and floating-point values to perform invalid property lookups on the underlying `Float64Array`. 

We recommend updating `getYearMarketData` in `src/content/historicalMarketData.ts` (line 74) to include `!Number.isInteger(year)` in the initial guard condition.

### Proposed Code Modification (`src/content/historicalMarketData.ts`)
```typescript
// before
export function getYearMarketData(year: number): { stocks: number; bonds: number; inflation: number } | null {
  if (year < 1901 || year > 2025) {
    return null;
  }
  const index = (year - 1901) * 3;

// after
export function getYearMarketData(year: number): { stocks: number; bonds: number; inflation: number } | null {
  if (!Number.isInteger(year) || year < 1901 || year > 2025) {
    return null;
  }
  const index = (year - 1901) * 3;
```

---

## 5. Verification Method

### Execution Command
To independently verify the fix once implemented, execute the following command from the project root (`/usr/local/google/home/duynguyenn/expense-dashboard`):
```bash
export PATH=/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin:$PATH; ./node_modules/.bin/jest __tests__/planner/adv_historicalMarketData.spec.ts
```

### Expected Outcome
- All 6 tests in `__tests__/planner/adv_historicalMarketData.spec.ts` must pass successfully (100% passing rate).
- Specifically, `adv_test 4.1` and `adv_test 4.2` should transition from `FAIL` to `PASS`.

### Invalidation Conditions
- If any test in `__tests__/planner/adv_historicalMarketData.spec.ts` fails, or if valid integer years (e.g., `1974`, `2008`, `2022`) fail to return their correct empirical data, the verification has failed and the implementation must be re-audited.
