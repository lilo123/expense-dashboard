# Handoff Report: Explorer 1 - M2.1 Global Market Data Ingestion (CSV Parsing Focus)

## Summary of Core Findings
Analysis of `/usr/local/google/home/duynguyenn/Downloads/chart.csv` reveals it contains monthly MSCI World equity index values from `12/1969` to `05/2026`, but lacks CPI, CAPE, bond growth, and dividend yield metrics. To satisfy `MarketDataPoint` contracts without runtime filesystem access or circular module dependencies, `src/lib/globalMarketData.ts` should statically embed December index values and export a generator function `createGlobalMarketData(shillerData)` that computes annual returns and merges them with US Shiller data (acting as a proxy for inflation and bond baselines).

---

## 1. Observation

- **`chart.csv` Structure & Contents**: Observed via `view_file` on `/usr/local/google/home/duynguyenn/Downloads/chart.csv` (679 lines).
  - Header (line 1): `Date,MSCI World`
  - First data row (line 2): `12/1969,10000`
  - Monthly data rows follow in `MM/YYYY,Value` format.
  - Final full year row (line 674): `12/2025,1420575.2`
  - Last row (line 679): `05/2026,1569546.5`
  - The file contains only date and equity index values; no CPI, CAPE, dividend yield, or bond growth data exist in the CSV.
- **`src/types/simulation.ts`**: Observed via `view_file` (lines 125-134).
  - `MarketDataPoint` interface definition requires:
    ```typescript
    export interface MarketDataPoint {
      year: number;
      month: number;
      startCpi: number;
      endCpi: number;
      cape: number;
      dividendYields: number;
      stockMarketGrowth: number;
      bondsGrowth: number;
    }
    ```
- **`src/lib/marketData.ts`**: Observed via `view_file` (96 lines).
  - Exports `shillerMarketData: Record<number, MarketDataPoint>` covering years 1871 to 2025.
  - Implements `getMarketDataForYear(year: number): MarketDataPoint` and `getValidStartYears(duration: number): number[]`.
  - Does not currently implement `getAllMarketData`.
- **`SCOPE.md`**: Observed via `view_file` on `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m2_1/SCOPE.md`.
  - Requires creating `src/lib/globalMarketData.ts` with MSCI World data from `chart.csv`.
  - Requires updating `src/lib/marketData.ts` with contracts:
    - `getMarketDataForYear(year: number, mode?: 'us' | 'global'): MarketDataPoint`
    - `getValidStartYears(duration: number, mode?: 'us' | 'global'): number[]`
    - `getAllMarketData(mode?: 'us' | 'global'): Record<number, MarketDataPoint>`
  - Verification requirements: `npx tsc --noEmit`, `npm run test`, `npm run build`.

---

## 2. Logic Chain

1. **Static Data Embedding vs. Runtime File Reading**:
   - *Observation*: `chart.csv` is located in `/usr/local/google/home/duynguyenn/Downloads/chart.csv`, which is outside the project root and inaccessible at runtime in browser/Web Worker environments (`simulation.worker.ts`).
   - *Inference*: `src/lib/globalMarketData.ts` cannot use `fs.readFileSync` or CSV parsing libraries at runtime. The parsed data must be statically embedded within `src/lib/globalMarketData.ts`.
2. **Annual Return Calculation (`stockMarketGrowth`)**:
   - *Observation*: `chart.csv` provides monthly index values (`MSCI World`) from `12/1969` to `05/2026`. `MarketDataPoint` requires annual `stockMarketGrowth`.
   - *Inference*: To compute annual returns for each year $Y$ (from 1970 to 2025), we need the index value at `12/(Y-1)` and `12/Y`. The formula is:
     $$\text{stockMarketGrowth}_Y = \frac{\text{Value}_{12/Y} - \text{Value}_{12/(Y-1)}}{\text{Value}_{12/(Y-1)}}$$
     For 2026, we can compute YTD growth using `05/2026` and `12/2025`.
   - *Design Choice*: We can embed a lightweight dictionary of December values (`1969: 10000`, `1970: 9691.5`, ..., `2025: 1420575.2`, `2026: 1569546.5`) in `src/lib/globalMarketData.ts` and iterate from 1970 to 2026 to generate the full `MarketDataPoint` records. This keeps the file highly readable, compact (~58 lines of data), and easy to maintain.
