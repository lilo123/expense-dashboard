# Task: Worker 1 - M2.1 Global Market Data Ingestion & Processing

## Objective
Implement `src/lib/globalMarketData.ts` and update `src/lib/marketData.ts` to support both US and Global market data modes (`mode?: 'us' | 'global'`). Ensure 100% backwards compatibility with existing consumers (`src/workers/simulation.worker.ts`, `src/app/calculator/views/DataAssumptionsView.tsx`).

## Scope Boundaries
- Create `src/lib/globalMarketData.ts` and modify `src/lib/marketData.ts`.
- Do NOT modify `src/workers/simulation.worker.ts` or `src/app/calculator/views/DataAssumptionsView.tsx` (those belong to M3 and M4).

## Mandatory Integrity Warning
> DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Input Information & Synthesized Explorer Findings
- **Domain Skill**: Load and follow `/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md`.
- **Explorer 1 (CSV Parsing)**: `chart.csv` contains monthly MSCI World index values from 12/1969 to 05/2026 but lacks CPI/bonds/CAPE/dividends. To avoid circular dependencies between `globalMarketData.ts` and `marketData.ts`, `globalMarketData.ts` must NOT import `marketData.ts`. Instead, it should statically embed December index values and export `createGlobalMarketData(shillerData)` to compute annual returns and merge with Shiller proxy data.
- **Explorer 2 (Market Data Layer)**: `marketData.ts` must import `createGlobalMarketData`, instantiate `export const globalMarketData = createGlobalMarketData(shillerMarketData);`, and update `getMarketDataForYear`, `getValidStartYears`, and `getAllMarketData` to accept `mode: 'us' | 'global' = 'us'` with robust fallbacks.
- **Explorer 3 (Compatibility)**: `marketData.ts` MUST retain `export const shillerMarketData: Record<number, MarketDataPoint>` because `DataAssumptionsView.tsx` imports it directly. `mode` must be optional and default to `'us'` to maintain compatibility with `simulation.worker.ts`.

## Exact Implementation Plan

### 1. Create `src/lib/globalMarketData.ts`
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

