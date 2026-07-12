# Scope: M2 - Global Market Data Ingestion & Processing

## Architecture
- `src/lib/globalMarketData.ts`: New file containing MSCI World historical data parsed from `/usr/local/google/home/duynguyenn/Downloads/chart.csv`.
- `src/lib/marketData.ts`: Updated to support fetching either US Shiller data or Global MSCI World data based on `marketDataMode`.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M2.1: Parse MSCI World CSV & Implement Global Data | `src/lib/globalMarketData.ts`, `src/lib/marketData.ts` | M1 | PLANNED |

## Interface Contracts
### `marketData.ts`
- `getMarketDataForYear(year: number, mode?: 'us' | 'global'): MarketDataPoint`
- `getValidStartYears(duration: number, mode?: 'us' | 'global'): number[]`
- `getAllMarketData(mode?: 'us' | 'global'): Record<number, MarketDataPoint>`

## Verification Requirements
- Ensure `npx tsc --noEmit`, `npm run test`, and `npm run build` pass successfully.