3. **Handling Missing Metrics (CPI, CAPE, Dividends, Bonds)**:
   - *Observation*: `chart.csv` lacks `startCpi`, `endCpi`, `cape`, `dividendYields`, and `bondsGrowth`. `MarketDataPoint` requires these fields. `src/lib/marketData.ts` exports `shillerMarketData` which contains these exact fields for 1871–2025.
   - *Inference*: For global market simulation, US inflation (`startCpi`, `endCpi`) and US bond growth (`bondsGrowth`) serve as the standard proxy for developed world baseline economic indicators in retirement calculators. Therefore, `globalMarketData.ts` should merge the MSCI World `stockMarketGrowth` into the existing Shiller data point for each year. For 2026, where Shiller data ends at 2025, it can fallback to the 2025 Shiller baseline values.
4. **Updating `src/lib/marketData.ts` to Meet Interface Contracts**:
   - *Observation*: `SCOPE.md` defines three specific function signatures accepting `mode?: 'us' | 'global'`.
   - *Inference*: `marketData.ts` must import `createGlobalMarketData` from `./globalMarketData` and instantiate `export const globalMarketData = createGlobalMarketData(shillerMarketData);`.
   - *Inference*: `getMarketDataForYear` must check `mode === 'global'` and return `globalMarketData[year]`, falling back to `shillerMarketData[year]` or a default object if out of bounds.
   - *Inference*: `getValidStartYears` must set the base start year to `1970` if `mode === 'global'` (since MSCI World data starts in 1970) and `1871` if `mode === 'us'`.
   - *Inference*: `getAllMarketData` must be implemented to return `mode === 'global' ? globalMarketData : shillerMarketData`.

---

## 3. Caveats

- **Circular Dependency Consideration**: If `globalMarketData.ts` imports `shillerMarketData` from `marketData.ts`, and `marketData.ts` imports `globalMarketData` from `globalMarketData.ts`, this creates a circular dependency between the two TypeScript modules.
  - *Mitigation*: To cleanly avoid circular dependencies, `globalMarketData.ts` will not import `marketData.ts`. Instead, it will export the raw December values object `msciWorldDecemberValues: Record<number, number>` and a generator function `createGlobalMarketData(shillerData: Record<number, MarketDataPoint>): Record<number, MarketDataPoint>`. `marketData.ts` will import this function and pass `shillerMarketData` into it. This is a robust, circular-dependency-free architectural pattern.
- **2026 YTD Data**: The 2026 data point in `chart.csv` ends at `05/2026`. While we calculate a YTD return for 2026, `getValidStartYears` calculates `maxStartYear = 2025 - duration + 1`, which correctly restricts simulations to full historical years (ending in 2025).
- **Proxy Data Assumption**: Using US CPI, CAPE, bond growth, and dividend yields from Shiller data as a proxy for the global market assumes US economic indicators are an acceptable baseline for MSCI World simulations. This is standard practice in retirement tools like ficalc.app when international aggregate bond/CPI data is unavailable.

---

## 4. Conclusion

### Proposed Implementation for `src/lib/globalMarketData.ts`
Create `src/lib/globalMarketData.ts` with the following structure:

