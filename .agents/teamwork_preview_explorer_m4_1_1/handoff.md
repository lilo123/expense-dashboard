# Handoff Report: M4 UI Inputs & Toggles Investigation

## 1. Observation
- **`src/app/calculator/CalculatorParams.tsx`**:
  - Lines 100-106 define the state and default values for the new features via `useQueryStates`:
    ```tsx
    marketDataMode: parseAsStringLiteral(['us', 'global'] as const).withDefault('us'),
    timelineMode: parseAsStringLiteral(['retirement_only', 'retirement_and_accumulation'] as const).withDefault('retirement_only'),
    currentAge: parseAsFloat.withDefault(30),
    retirementAge: parseAsFloat.withDefault(60),
    additionalContribution: parseAsFloat.withDefault(10000),
    simulationMode: parseAsStringLiteral(['historical', 'monte_carlo'] as const).withDefault('historical'),
    ```
  - Lines 108-130 set up `useForm<SimulationConfigSchemaType>` with `values: query` and a `useEffect` that updates `query` via `setQuery` whenever valid form values change.
  - Line 842 passes `query` directly to `SimulationProviderDynamic`: `<SimulationProviderDynamic initialConfig={query}>`.
  - Lines 145-810 contain `<form className="space-y-6">` but currently lack any JSX form controls for `marketDataMode`, `timelineMode`, `currentAge`, `retirementAge`, `additionalContribution`, and `simulationMode`.
- **`src/SimulationProvider.tsx`**:
  - Lines 21-29 define `SimulationProvider` which receives `initialConfig`, passes it to `useSimulationWorker(initialConfig)`, and provides the returned `simulationState` to `SimulationContext.Provider`.
- **`src/hooks/useSimulationWorker.ts`**:
  - Lines 18-49 define `useSimulationWorker(initialConfig)` with a `useEffect` dependent on `[initialConfig]`. Whenever `initialConfig` changes, it calls `worker.runSimulation(initialConfig)` and updates `result`.
- **`src/schemas/simulationSchema.ts`**:
  - Lines 140-147 contain a `.refine` validation rule for `timelineMode === 'retirement_and_accumulation'` ensuring `currentAge <= retirementAge`.

## 2. Logic Chain
1. **State Management & URL Synchronization**: Because `CalculatorParams.tsx` already includes `marketDataMode`, `timelineMode`, `currentAge`, `retirementAge`, `additionalContribution`, and `simulationMode` in `useQueryStates` and `useForm`, adding JSX form inputs registered to these names via `register` will automatically bind them to the form state, validate them against `simulationConfigSchema`, and update the URL query parameters upon change.
2. **Simulation Provider Forwarding**: Because `CalculatorParams.tsx` passes `query` to `<SimulationProviderDynamic initialConfig={query}>`, any updates to the form state are automatically propagated to `SimulationProvider`. `SimulationProvider` forwards `initialConfig` to `useSimulationWorker`, which re-runs the Web Worker simulation whenever `initialConfig` changes. Therefore, `src/SimulationProvider.tsx` is already fully implemented and requires zero changes.
3. **Global Market Data Toggle**: To allow users to switch between `us` and `global`, a radio button group registered to `marketDataMode` must be added to `CalculatorParams.tsx`.
4. **Simulation Mode Toggle**: To allow users to switch between `historical` and `monte_carlo`, a radio button group registered to `simulationMode` must be added to `CalculatorParams.tsx`.
5. **Accumulation Phase & Timeline Calculation Toggle**: To allow users to switch between `retirement_only` and `retirement_and_accumulation`, a radio button group registered to `timelineMode` must be added to `CalculatorParams.tsx`. Furthermore, input fields for `currentAge`, `retirementAge`, and `additionalContribution` must be added. To satisfy the requirement that these fields are disabled and greyed out in `Retirement Period Only`, we must check `formValues.timelineMode === 'retirement_only'` to set `disabled={true}` and apply greyed-out CSS classes (`bg-gray-200 text-gray-400 cursor-not-allowed`).

## 3. Caveats
- `DataAssumptionsView.tsx` is noted in `SCOPE.md` as needing an update to use `getAllMarketData(config.marketDataMode)`. While outside the specific focus of Explorer 1 (`CalculatorParams.tsx` and `SimulationProvider.tsx`), the implementer for M4 should ensure `DataAssumptionsView.tsx` is updated accordingly.
- No other caveats. All investigated files are fully type-safe and align perfectly with the Zod schema definitions.

## 4. Conclusion
### Recommended Fix Strategy
1. **`src/SimulationProvider.tsx`**: Make no changes. It is already fully functional and correctly passes `initialConfig` to the worker hook.
2. **`src/app/calculator/CalculatorParams.tsx`**: Insert the following JSX blocks inside `<form className="space-y-6">` (e.g., at line 146, immediately before `{/* Initial Portfolio */}`):

