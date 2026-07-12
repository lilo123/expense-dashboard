import { getMarketDataForYear, getValidStartYears, getAllMarketData, shillerMarketData, globalMarketData } from '../../src/lib/marketData';
import { createGlobalMarketData, msciWorldDecemberValues } from '../../src/lib/globalMarketData';
import { MarketDataPoint } from '../../src/types/simulation';

describe('Market Data Layer - Empirical Stress & Adversarial Testing', () => {
  // Oracle implementation for differential testing
  function oracleGetMarketDataForYear(year: number, mode?: any): MarketDataPoint {
    const isGlobal = mode === 'global';
    if (isGlobal) {
      if (globalMarketData[year]) {
        return globalMarketData[year];
      }
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
    } else {
      if (shillerMarketData[year]) {
        return shillerMarketData[year];
      }
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
  }

  function oracleGetValidStartYears(duration: number, mode?: any): number[] {
    const years: number[] = [];
    const startYear = mode === 'global' ? 1970 : 1871;
    const maxStartYear = 2025 - duration + 1;
    for (let y = startYear; y <= maxStartYear; y++) {
      years.push(y);
    }
    if (years.length === 0) {
      return [1990, 2000, 2010];
    }
    return years;
  }

  describe('1. Differential Testing (Correctness Fuzzing against Oracle)', () => {
    it('Phase 1: Exhaustive enumeration of years (1850 to 2050) for both modes', () => {
      for (let year = 1850; year <= 2050; year++) {
        expect(getMarketDataForYear(year, 'us')).toEqual(oracleGetMarketDataForYear(year, 'us'));
        expect(getMarketDataForYear(year, 'global')).toEqual(oracleGetMarketDataForYear(year, 'global'));
      }
    });

    it('Phase 2: Random small/medium inputs (1000+ cases)', () => {
      const modes: ('us' | 'global')[] = ['us', 'global'];
      // Deterministic PRNG replacement for reproducibility
      let seed = 12345;
      function getNextRandom() {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      }

      for (let i = 0; i < 1500; i++) {
        const year = Math.floor(getNextRandom() * 3000); // 0 to 3000
        const mode = modes[Math.floor(getNextRandom() * modes.length)];
        expect(getMarketDataForYear(year, mode)).toEqual(oracleGetMarketDataForYear(year, mode));

        const duration = Math.floor(getNextRandom() * 100); // 0 to 100
        expect(getValidStartYears(duration, mode)).toEqual(oracleGetValidStartYears(duration, mode));
      }
    });

    it('Phase 3: Adversarial & extreme inputs (negative, NaN, Infinity, floating point, invalid modes)', () => {
      const extremeYears = [-10000, -1, 0, 1, 2147483647, -2147483648, NaN, Infinity, -Infinity, 1995.5, 2020.99];
      const extremeModes = ['us', 'global', 'eu', 'invalid', '', null, undefined, 123, {}] as any[];

      for (const year of extremeYears) {
        for (const mode of extremeModes) {
          expect(getMarketDataForYear(year, mode)).toEqual(oracleGetMarketDataForYear(year, mode));
        }
      }

      const extremeDurations = [-1000, -5, 0, 1, 56, 65, 150, 100000, NaN, Infinity, -Infinity, 30.5, 10.1];
      for (const duration of extremeDurations) {
        for (const mode of extremeModes) {
          // Avoid passing -Infinity or huge negative numbers to prevent array size OOM in test runner, cap at -1000
          if (duration === -Infinity) continue;
          expect(getValidStartYears(duration, mode)).toEqual(oracleGetValidStartYears(duration, mode));
        }
      }
    });
  });

  describe('2. Performance & Stress Testing (TLE/MLE Prevention)', () => {
    it('executes getMarketDataForYear 100,000 times within time limit (< 1000ms) with stable memory', () => {
      const startTime = Date.now();
      const modes: ('us' | 'global')[] = ['us', 'global'];
      let dummySum = 0;

      for (let i = 0; i < 100000; i++) {
        const year = 1871 + (i % 160);
        const mode = modes[i % 2];
        const data = getMarketDataForYear(year, mode);
        dummySum += data.stockMarketGrowth;
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000);
      expect(dummySum).not.toBeNaN();
    });

    it('executes getAllMarketData 10,000 times instantly without deep copy overhead', () => {
      const startTime = Date.now();
      for (let i = 0; i < 10000; i++) {
        const usData = getAllMarketData('us');
        const globalData = getAllMarketData('global');
        expect(usData[1980]).toBeDefined();
        expect(globalData[1980]).toBeDefined();
      }
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('3. Edge Case & Data Integrity Verification', () => {
    it('validates that msciWorldDecemberValues contains no NaN, null, or undefined values', () => {
      Object.entries(msciWorldDecemberValues).forEach(([year, value]) => {
        expect(Number(year)).not.toBeNaN();
        expect(value).toBeDefined();
        expect(value).not.toBeNull();
        expect(typeof value).toBe('number');
        expect(value).not.toBeNaN();
        expect(value).toBeGreaterThan(0);
      });
    });

    it('validates that shillerMarketData and globalMarketData contain fully formed MarketDataPoint objects', () => {
      const checkDataDictionary = (dict: Record<number, MarketDataPoint>, startYear: number, endYear: number) => {
        for (let y = startYear; y <= endYear; y++) {
          const point = dict[y];
          expect(point).toBeDefined();
          expect(point.year).toBe(y);
          expect(point.month).toBe(1);
          expect(typeof point.startCpi).toBe('number');
          expect(typeof point.endCpi).toBe('number');
          expect(typeof point.cape).toBe('number');
          expect(typeof point.dividendYields).toBe('number');
          expect(typeof point.stockMarketGrowth).toBe('number');
          expect(typeof point.bondsGrowth).toBe('number');

          expect(point.startCpi).not.toBeNaN();
          expect(point.endCpi).not.toBeNaN();
          expect(point.cape).not.toBeNaN();
          expect(point.dividendYields).not.toBeNaN();
          expect(point.stockMarketGrowth).not.toBeNaN();
          expect(point.bondsGrowth).not.toBeNaN();
        }
      };

      checkDataDictionary(shillerMarketData, 1871, 2025);
      checkDataDictionary(globalMarketData, 1970, 2026);
    });

    it('verifies createGlobalMarketData resilience against corrupted or empty shiller data dictionaries', () => {
      const corruptedShiller: any = {
        1975: { startCpi: 50, endCpi: 55, cape: 10, dividendYields: 0.02, stockMarketGrowth: 0.05, bondsGrowth: 0.03 },
        // Missing fields for 1976
        1976: { startCpi: 55 },
        // Extreme values for 1977
        1977: { startCpi: 1e12, endCpi: 2e12, cape: 1000, dividendYields: 0.5, stockMarketGrowth: -0.99, bondsGrowth: -0.5 }
      };

      const result = createGlobalMarketData(corruptedShiller);
      expect(result[1975].startCpi).toBe(50);
      expect(result[1975].bondsGrowth).toBe(0.03);

      // For 1976, missing fields will result in undefined for those properties because createGlobalMarketData accesses base.endCpi etc.
      // But it should not throw any runtime exception.
      expect(result[1976].startCpi).toBe(55);
      expect(result[1976].endCpi).toBeUndefined();

      expect(result[1977].startCpi).toBe(1e12);
      expect(result[1977].stockMarketGrowth).toBeDefined(); // Calculated from MSCI world values, not Shiller!
      expect(result[1977].bondsGrowth).toBe(-0.5);

      // For unlisted year 1978, it falls back to shillerData[2025] or the default fallback object
      expect(result[1978].startCpi).toBe(322.0);
      expect(result[1978].endCpi).toBe(329.0);
      expect(result[1978].cape).toBe(35.0);
      expect(result[1978].dividendYields).toBe(0.015);
      expect(result[1978].bondsGrowth).toBe(0.04);
    });
  });
});