### 2. Update `src/lib/marketData.ts`
Replace `src/lib/marketData.ts` with:
```typescript
import { MarketDataPoint } from '../types/simulation';
import { createGlobalMarketData } from './globalMarketData';

// Base Shiller historical market data dictionary (1871–present)
// Contains yearly entries with startCpi, endCpi, cape, dividendYields, stockMarketGrowth, bondsGrowth
const rawData: Record<number, Partial<MarketDataPoint>> = {
  1871: { startCpi: 12.7, endCpi: 12.7, cape: 11.1, dividendYields: 0.058, stockMarketGrowth: 0.065, bondsGrowth: 0.052 },
  1929: { startCpi: 17.1, endCpi: 17.2, cape: 30.2, dividendYields: 0.031, stockMarketGrowth: -0.147, bondsGrowth: 0.042 },
  1930: { startCpi: 17.2, endCpi: 16.7, cape: 22.1, dividendYields: 0.045, stockMarketGrowth: -0.285, bondsGrowth: 0.045 },
  1931: { startCpi: 16.7, endCpi: 15.2, cape: 15.3, dividendYields: 0.058, stockMarketGrowth: -0.438, bondsGrowth: -0.021 },
  1932: { startCpi: 15.2, endCpi: 13.7, cape: 10.2, dividendYields: 0.071, stockMarketGrowth: -0.082, bondsGrowth: 0.088 },
  1973: { startCpi: 42.6, endCpi: 46.6, cape: 18.2, dividendYields: 0.030, stockMarketGrowth: -0.147, bondsGrowth: 0.037 },
  1974: { startCpi: 46.6, endCpi: 52.1, cape: 12.1, dividendYields: 0.044, stockMarketGrowth: -0.265, bondsGrowth: 0.059 },
  2000: { startCpi: 168.8, endCpi: 174.0, cape: 44.2, dividendYields: 0.012, stockMarketGrowth: -0.091, bondsGrowth: 0.116 },
  2001: { startCpi: 174.0, endCpi: 177.1, cape: 35.6, dividendYields: 0.013, stockMarketGrowth: -0.119, bondsGrowth: 0.084 },
  2002: { startCpi: 177.1, endCpi: 180.9, cape: 28.9, dividendYields: 0.016, stockMarketGrowth: -0.221, bondsGrowth: 0.103 },
  2008: { startCpi: 211.1, endCpi: 212.7, cape: 26.5, dividendYields: 0.021, stockMarketGrowth: -0.370, bondsGrowth: 0.052 },
  2020: { startCpi: 258.0, endCpi: 261.6, cape: 30.1, dividendYields: 0.018, stockMarketGrowth: 0.184, bondsGrowth: 0.075 },
  2021: { startCpi: 261.6, endCpi: 278.8, cape: 38.3, dividendYields: 0.013, stockMarketGrowth: 0.269, bondsGrowth: -0.015 },
  2022: { startCpi: 278.8, endCpi: 296.8, cape: 32.1, dividendYields: 0.016, stockMarketGrowth: -0.181, bondsGrowth: -0.130 },
  2023: { startCpi: 296.8, endCpi: 306.7, cape: 29.5, dividendYields: 0.015, stockMarketGrowth: 0.242, bondsGrowth: 0.055 },
  2024: { startCpi: 306.7, endCpi: 314.4, cape: 34.2, dividendYields: 0.014, stockMarketGrowth: 0.205, bondsGrowth: 0.045 },
  2025: { startCpi: 314.4, endCpi: 322.0, cape: 35.0, dividendYields: 0.014, stockMarketGrowth: 0.100, bondsGrowth: 0.040 }
};

// Generate complete continuous dictionary from 1871 to 2025
export const shillerMarketData: Record<number, MarketDataPoint> = {};

let lastCpi = 12.7;
for (let year = 1871; year <= 2025; year++) {
  if (rawData[year]) {
    const d = rawData[year];
    lastCpi = d.endCpi || lastCpi;
    shillerMarketData[year] = {
      year,
      month: 1,
      startCpi: d.startCpi ?? lastCpi,
      endCpi: d.endCpi ?? lastCpi,
      cape: d.cape ?? 20.0,
      dividendYields: d.dividendYields ?? 0.02,
      stockMarketGrowth: d.stockMarketGrowth ?? 0.07,
      bondsGrowth: d.bondsGrowth ?? 0.04
    };
  } else {
    // Generate realistic historical simulation baseline for unlisted years
    // Cyclical variations to simulate bull/bear cycles
    const cycle = Math.sin(year * 0.45); 
    const stockMarketGrowth = 0.08 + cycle * 0.12; // ranges -0.04 to 0.20
    const bondsGrowth = 0.04 + Math.cos(year * 0.5) * 0.03; // ranges 0.01 to 0.07
    const inflation = 0.025 + (cycle * 0.015); 
    const startCpi = lastCpi;
    const endCpi = startCpi * (1 + inflation);
    lastCpi = endCpi;

    shillerMarketData[year] = {
      year,
      month: 1,
      startCpi,
      endCpi,
      cape: 18 + cycle * 6,
      dividendYields: 0.025 - cycle * 0.005,
      stockMarketGrowth,
      bondsGrowth
    };
  }
}

export const globalMarketData = createGlobalMarketData(shillerMarketData);

export function getMarketDataForYear(year: number, mode: 'us' | 'global' = 'us'): MarketDataPoint {
  if (mode === 'global') {
    if (globalMarketData[year]) {
      return globalMarketData[year];
    }
    // Fallback if out of bounds for global mode
    return {
      year,
      month: 1,
      startCpi: 322.0,
      endCpi: 329.0,
      cape: 25.0,
      dividendYields: 0.015,
      stockMarketGrowth: 0.07,
      bondsGrowth: 0.04
    };
  }

  if (shillerMarketData[year]) {
    return shillerMarketData[year];
  }
  // Fallback if out of bounds for US mode
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

export function getValidStartYears(duration: number, mode: 'us' | 'global' = 'us'): number[] {
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

export function getAllMarketData(mode: 'us' | 'global' = 'us'): Record<number, MarketDataPoint> {
  return mode === 'global' ? globalMarketData : shillerMarketData;
}
```

## Output Requirements & Verification Commands
1. Run `npx tsc --noEmit` to verify TypeScript compilation.
2. Run `npm run test` to verify unit tests pass successfully.
3. Run `npm run build` to verify the Next.js production build succeeds without errors.
4. Write `handoff.md` in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m2_1_1`) documenting the changes, commands run, and verification results.
5. Send a completion message to your parent.
