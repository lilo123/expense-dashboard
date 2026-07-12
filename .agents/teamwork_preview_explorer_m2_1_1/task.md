# Task: Explorer 1 - M2.1 Global Market Data Ingestion (CSV Parsing Focus)

## Objective
Analyze `/usr/local/google/home/duynguyenn/Downloads/chart.csv` to understand its structure, columns, and date formats (historical monthly return data starting from 12/1969). Determine the exact parsing logic required to convert this data into annual returns and CPI metrics (if applicable, or how CPI is handled for MSCI World) to match the `MarketDataPoint` structure used in `src/lib/marketData.ts`. Plan the exact implementation of `src/lib/globalMarketData.ts`.

## Scope Boundaries
- Read-only exploration. Do NOT implement changes or modify source code.
- Focus on CSV parsing, data extraction, and the static data structure for `src/lib/globalMarketData.ts`.

## Input Information
- PROJECT.md: `/usr/local/google/home/duynguyenn/expense-dashboard/PROJECT.md`
- SCOPE.md: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m2_1/SCOPE.md`
- Target CSV: `/usr/local/google/home/duynguyenn/Downloads/chart.csv`
- Existing Market Data: `src/lib/marketData.ts`

## Output Requirements
- Write a structured handoff report `handoff.md` in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m2_1_1`).
- Include verified evidence chains, observations, logic chains, caveats, and conclusions.

## Completion Criteria
- `handoff.md` is written and contains a clear, actionable recommendation for `src/lib/globalMarketData.ts`.
