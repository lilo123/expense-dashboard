# Handoff Report: M4 - UI Inputs & Toggles (Views Investigation)

## 1. Observation

### `src/workers/simulation.worker.ts`
- **Line 202-206**: When `simulationMode === 'monte_carlo'`, the worker populates `runDefinitions` with `startYear: i` and `runIndex: i` for `i` from 1 to 1,000.
- **Line 480-488**: Each `SimulationRunResult` is constructed with `startYear` (which equals the run index 1..1000 in Monte Carlo mode) and `endYear: startYear + totalDuration - 1`.

### `src/app/calculator/views/SummaryView.tsx`
- **Line 7**: Retrieves simulation state via `const { result, isCalculating } = useSimulation();`. Does not currently destructure `config`.
- **Line 109-112**: `handleDownloadCsv` hardcodes CSV headers `['Start Year', 'End Year', ...]` and maps rows using `r.startYear` and `r.endYear`.
- **Line 322**: Table header hardcodes `<th ...>Start Year</th>`.
- **Line 330**: Table cell hardcodes `<td ...>{run.startYear}–{run.endYear}</td>`.

### `src/app/calculator/views/PortfolioValueView.tsx`
- **Line 25**: `CustomTooltip` displays `Start Years: ${data.startYears.join(', ')}`. For 1,000 Monte Carlo runs, this joins up to 1,000 numbers into a single string, causing severe UI overflow.
- **Line 33**: Retrieves `const { result, config, isCalculating } = useSimulation();`.
- **Line 238**: Renders `<Tooltip content={<CustomTooltip />} />` without passing `isMonteCarlo` context.
- **Line 253**: Table header hardcodes `<th ...>Start Year</th>`.
- **Line 261**: Table cell hardcodes `<td ...>{row.startYear}</td>`.

### `src/app/calculator/views/AvailableSpendingView.tsx`
- **Line 28**: `CustomSpendingTooltip` displays `Cohorts: ${data.cohorts.join(', ')}`. Like `PortfolioValueView`, this will overflow with 1,000 runs.
- **Line 36**: Retrieves `const { result, isCalculating } = useSimulation();`. Does not currently destructure `config`.
- **Line 383**: Renders `<Tooltip content={<CustomSpendingTooltip />} />` without passing `isMonteCarlo` context.
- **Line 404**: Table header hardcodes `<th ...>Start Year</th>`.
- **Line 414**: Table cell hardcodes `<td ...>{v.startYear} Cohort</td>`.
- **Line 439**: Modal header hardcodes `<h3 ...>Spending Trajectory: Cohort {selectedRun.startYear}–{selectedRun.endYear}</h3>`.

### `src/app/calculator/views/SimulationsListView.tsx`
- **Line 18**: Retrieves `const { result, config, isCalculating } = useSimulation();`.
- **Line 107**: Sort dropdown option hardcodes `<option value="date">Date</option>`.
- **Line 148**: Simulation card title hardcodes `<span ...>{run.startYear}–{run.endYear}</span>`.
- **Line 188**: Modal header hardcodes `<h3 ...>Simulation Details: Cohort {selectedRun.startYear}–{selectedRun.endYear}</h3>`.
- **Line 342**: Modal table header hardcodes `<th ...>Calendar Yr</th>`.
- **Line 358**: Modal table cell hardcodes `<td ...>{yr.year}</td>`.

### `src/app/calculator/views/DataAssumptionsView.tsx`
- **Line 4**: Statically imports `shillerMarketData` from `../../../lib/marketData`.
- **Line 11-20**: `historicalDataRows` useMemo hook hardcodes `const rows = Object.values(shillerMarketData);`. Does not use `useSimulation` or `getAllMarketData`.

---

## 2. Logic Chain

