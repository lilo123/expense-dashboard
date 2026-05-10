import { convertAmount, formatFriendlyCurrency, getCurrencySymbol } from '@/lib/utils';

describe('Currency Utilities - Scaled Architecture', () => {
  // Baseline mapped to CAD as default base currency
  const mockRates: Record<string, number> = {
    CAD: 1.0,
    VND: 18500.0, // Mapped to CAD baseline
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
      // Float tail: 12.749999999999998 -> 12.75
      expect(convertAmount(12.749999999999998, 'CAD', 'CAD', mockRates)).toBe(12.75);
      // 10.3333333333 -> 10.33
      expect(convertAmount(10.333333333, 'CAD', 'CAD', mockRates)).toBe(10.33);
    });

    it('should correctly convert between non-base currencies (VND to USD)', () => {
      // 185,000 VND to USD: 185,000 * (0.73 / 18500) = 7.30
      expect(convertAmount(185000, 'VND', 'USD', mockRates)).toBe(7.30);
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

    it('should format VND with compression rules and suffix glyph', () => {
      // Millions: 1,500,000 -> 1.5M ₫
      expect(formatFriendlyCurrency(1500000, 'VND')).toBe('1.5M ₫');
      // Millions even: 15,000,000 -> 15M ₫
      expect(formatFriendlyCurrency(15000000, 'VND')).toBe('15M ₫');
      
      // Thousands: 150,000 -> 150K ₫
      expect(formatFriendlyCurrency(150000, 'VND')).toBe('150K ₫');
      
      // Below thousands: 450 -> 450 ₫
      expect(formatFriendlyCurrency(450, 'VND')).toBe('450 ₫');
    });
  });
});