```tsx
          {/* Market Data Mode Toggle */}
          <div className="space-y-2 p-4 bg-gray-50 border border-gray-200 rounded-2xl">
            <h3 className="text-sm font-bold text-gray-900">Market Data Source</h3>
            <div className="grid grid-cols-2 gap-2">
              <label className={`flex items-center justify-center p-2.5 border rounded-xl cursor-pointer text-xs font-bold transition-colors ${
                formValues.marketDataMode === 'us'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}>
                <input type="radio" value="us" {...register('marketDataMode')} className="sr-only" />
                US Market (Shiller)
              </label>
              <label className={`flex items-center justify-center p-2.5 border rounded-xl cursor-pointer text-xs font-bold transition-colors ${
                formValues.marketDataMode === 'global'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}>
                <input type="radio" value="global" {...register('marketDataMode')} className="sr-only" />
                Global Market (MSCI)
              </label>
            </div>
          </div>

          {/* Simulation Mode Toggle */}
          <div className="space-y-2 p-4 bg-gray-50 border border-gray-200 rounded-2xl">
            <h3 className="text-sm font-bold text-gray-900">Simulation Mode</h3>
            <div className="grid grid-cols-2 gap-2">
              <label className={`flex items-center justify-center p-2.5 border rounded-xl cursor-pointer text-xs font-bold transition-colors text-center ${
                formValues.simulationMode === 'historical'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}>
                <input type="radio" value="historical" {...register('simulationMode')} className="sr-only" />
                Historical Backtesting
              </label>
              <label className={`flex items-center justify-center p-2.5 border rounded-xl cursor-pointer text-xs font-bold transition-colors text-center ${
                formValues.simulationMode === 'monte_carlo'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}>
                <input type="radio" value="monte_carlo" {...register('simulationMode')} className="sr-only" />
                Scrambled Monte Carlo
              </label>
            </div>
          </div>

          {/* Timeline Mode & Accumulation Inputs */}
          <div className="space-y-4 p-4 bg-gray-50 border border-gray-200 rounded-2xl">
            <h3 className="text-sm font-bold text-gray-900">Timeline & Accumulation</h3>
            <div className="grid grid-cols-1 gap-2">
              <label className={`flex items-center p-2.5 border rounded-xl cursor-pointer text-xs font-bold transition-colors ${
                formValues.timelineMode === 'retirement_only'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}>
                <input type="radio" value="retirement_only" {...register('timelineMode')} className="sr-only" />
                Retirement Period Only
              </label>
              <label className={`flex items-center p-2.5 border rounded-xl cursor-pointer text-xs font-bold transition-colors ${
                formValues.timelineMode === 'retirement_and_accumulation'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}>
                <input type="radio" value="retirement_and_accumulation" {...register('timelineMode')} className="sr-only" />
                Retirement & Accumulation Period
              </label>
            </div>

            <div className="space-y-3 pt-3 border-t border-gray-200">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className={`text-xs font-medium ${formValues.timelineMode === 'retirement_only' ? 'text-gray-400' : 'text-gray-700'}`}>Current Age</label>
                  <input
                    type="number"
                    disabled={formValues.timelineMode === 'retirement_only'}
                    {...register('currentAge', { valueAsNumber: true })}
                    value={Number.isNaN(formValues.currentAge) ? '' : formValues.currentAge}
                    className={`w-20 border text-xs rounded-lg p-1.5 text-right font-bold ${
                      formValues.timelineMode === 'retirement_only'
                        ? 'bg-gray-200 border-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500'
                    }`}
                  />
                </div>
                {errors.currentAge && (
                  <div className="text-xs text-red-600 mt-1">{errors.currentAge.message}</div>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className={`text-xs font-medium ${formValues.timelineMode === 'retirement_only' ? 'text-gray-400' : 'text-gray-700'}`}>Retirement Age</label>
                  <input
                    type="number"
                    disabled={formValues.timelineMode === 'retirement_only'}
                    {...register('retirementAge', { valueAsNumber: true })}
                    value={Number.isNaN(formValues.retirementAge) ? '' : formValues.retirementAge}
                    className={`w-20 border text-xs rounded-lg p-1.5 text-right font-bold ${
                      formValues.timelineMode === 'retirement_only'
                        ? 'bg-gray-200 border-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500'
                    }`}
                  />
                </div>
                {errors.retirementAge && (
                  <div className="text-xs text-red-600 mt-1">{errors.retirementAge.message}</div>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className={`text-xs font-medium ${formValues.timelineMode === 'retirement_only' ? 'text-gray-400' : 'text-gray-700'}`}>Additional Yearly Contributions ($)</label>
                  <input
                    type="number"
                    disabled={formValues.timelineMode === 'retirement_only'}
                    {...register('additionalContribution', { valueAsNumber: true })}
                    value={Number.isNaN(formValues.additionalContribution) ? '' : formValues.additionalContribution}
                    className={`w-28 border text-xs rounded-lg p-1.5 text-right font-bold ${
                      formValues.timelineMode === 'retirement_only'
                        ? 'bg-gray-200 border-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500'
                    }`}
                  />
                </div>
                {errors.additionalContribution && (
                  <div className="text-xs text-red-600 mt-1">{errors.additionalContribution.message}</div>
                )}
              </div>
            </div>
          </div>
```

## 5. Verification Method
After implementing the changes in `CalculatorParams.tsx`, verify the implementation using the following commands:
1. **Type Safety & Build**:
   - `npx tsc --noEmit`
   - `npm run build`
2. **Unit & Integration Tests**:
   - `npm run test`
3. **E2E Verification Scripts**:
   - `npx tsx e2e/verify_accumulation.ts`
   - `npx tsx e2e/verify_monte_carlo.ts`
   - `npx tsx e2e/run_e2e.ts`