1. **Monte Carlo Run Indexing**: Because `simulation.worker.ts` uses the run index (1 to 1000) as the `startYear` in `Scrambled Monte Carlo` mode, treating `startYear` as a calendar year in the UI produces misleading labels (e.g., displaying Run #1 as "1–50" or "1 Cohort").
2. **Tooltip Overflow Prevention**: In `PortfolioValueView` and `AvailableSpendingView`, the histogram bins group simulation runs. In Monte Carlo mode, a single bin can contain hundreds of runs. Calling `.join(', ')` on these arrays creates massive text blocks that break the tooltip layout. Truncating the list (e.g., showing the first 10 runs plus a `(+N more)` label) is necessary for a seamless UI.
3. **Contextual UI Labels**: To seamlessly support both modes, each view must check `config?.simulationMode === 'monte_carlo'`. When true, table headers, tooltips, modal titles, and card labels must dynamically switch from calendar/cohort terminology ("Start Year", "Calendar Yr", "Cohort") to simulation terminology ("Run Number", "Simulation Yr", "Run #").
4. **Dynamic Market Data in Assumptions View**: `DataAssumptionsView.tsx` currently displays only US Shiller data. To reflect the user's active market data selection (`us` vs `global`), it must import `useSimulation` to access `config.marketDataMode`, import `getAllMarketData`, and dynamically compute `Object.values(getAllMarketData(config?.marketDataMode || 'us'))`.

---

## 3. Caveats

- **Read-Only Investigation**: As per agent constraints, no code changes have been implemented.
- **CSV Export Behavior**: In `SummaryView.tsx`, `handleDownloadCsv` exports `startYear` and `endYear`. We recommend adjusting the CSV headers and rows conditionally so the exported spreadsheet is equally clear in Monte Carlo mode.
- **Assumptions**: We assume `config.simulationMode` is the canonical indicator for Monte Carlo mode, and `config.marketDataMode` is the canonical indicator for market data selection, matching the contracts in `PROJECT.md`.

---

## 4. Conclusion (Recommended Fix Strategy)

### R1. Seamless Monte Carlo Rendering

#### `src/app/calculator/views/SummaryView.tsx`
```tsx
// 1. Destructure config from useSimulation
const { result, isCalculating, config } = useSimulation();
const isMonteCarlo = config?.simulationMode === 'monte_carlo';

// 2. Update handleDownloadCsv
const headers = [isMonteCarlo ? 'Run Number' : 'Start Year', isMonteCarlo ? 'End Year' : 'End Year', 'Status', 'Nominal Ending Balance', 'Real Ending Balance', 'Average Stocks Return', 'Average Real Withdrawal'];
const rows = result.runs.map(r => [
  isMonteCarlo ? `Run #${r.startYear}` : r.startYear,
  isMonteCarlo ? 'N/A' : r.endYear,
  // ...
]);

// 3. Update table header & cells
<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{isMonteCarlo ? 'Run Number' : 'Start Year'}</th>
<td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{isMonteCarlo ? `Run #${run.startYear}` : `${run.startYear}–${run.endYear}`}</td>
```

#### `src/app/calculator/views/PortfolioValueView.tsx`
```tsx
// 1. Update CustomTooltip definition & content
const CustomTooltip = ({ active, payload, isMonteCarlo }: any) => {
  // ...
  <p className="text-gray-400 leading-relaxed">
    {isMonteCarlo 
      ? `Runs: ${data.startYears.slice(0, 10).join(', ')}${data.startYears.length > 10 ? ` (+${data.startYears.length - 10} more)` : ''}`
      : `Start Years: ${data.startYears.join(', ')}`}
  </p>
};

// 2. Define isMonteCarlo & pass to Tooltip
const isMonteCarlo = config?.simulationMode === 'monte_carlo';
<Tooltip content={<CustomTooltip isMonteCarlo={isMonteCarlo} />} />

