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
