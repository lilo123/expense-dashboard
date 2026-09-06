import { convertAmount, formatFriendlyCurrency, getCurrencySymbol, formatChartFriendlyCurrency, getRemainingMonths } from '@/lib/utils';

describe('Currency Utilities - Scaled Architecture', () => {
  const mockRates: Record<string, number> = {
    CAD: 1.0,
    VND: 18500.0,
    USD: 0.73,
    EUR: 0.67,
    JPY: 114.0,
    GBP: 0.58,
    SGD: 0.99,
  };

  describe('convertAmount', () => {
    it('should return the same amount if from and to are identical', () => {
      expect(convertAmount(100, 'CAD', 'CAD', mockRates)).toBe(100);
      expect(convertAmount(500000, 'VND', 'VND', mockRates)).toBe(500000);
    });

    it('should correctly convert from base CAD to target VND', () => {
      expect(convertAmount(4.0, 'CAD', 'VND', mockRates)).toBe(74000.0);
    });

    it('should correctly convert from target VND to base CAD', () => {
      expect(convertAmount(74000, 'VND', 'CAD', mockRates)).toBe(4.0);
    });

    it('should explicitly round floating point drifts to 2 decimal places', () => {
      expect(convertAmount(12.749999999999998, 'CAD', 'CAD', mockRates)).toBe(12.75);
      expect(convertAmount(10.333333333, 'CAD', 'CAD', mockRates)).toBe(10.33);
    });

    it('should correctly convert between non-base currencies (VND to USD)', () => {
      expect(convertAmount(185000, 'VND', 'USD', mockRates)).toBe(7.30);
    });

    it('should handle empty rates mapping by defaulting to 1:1 conversion fallback', () => {
      expect(convertAmount(100, 'CAD', 'USD', {})).toBe(100);
    });

    it('should handle undefined rates mapping cleanly by defaulting to 1:1 conversion fallback', () => {
      expect(convertAmount(100, 'CAD', 'USD', undefined)).toBe(100);
    });

    it('should handle lowercase and mixed-case currency strings safely', () => {
      expect(convertAmount(4.0, 'cad', 'vnd', mockRates)).toBe(74000.0);
      expect(convertAmount(100, 'usd', 'cad', mockRates)).toBe(136.99);
    });
  });

  describe('getCurrencySymbol', () => {
    it('should return correct symbol glyphs from CURRENCY_CONFIG', () => {
      expect(getCurrencySymbol('CAD')).toBe('C$');
      expect(getCurrencySymbol('VND')).toBe('₫');
      expect(getCurrencySymbol('USD')).toBe('$');
      expect(getCurrencySymbol('EUR')).toBe('€');
    });
  });

  describe('formatFriendlyCurrency', () => {
    it('should format CAD correctly with prefix C$ and exact decimals', () => {
      expect(formatFriendlyCurrency(15.5, 'CAD')).toBe('C$15.50');
      expect(formatFriendlyCurrency(1250.75, 'CAD')).toBe('C$1,250.75');
    });

    it('should format JPY correctly with zero decimals', () => {
      expect(formatFriendlyCurrency(120, 'JPY')).toBe('¥120');
      expect(formatFriendlyCurrency(120.75, 'JPY')).toBe('¥121');
    });

    it('should format VND with compression rules and suffix glyph', () => {
      expect(formatFriendlyCurrency(1500000, 'VND')).toBe('1.5M ₫');
      expect(formatFriendlyCurrency(15000000, 'VND')).toBe('15M ₫');
      expect(formatFriendlyCurrency(150000, 'VND')).toBe('150K ₫');
      expect(formatFriendlyCurrency(450, 'VND')).toBe('450 ₫');
    });
  });

  describe('formatChartFriendlyCurrency', () => {
    it('should format standard currencies compact in thousands K with exactly 2 decimals', () => {
      // 523 CAD -> C$0.52K
      expect(formatChartFriendlyCurrency(523, 'CAD')).toBe('C$0.52K');
      // 1250 CAD -> C$1.25K
      expect(formatChartFriendlyCurrency(1250, 'CAD')).toBe('C$1.25K');
      // 15000 CAD -> C$15.00K (retains decimals)
      expect(formatChartFriendlyCurrency(15000, 'CAD')).toBe('C$15.00K');
      // 15.50 CAD -> C$0.02K (prevents C$0K rounding errors!)
      expect(formatChartFriendlyCurrency(15.5, 'CAD')).toBe('C$0.02K');
      // 0 CAD -> C$0.00K
      expect(formatChartFriendlyCurrency(0, 'CAD')).toBe('C$0.00K');
    });

    it('should delegate to formatFriendlyCurrency for compressed large currencies (like VND)', () => {
      // 1.5M VND -> 1.5M ₫
      expect(formatChartFriendlyCurrency(1500000, 'VND')).toBe('1.5M ₫');
      // 100,000 VND -> 100K ₫
      expect(formatChartFriendlyCurrency(100000, 'VND')).toBe('100K ₫');
    });
  });

  describe('getRemainingMonths', () => {
    it('should return remaining months of the year for standard months (May -> Jun-Dec)', () => {
      expect(getRemainingMonths('2026-05')).toEqual([
        '2026-06',
        '2026-07',
        '2026-08',
        '2026-09',
        '2026-10',
        '2026-11',
        '2026-12',
      ]);
    });

    it('should return remaining months of the year starting from January (Jan -> Feb-Dec)', () => {
      expect(getRemainingMonths('2026-01')).toEqual([
        '2026-02',
        '2026-03',
        '2026-04',
        '2026-05',
        '2026-06',
        '2026-07',
        '2026-08',
        '2026-09',
        '2026-10',
        '2026-11',
        '2026-12',
      ]);
    });

    it('should return empty array if targetMonth is December (Dec -> empty)', () => {
      expect(getRemainingMonths('2026-12')).toEqual([]);
    });

    it('should handle invalid or malformed input defensively by returning empty array', () => {
      expect(getRemainingMonths('')).toEqual([]);
      expect(getRemainingMonths('2026')).toEqual([]);
      expect(getRemainingMonths('2026-13')).toEqual([]);
      expect(getRemainingMonths('invalid-date')).toEqual([]);
    });
  });
});