// 3. Update table header & cells
<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{isMonteCarlo ? 'Run Number' : 'Start Year'}</th>
<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{isMonteCarlo ? `Run #${row.startYear}` : row.startYear}</td>
```

#### `src/app/calculator/views/AvailableSpendingView.tsx`
```tsx
// 1. Update CustomSpendingTooltip definition & content
const CustomSpendingTooltip = ({ active, payload, isMonteCarlo }: any) => {
  // ...
  <p className="text-gray-400 leading-relaxed">
    {isMonteCarlo 
      ? `Runs: ${data.cohorts.slice(0, 10).join(', ')}${data.cohorts.length > 10 ? ` (+${data.cohorts.length - 10} more)` : ''}`
      : `Cohorts: ${data.cohorts.join(', ')}`}
  </p>
};

// 2. Destructure config, define isMonteCarlo & pass to Tooltip
const { result, isCalculating, config } = useSimulation();
const isMonteCarlo = config?.simulationMode === 'monte_carlo';
<Tooltip content={<CustomSpendingTooltip isMonteCarlo={isMonteCarlo} />} />

// 3. Update table header, cells & modal title
<th className="py-3 px-6 font-bold">{isMonteCarlo ? 'Run Number' : 'Start Year'}</th>
<td className="py-4 px-6 font-bold text-gray-900">{isMonteCarlo ? `Run #${v.startYear}` : `${v.startYear} Cohort`}</td>
<h3 className="text-xl font-bold text-gray-900">{isMonteCarlo ? `Spending Trajectory: Run #${selectedRun.startYear}` : `Spending Trajectory: Cohort ${selectedRun.startYear}–${selectedRun.endYear}`}</h3>
```

#### `src/app/calculator/views/SimulationsListView.tsx`
```tsx
// 1. Define isMonteCarlo
const isMonteCarlo = config?.simulationMode === 'monte_carlo';

// 2. Update sort dropdown label, card title, modal header & modal table
<option value="date">{isMonteCarlo ? 'Run Number' : 'Date'}</option>
<span className="font-bold text-gray-900 text-base">{isMonteCarlo ? `Run #${run.startYear}` : `${run.startYear}–${run.endYear}`}</span>
<h3 className="text-xl font-bold text-gray-900">{isMonteCarlo ? `Simulation Details: Run #${selectedRun.startYear}` : `Simulation Details: Cohort ${selectedRun.startYear}–${selectedRun.endYear}`}</h3>
<th className="px-4 py-3 text-left">{isMonteCarlo ? 'Simulation Yr' : 'Calendar Yr'}</th>
<td className="px-4 py-3 text-gray-500">{isMonteCarlo ? `—` : yr.year}</td>
```

### R2. Data Assumptions View Update

#### `src/app/calculator/views/DataAssumptionsView.tsx`
```tsx
// 1. Import useSimulation and getAllMarketData
import { useSimulation } from '../../../SimulationProvider';
import { getAllMarketData } from '../../../lib/marketData';

// 2. Destructure config and update useMemo
export function DataAssumptionsView() {
  const { config } = useSimulation();
  // ...
  const historicalDataRows = useMemo(() => {
    const rows = Object.values(getAllMarketData(config?.marketDataMode || 'us'));
    // ...
  }, [sortOrder, yearFilter, config?.marketDataMode]);
```

---

## 5. Verification Method

To independently verify the changes once implemented, execute the following test suite from the root working directory (`/usr/local/google/home/duynguyenn/expense-dashboard`):

1. **Type Safety & Linting**:
   ```bash
   npx tsc --noEmit
   ```
2. **Unit Tests**:
   ```bash
   npm run test
   ```
3. **Production Build**:
   ```bash
   npm run build
   ```
4. **E2E & Feature Verification Scripts**:
   ```bash
   npx tsx e2e/verify_accumulation.ts
   npx tsx e2e/verify_monte_carlo.ts
   npx tsx e2e/run_e2e.ts
   ```

**Invalidation Conditions**: Any TypeScript compilation error, failing test, or visual overflow in the Recharts tooltips during Monte Carlo simulation invalidates this handoff.
