import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function toUTCISOString(localDateString: string): string {
  if (!localDateString) return new Date().toISOString();
  const [year, month, day] = localDateString.split('-').map(Number);
  // Create date at midnight in the local timezone, then get its UTC equivalent
  return new Date(year, month - 1, day).toISOString();
}

export function formatUTCToLocal(utcString: string): string {
  if (!utcString) return '';
  const d = new Date(utcString);
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
