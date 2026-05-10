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
 * Converts an amount from one currency to another using a cached rates map.
 * The rates map is expected to have USD as base (rates['USD'] = 1).
 */
export function convertAmount(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number>
): number {
  if (!from || !to || from === to) return amount;
  const fromRate = rates[from] || 1;
  const toRate = rates[to] || 1;
  // Convert via USD base
  return amount * (toRate / fromRate);
}

/**
 * Returns the glyph/symbol for standard supported currencies.
 */
export function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    JPY: '¥',
    GBP: '£',
    SGD: 'S$',
    VND: '₫',
  };
  return symbols[currency] || '$';
}

/**
 * Formats currency numbers.
 * VND uses compressed formatting ('K, 'M) with no decimals to keep UI clean.
 * USD/EUR/GBP use standard decimal comma formats.
 */
export function formatFriendlyCurrency(amount: number, currency: string): string {
  const amt = parseFloat(amount as any) || 0;
  const symbol = getCurrencySymbol(currency);

  if (currency === 'VND') {
    if (amt >= 1000000) {
      const formatted = (amt / 1000000).toFixed(1).replace(/\.0$/, '');
      return `${formatted}M ₫`;
    }
    if (amt >= 1000) {
      const formatted = (amt / 1000).toFixed(0);
      return `${formatted}K ₫`;
    }
    return `${amt.toFixed(0)} ₫`;
  }

  // Standard decimal format for standard currencies
  const formattedAmt = amt.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Prefix glyphs
  return `${symbol}${formattedAmt}`;
}

