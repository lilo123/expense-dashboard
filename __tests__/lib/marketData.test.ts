import { getMarketDataForYear, getValidStartYears, getAllMarketData, shillerMarketData, globalMarketData } from '../../src/lib/marketData';
import { createGlobalMarketData, msciWorldDecemberValues } from '../../src/lib/globalMarketData';

describe('Market Data Layer Behavior & Modes', () => {
  describe('getMarketDataForYear', () => {
    it('returns US shiller market data by default when mode is omitted', () => {
      const data = getMarketDataForYear(1980);
      expect(data).toEqual(shillerMarketData[1980]);
      expect(data.year).toBe(1980);
    });

    it('returns US shiller market data when mode is explicitly set to us', () => {
      const data = getMarketDataForYear(1980, 'us');
      expect(data).toEqual(shillerMarketData[1980]);
    });

    it('returns global market data when mode is explicitly set to global', () => {
      const data = getMarketDataForYear(1980, 'global');
      expect(data).toEqual(globalMarketData[1980]);
      expect(data.year).toBe(1980);
    });

    it('provides robust fallback values when requested year is out of bounds for us mode', () => {
      const data = getMarketDataForYear(1000, 'us');
      expect(data).toEqual({
        year: 1000,
        month: 1,
        startCpi: 322.0,
        endCpi: 329.0,
        cape: 35.0,
        dividendYields: 0.015,
        stockMarketGrowth: 0.07,
        bondsGrowth: 0.04
      });
    });

    it('provides robust fallback values when requested year is out of bounds for global mode', () => {
      const data = getMarketDataForYear(1000, 'global');
      expect(data).toEqual({
        year: 1000,
        month: 1,
        startCpi: 322.0,
        endCpi: 329.0,
        cape: 25.0,
        dividendYields: 0.015,
        stockMarketGrowth: 0.07,
        bondsGrowth: 0.04
      });
    });
  });

  describe('getValidStartYears', () => {
    it('returns valid start years starting from 1871 for us mode', () => {
      const years = getValidStartYears(30, 'us');
      expect(years[0]).toBe(1871);
      expect(years[years.length - 1]).toBe(2025 - 30 + 1);
    });

    it('returns valid start years starting from 1970 for global mode', () => {
      const years = getValidStartYears(30, 'global');
      expect(years[0]).toBe(1970);
      expect(years[years.length - 1]).toBe(2025 - 30 + 1);
    });

    it('returns recent years fallback when duration is extremely long and no valid years exist', () => {
      const years = getValidStartYears(200, 'us');
      expect(years).toEqual([1990, 2000, 2010]);
    });
  });

  describe('getAllMarketData', () => {
    it('returns shillerMarketData when mode is us', () => {
      const data = getAllMarketData('us');
      expect(data).toBe(shillerMarketData);
    });

    it('returns globalMarketData when mode is global', () => {
      const data = getAllMarketData('global');
      expect(data).toBe(globalMarketData);
    });
  });

  describe('createGlobalMarketData', () => {
    it('computes stockMarketGrowth correctly from msciWorldDecemberValues and merges shiller proxy data', () => {
      const dummyShiller = {
        1970: {
          year: 1970,
          month: 1,
          startCpi: 100,
          endCpi: 105,
          cape: 15,
          dividendYields: 0.03,
          stockMarketGrowth: 0.1,
          bondsGrowth: 0.05
        }
      };
      const result = createGlobalMarketData(dummyShiller);
      const startValue = msciWorldDecemberValues[1969];
      const endValue = msciWorldDecemberValues[1970];
      const expectedGrowth = (endValue - startValue) / startValue;

      expect(result[1970]).toEqual({
        year: 1970,
        month: 1,
        startCpi: 100,
        endCpi: 105,
        cape: 15,
        dividendYields: 0.03,
        stockMarketGrowth: expectedGrowth,
        bondsGrowth: 0.05
      });
    });

    it('uses fallback values when shiller data for the year is missing', () => {
      const result = createGlobalMarketData({});
      expect(result[1970].startCpi).toBe(322.0);
      expect(result[1970].endCpi).toBe(329.0);
      expect(result[1970].cape).toBe(35.0);
      expect(result[1970].dividendYields).toBe(0.015);
      expect(result[1970].bondsGrowth).toBe(0.04);
    });
  });

  describe('Adversarial Coverage Audit (adv_*)', () => {
    describe('adv_getMarketDataForYear boundaries & edge cases', () => {
      it('adv_returns correct fallback at exact lower bound for us mode (1870)', () => {
        const data = getMarketDataForYear(1870, 'us');
        expect(data).toEqual({
          year: 1870,
          month: 1,
          startCpi: 322.0,
          endCpi: 329.0,
          cape: 35.0,
          dividendYields: 0.015,
          stockMarketGrowth: 0.07,
          bondsGrowth: 0.04
        });
      });

      it('adv_returns correct fallback at exact lower bound for global mode (1969)', () => {
        const data = getMarketDataForYear(1969, 'global');
        expect(data).toEqual({
          year: 1969,
          month: 1,
          startCpi: 322.0,
          endCpi: 329.0,
          cape: 25.0,
          dividendYields: 0.015,
          stockMarketGrowth: 0.07,
          bondsGrowth: 0.04
        });
      });

      it('adv_returns correct data for 2026 in global mode and fallback for 2026 in us mode', () => {
        const usData = getMarketDataForYear(2026, 'us');
        expect(usData).toEqual({
          year: 2026,
          month: 1,
          startCpi: 322.0,
          endCpi: 329.0,
          cape: 35.0,
          dividendYields: 0.015,
          stockMarketGrowth: 0.07,
          bondsGrowth: 0.04
        });

        const globalData = getMarketDataForYear(2026, 'global');
        expect(globalData.year).toBe(2026);
        expect(globalData.bondsGrowth).toBe(shillerMarketData[2025].bondsGrowth);
      });

      it('adv_returns correct fallback at exact upper bound for global mode (2027)', () => {
        const data = getMarketDataForYear(2027, 'global');
        expect(data).toEqual({
          year: 2027,
          month: 1,
          startCpi: 322.0,
          endCpi: 329.0,
          cape: 25.0,
          dividendYields: 0.015,
          stockMarketGrowth: 0.07,
          bondsGrowth: 0.04
        });
      });

      it('adv_verifies 2021 bondsGrowth is exactly -0.130 to prevent regression', () => {
        const data = getMarketDataForYear(2021, 'us');
        expect(data.bondsGrowth).toBe(-0.130);
        expect(data.stockMarketGrowth).toBe(0.269);
      });

      it('adv_verifies cyclical baseline generation for unlisted years (e.g. 1872)', () => {
        const data = getMarketDataForYear(1872, 'us');
        expect(data.year).toBe(1872);
        const cycle = Math.sin(1872 * 0.45);
        const expectedStockGrowth = 0.08 + cycle * 0.12;
        const expectedBondsGrowth = 0.04 + Math.cos(1872 * 0.5) * 0.03;
        expect(data.stockMarketGrowth).toBeCloseTo(expectedStockGrowth, 5);
        expect(data.bondsGrowth).toBeCloseTo(expectedBondsGrowth, 5);
      });
    });

    describe('adv_getValidStartYears boundaries & edge cases', () => {
      it('adv_handles duration=1 correctly for both modes', () => {
        const usYears = getValidStartYears(1, 'us');
        expect(usYears[0]).toBe(1871);
        expect(usYears[usYears.length - 1]).toBe(2025);

        const globalYears = getValidStartYears(1, 'global');
        expect(globalYears[0]).toBe(1970);
        expect(globalYears[globalYears.length - 1]).toBe(2025);
      });

      it('adv_handles exact boundary durations for global mode (duration=56 and 57)', () => {
        // 2025 - 56 + 1 = 1970 (exact 1 year valid: 1970)
        const global56 = getValidStartYears(56, 'global');
        expect(global56).toEqual([1970]);

        // 2025 - 57 + 1 = 1969 (no valid years, fallback triggers)
        const global57 = getValidStartYears(57, 'global');
        expect(global57).toEqual([1990, 2000, 2010]);
      });

      it('adv_handles exact boundary durations for us mode (duration=155 and 156)', () => {
        // 2025 - 155 + 1 = 1871 (exact 1 year valid: 1871)
        const us155 = getValidStartYears(155, 'us');
        expect(us155).toEqual([1871]);

        // 2025 - 156 + 1 = 1870 (no valid years, fallback triggers)
        const us156 = getValidStartYears(156, 'us');
        expect(us156).toEqual([1990, 2000, 2010]);
      });

      it('adv_handles duration=0 or negative duration gracefully', () => {
        const us0 = getValidStartYears(0, 'us');
        expect(us0[us0.length - 1]).toBe(2026);
      });

      it('adv_defaults to us mode when mode is omitted', () => {
        const defaultYears = getValidStartYears(30);
        const usYears = getValidStartYears(30, 'us');
        expect(defaultYears).toEqual(usYears);
      });
    });

    describe('adv_createGlobalMarketData 2026 proxy fallback & getAllMarketData default', () => {
      it('adv_verifies getAllMarketData defaults to us mode', () => {
        expect(getAllMarketData()).toBe(shillerMarketData);
      });

      it('adv_verifies createGlobalMarketData correctly uses 2025 shiller proxy for 2026', () => {
        const global2026 = globalMarketData[2026];
        const shiller2025 = shillerMarketData[2025];
        expect(global2026.startCpi).toBe(shiller2025.startCpi);
        expect(global2026.endCpi).toBe(shiller2025.endCpi);
        expect(global2026.cape).toBe(shiller2025.cape);
        expect(global2026.dividendYields).toBe(shiller2025.dividendYields);
        expect(global2026.bondsGrowth).toBe(shiller2025.bondsGrowth);

        const startVal = msciWorldDecemberValues[2025];
        const endVal = msciWorldDecemberValues[2026];
        expect(global2026.stockMarketGrowth).toBe((endVal - startVal) / startVal);
      });
    });
  });
});
