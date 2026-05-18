import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseLocalDate(dateString: string): Date {
  if (!dateString) return new Date();
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day); // Midnight local time
  }
  return new Date(dateString);
}

export function toUTCISOString(localDateString: string): string {
  if (!localDateString) return new Date().toISOString();
  const [year, month, day] = localDateString.split('-').map(Number);
  // Create date at midnight in the local timezone, then get its UTC equivalent
  return new Date(year, month - 1, day).toISOString();
}

export function formatUTCToLocal(utcString: string): string {
  if (!utcString) return '';
  // If it is already in local YYYY-MM-DD format, return it directly to avoid parsing shifts
  if (/^\d{4}-\d{2}-\d{2}$/.test(utcString)) {
    return utcString;
  }
  const d = parseLocalDate(utcString);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLocalMonthBoundariesUTC(year: number, month: number): { startDateUTC: string, endDateUTC: string } {
  // month is 0-indexed
  const startLocal = new Date(year, month, 1);
  const endLocal = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return {
    startDateUTC: startLocal.toISOString(),
    endDateUTC: endLocal.toISOString()
  };
}

export function formatFriendlyDate(dateStr: string): string {
  if (!dateStr) return 'Unknown Date';
  const d = parseLocalDate(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  
  const today = new Date();
  const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  const isThisYear = d.getFullYear() === today.getFullYear();
  
  if (isToday) return "Today, " + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (isThisYear) return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function wrapLabel(label: string, maxLength: number = 15): string | string[] {
  if (!label) return '';
  if (label.length <= maxLength) return label;
  const words = label.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  words.forEach(word => {
    if ((currentLine + ' ' + word).trim().length <= maxLength) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  });
  if (currentLine) lines.push(currentLine);
  return lines.length > 1 ? lines : label;
}

/**
 * Centralized configuration for all supported currencies.
 * Easily extensible in the future by simply adding a new row.
 */
export const CURRENCY_CONFIG: Record<string, { symbol: string, position: 'prefix' | 'suffix', compression: boolean, decimals: number }> = {
  CAD: { symbol: 'C$', position: 'prefix', compression: false, decimals: 2 },
  VND: { symbol: '₫', position: 'suffix', compression: true, decimals: 0 },
  USD: { symbol: '$', position: 'prefix', compression: false, decimals: 2 },
  EUR: { symbol: '€', position: 'prefix', compression: false, decimals: 2 },
  JPY: { symbol: '¥', position: 'prefix', compression: false, decimals: 0 },
  GBP: { symbol: '£', position: 'prefix', compression: false, decimals: 2 },
  SGD: { symbol: 'S$', position: 'prefix', compression: false, decimals: 2 }
};

/**
 * Converts an amount from one currency to another using a cached rates map.
 * Uses base-neutral intermediate conversion and clamps to 2 decimal places
 * to prevent Javascript float tail growth.
 */
export function convertAmount(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number>
): number {
  if (!from || !to) return amount;
  const fromRate = rates[from] || 1;
  const toRate = rates[to] || 1;
  
  // Safeguard: skip FX division on identical pairs, but always execute rounding clamp
  const converted = from === to ? amount : amount * (toRate / fromRate);
  return Math.round((converted + Number.EPSILON) * 100) / 100;
}

/**
 * Returns the glyph/symbol for standard supported currencies from CURRENCY_CONFIG.
 */
export function getCurrencySymbol(currency: string): string {
  return CURRENCY_CONFIG[currency]?.symbol || '$';
}

/**
 * Formats currency numbers with strict locale compliance.
 * Compresses large VND numbers into K/M formats.
 * Formats standard currencies (USD, EUR, CAD) with exact decimals.
 */
export function formatFriendlyCurrency(amount: number, currency: string): string {
  const amt = parseFloat(amount as any) || 0;
  const conf = CURRENCY_CONFIG[currency] || { symbol: '$', position: 'prefix', compression: false };

  // Handle Large Number Compression (like VND)
  if (conf.compression) {
    if (amt >= 1000000) {
      const formatted = (amt / 1000000).toFixed(1).replace(/\.0$/, '');
      return `${formatted}M ${conf.symbol}`;
    }
    if (amt >= 1000) {
      const formatted = (amt / 1000).toFixed(0);
      return `${formatted}K ${conf.symbol}`;
    }
    return `${amt.toFixed(0)} ${conf.symbol}`;
  }

  // Standard decimal formatting using native Intl
  const formattedAmt = amt.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Position glyphs based on configuration
  return conf.position === 'prefix' 
    ? `${conf.symbol}${formattedAmt}` 
    : `${formattedAmt} ${conf.symbol}`;
}

/**
 * Formats currency numbers compact for charts (tooltip/datalabels).
 * If standard currency (CAD, USD, EUR), divides by 1000 and adds 'K' (e.g., C$0.5K).
 * If large currency (VND), delegates to formatFriendlyCurrency.
 */
export function formatChartFriendlyCurrency(amount: number, currency: string): string {
  const amt = parseFloat(amount as any) || 0;
  const conf = CURRENCY_CONFIG[currency] || { symbol: '$', position: 'prefix', compression: false };

  if (conf.compression) {
    // VND is already compressed beautifully
    return formatFriendlyCurrency(amt, currency);
  }

  // Compress standard currencies into thousands with strict 2-decimal precision (e.g., 523 -> 0.52K, 15 -> 0.02K)
  const compressed = amt / 1000;
  const formatted = compressed.toFixed(2);
  const formattedWithK = `${formatted}K`;

  return conf.position === 'prefix'
    ? `${conf.symbol}${formattedWithK}`
    : `${formattedWithK} ${conf.symbol}`;
}

/**
 * Formats currency numbers compact specifically for Y-axis ticks.
 * Divides by 1000 and enforces 1-decimal precision with a defensive zero guard.
 */
export function formatAxisFriendlyCurrency(amount: number, currency: string): string {
  const amt = typeof amount === 'number' ? amount : (parseFloat(amount) || 0);
  const conf = CURRENCY_CONFIG[currency] || { symbol: '$', position: 'prefix', compression: false };

  // 1. Handle exact zero
  if (amt === 0) {
    return conf.position === 'prefix' ? `${conf.symbol}0` : `0 ${conf.symbol}`;
  }

  const isNegative = amt < 0;
  const absAmt = Math.abs(amt);
  const sign = isNegative ? '-' : '';

  // 2. Micro-Value Safeguard (< 1000)
  // If values are small, don't use K-compression to avoid "$0.1K" duplicate collisions
  if (absAmt < 1000 && !conf.compression) {
    const formatted = absAmt.toFixed(0);
    return conf.position === 'prefix' ? `${sign}${conf.symbol}${formatted}` : `${sign}${formatted} ${conf.symbol}`;
  }

  // 3. VND / Compressed Currency Axis Standardization
  if (conf.compression) {
    // For Y-axis, we want consistent units. If >= 1M, standardize on M with 1 decimal.
    if (absAmt >= 1000000) {
      const formatted = (absAmt / 1000000).toFixed(1);
      return `${sign}${formatted}M ${conf.symbol}`;
    }
    if (absAmt >= 1000) {
      const formatted = (absAmt / 1000).toFixed(0);
      return `${sign}${formatted}K ${conf.symbol}`;
    }
    return `${sign}${absAmt.toFixed(0)} ${conf.symbol}`;
  }

  // 4. Standard Currency K-Compression (Enforce exactly 1 decimal)
  const compressed = absAmt / 1000;
  const formatted = compressed.toFixed(1);
  const formattedWithK = `${formatted}K`;

  return conf.position === 'prefix'
    ? `${sign}${conf.symbol}${formattedWithK}`
    : `${sign}${formattedWithK} ${conf.symbol}`;
}

/**
 * Formats currency numbers with 0 decimal fraction digits (whole integers).
 * Used for macro budgeting overviews.
 */
export function formatNoDecimalCurrency(amount: number, currency: string): string {
  const amt = typeof amount === 'number' ? amount : (parseFloat(amount) || 0);
  const conf = CURRENCY_CONFIG[currency] || { symbol: '$', position: 'prefix', compression: false };

  if (conf.compression) {
    return formatFriendlyCurrency(amt, currency);
  }

  const isNegative = amt < 0;
  const absAmt = Math.abs(amt);
  const formattedAmt = absAmt.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const sign = isNegative ? '-' : '';
  return conf.position === 'prefix' 
    ? `${sign}${conf.symbol}${formattedAmt}` 
    : `${sign}${formattedAmt} ${conf.symbol}`;
}

const intlCache = new Map<string, Intl.NumberFormat>();
const MAX_CACHE_SIZE = 100;

/**
 * Returns a cached Intl.NumberFormat instance with LRU eviction semantics.
 * Pulls default fraction digits dynamically from CURRENCY_CONFIG.
 */
export function getCachedIntl(
  locale: string = 'en-US', 
  currency: string, 
  minFraction?: number, 
  maxFraction?: number
): Intl.NumberFormat {
  const config = CURRENCY_CONFIG[currency] || { decimals: 2 };
  const min = minFraction !== undefined ? minFraction : config.decimals;
  const max = maxFraction !== undefined ? maxFraction : config.decimals;

  const key = `${locale}-${currency}-${min}-${max}`;
  
  // LRU Refresh on Hit
  if (intlCache.has(key)) {
    const instance = intlCache.get(key)!;
    intlCache.delete(key);
    intlCache.set(key, instance); // Move to newest position
    return instance;
  }
  
  // Bounding / Eviction on Miss
  if (intlCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = intlCache.keys().next().value;
    if (oldestKey) intlCache.delete(oldestKey);
  }
  
  const newInstance = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  });
  
  intlCache.set(key, newInstance);
  return newInstance;
}

