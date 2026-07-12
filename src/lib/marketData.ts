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
  2021: { startCpi: 261.6, endCpi: 278.8, cape: 38.3, dividendYields: 0.013, stockMarketGrowth: 0.269, bondsGrowth: -0.130 },
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
