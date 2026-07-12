import { getMarketDataForYear, getValidStartYears, getAllMarketData } from '../../src/lib/marketData';
import { createGlobalMarketData, msciWorldDecemberValues } from '../../src/lib/globalMarketData';

describe('Adversarial Market Data Tests (M2.1)', () => {
  describe('getMarketDataForYear - Edge Cases', () => {
    it('adv_test_1: handles non-integer float years by returning fallback instead of exact interpolation or rounding', () => {
      const data = getMarketDataForYear(2020.5, 'us');
      // Since 2020.5 is not in shillerMarketData, it returns fallback with year 2020.5
      expect(data.year).toBe(2020.5);
      expect(data.startCpi).toBe(322.0);
    });
  });

  describe('getValidStartYears - Edge Cases & Adversarial Inputs', () => {
    it('adv_test_2: handles duration = 0 or negative duration without throwing, but returns out-of-bounds start years', () => {
      const years = getValidStartYears(0, 'us');
      // maxStartYear = 2025 - 0 + 1 = 2026.
      // 2026 is beyond shillerMarketData max year (2025).
      expect(years[years.length - 1]).toBe(2026);
    });

    it('adv_test_3: handles non-integer duration by truncating/stopping at integer start year', () => {
      const years = getValidStartYears(30.5, 'us');
      // maxStartYear = 2025 - 30.5 + 1 = 1995.5.
      expect(years[years.length - 1]).toBe(1995);
    });
  });

  describe('createGlobalMarketData - Adversarial Proxy Data', () => {
    it('adv_test_4: handles missing base proxy properties gracefully without runtime exception', () => {
      // Pass an object where 2025 exists but is missing properties, to see if it causes NaN or undefined
      const malformedShiller: any = {
        2025: { year: 2025, month: 1 } // missing startCpi, endCpi, cape, etc.
      };
      const result = createGlobalMarketData(malformedShiller);
      // For 1970, shillerData[1970] is undefined, so it falls back to shillerData[2025] (which exists but lacks startCpi)
      // Consequently, result[1970].startCpi will be undefined!
      expect(result[1970].startCpi).toBeUndefined();
    });
  });
});
