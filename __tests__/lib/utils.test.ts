import { convertAmount, formatFriendlyCurrency, getCurrencySymbol } from '@/lib/utils';

describe('Currency Utilities', () => {
  const mockRates: Record<string, number> = {
    USD: 1.0,
    EUR: 0.92,
    JPY: 155.0,
    GBP: 0.8,
    SGD: 1.35,
    VND: 25000.0,
  };

  describe('convertAmount', () => {
    it('should return the same amount if from and to are identical', () => {
      expect(convertAmount(100, 'USD', 'USD', mockRates)).toBe(100);
      expect(convertAmount(500000, 'VND', 'VND', mockRates)).toBe(500000);
    });

    it('should correctly convert from base currency (USD) to target (VND)', () => {
      // $4.00 to VND should be 4.00 * 25000 = 100,000
      expect(convertAmount(4.0, 'USD', 'VND', mockRates)).toBe(100000);
    });

    it('should correctly convert from target (VND) to base currency (USD)', () => {
      // 100,000 VND to USD should be 100,000 * (1 / 25000) = 4.0
      expect(convertAmount(100000, 'VND', 'USD', mockRates)).toBe(4.0);
    });

    it('should correctly convert between non-base currencies (VND to EUR)', () => {
      // 250,000 VND to EUR: 250,000 * (0.92 / 25000) = 9.2
      expect(convertAmount(250000, 'VND', 'EUR', mockRates)).toBe(9.2);
    });
  });

  describe('getCurrencySymbol', () => {
    it('should return correct symbol glyphs', () => {
      expect(getCurrencySymbol('USD')).toBe('$');
      expect(getCurrencySymbol('EUR')).toBe('€');
      expect(getCurrencySymbol('VND')).toBe('₫');
      expect(getCurrencySymbol('UNKNOWN')).toBe('$'); // Default fallback
    });
  });

  describe('formatFriendlyCurrency', () => {
    it('should format USD correctly with decimal separators and prefix glyph', () => {
      expect(formatFriendlyCurrency(15.5, 'USD')).toBe('$15.50');
      expect(formatFriendlyCurrency(1250.75, 'USD')).toBe('$1,250.75');
      expect(formatFriendlyCurrency(0, 'USD')).toBe('$0.00');
    });

    it('should format EUR correctly', () => {
      expect(formatFriendlyCurrency(99.9, 'EUR')).toBe('€99.90');
    });

    it('should format VND with compression rules and suffix glyph', () => {
      // Millions rule: 1,500,000 -> 1.5M ₫
      expect(formatFriendlyCurrency(1500000, 'VND')).toBe('1.5M ₫');
      // Millions rule (even): 15,000,000 -> 15M ₫ (decimal trimmed)
      expect(formatFriendlyCurrency(15000000, 'VND')).toBe('15M ₫');
      
      // Thousands rule: 150,000 -> 150K ₫
      expect(formatFriendlyCurrency(150000, 'VND')).toBe('150K ₫');
      expect(formatFriendlyCurrency(1500, 'VND')).toBe('2K ₫'); // Rounded
      
      // Below thousands rule: 450 -> 450 ₫
      expect(formatFriendlyCurrency(450, 'VND')).toBe('450 ₫');
      expect(formatFriendlyCurrency(0, 'VND')).toBe('0 ₫');
    });
  });
});