```typescript
import { MarketDataPoint } from '../types/simulation';

// MSCI World Index December values (1969–2025) + May 2026
// Extracted from chart.csv (monthly data starting 12/1969)
export const msciWorldDecemberValues: Record<number, number> = {
  1969: 10000,
  1970: 9691.499999999998,
  1971: 11471.200000000003,
  1972: 14050.299999999997,
  1973: 11908.6,
  1974: 8875.8,
  1975: 11787.5,
  1976: 13366.7,
  1977: 13457.5,
  1978: 15680.5,
  1979: 17398,
  1980: 21864.400000000005,
  1981: 20818.1,
  1982: 22839.2,
  1983: 27847.4,
  1984: 29161.3,
  1985: 40990.49999999999,
  1986: 58161.30000000001,
  1987: 67562.4,
  1988: 83295.6,
  1989: 97129.7,
  1990: 80600.40000000001,
  1991: 95337.6,
  1992: 90355,
  1993: 110687.10000000002,
  1994: 116305.6,
  1995: 140404.50000000003,
  1996: 159329.40000000002,
  1997: 184445.1,
  1998: 229335.4,
  1999: 286519.9,
  2000: 248761.3,
  2001: 206909.9,
  2002: 165763.6,
  2003: 220642.29999999996,
  2004: 253122.8,
  2005: 277133.00000000006,
  2006: 332742.60000000003,
  2007: 362807.2,
  2008: 215098.99999999997,
  2009: 279603.5,
  2010: 312494.1,
  2011: 295180.9,
  2012: 341896.1,
  2013: 433102.2,
  2014: 454483.70000000007,
  2015: 450524.1,
  2016: 484360.7,
  2017: 592859.1,
  2018: 541212.2,
  2019: 690966,
  2020: 800846.8,
  2021: 975569.4,
  2022: 798585.7,
  2023: 988546.4,
  2024: 1173117,
  2025: 1420575.2,
  2026: 1569546.5 // 05/2026 YTD
};

/**
 * Generates the global market data dictionary by calculating annual MSCI World returns
 * and merging them with US Shiller data (used as a proxy for CPI, CAPE, bonds, and dividends).
 */
export function createGlobalMarketData(shillerData: Record<number, MarketDataPoint>): Record<number, MarketDataPoint> {
  const globalData: Record<number, MarketDataPoint> = {};

  for (let year = 1970; year <= 2026; year++) {
    const startValue = msciWorldDecemberValues[year - 1];
    const endValue = msciWorldDecemberValues[year];
    const stockMarketGrowth = (endValue - startValue) / startValue;

    // Fetch corresponding Shiller data for proxy metrics, fallback to 2025 if 2026
    const base = shillerData[year] || shillerData[2025] || {
      startCpi: 322.0,
      endCpi: 329.0,
      cape: 35.0,
      dividendYields: 0.015,
      bondsGrowth: 0.04
    };

    globalData[year] = {
      year,
      month: 1,
      startCpi: base.startCpi,
      endCpi: base.endCpi,
      cape: base.cape,
      dividendYields: base.dividendYields,
      stockMarketGrowth,
      bondsGrowth: base.bondsGrowth
    };
  }

  return globalData;
}
```

### Proposed Updates for `src/lib/marketData.ts`
Modify `src/lib/marketData.ts` to import `createGlobalMarketData`, instantiate `globalMarketData`, and update the three contract functions:

```typescript
import { MarketDataPoint } from '../types/simulation';
import { createGlobalMarketData } from './globalMarketData';

// ... (existing rawData and shillerMarketData generation loop remain exactly the same) ...

export const globalMarketData = createGlobalMarketData(shillerMarketData);

export function getMarketDataForYear(year: number, mode?: 'us' | 'global'): MarketDataPoint {
  const dataSet = mode === 'global' ? globalMarketData : shillerMarketData;
  if (dataSet[year]) {
    return dataSet[year];
  }
  // Fallback if out of bounds
  return {
    year,
    month: 1,
    startCpi: 322.0,
    endCpi: 329.0,
    cape: 35.0,
    dividendYields: 0.015,
    stockMarketGrowth: 0.07,
    bondsGrowth: 0.04
  };
}

export function getValidStartYears(duration: number, mode?: 'us' | 'global'): number[] {
  const years: number[] = [];
  const startYear = mode === 'global' ? 1970 : 1871;
  const maxStartYear = 2025 - duration + 1;
  for (let y = startYear; y <= maxStartYear; y++) {
    years.push(y);
  }
  // If duration is extremely long and no valid years exist, return at least recent years for partial/extrapolated simulation
  if (years.length === 0) {
    return [1990, 2000, 2010];
  }
  return years;
}

export function getAllMarketData(mode?: 'us' | 'global'): Record<number, MarketDataPoint> {
  return mode === 'global' ? globalMarketData : shillerMarketData;
}
```

---

## 5. Verification Method

- **Static Analysis & Type Checking**: Run `npx tsc --noEmit` to verify TypeScript compilation and ensure no type contract violations in `MarketDataPoint` or function signatures.
- **Unit Tests**: Run `npm run test` to ensure existing market data tests pass and verify new global market data functionality.
- **Build Verification**: Run `npm run build` to verify Next.js production build succeeds without errors or circular dependency issues.
- **Inspection**: Verify `src/lib/globalMarketData.ts` and `src/lib/marketData.ts` contain the correct structure and no `.agents/` files contain source code.
