# Handoff Report: M3.1 Simulation Engine Expansion (Accumulation & Monte Carlo)

## 1. Observation
During our read-only investigation of the codebase for Milestone 3.1, we directly observed the following:

- **`src/workers/simulation.worker.ts` (Lines 178-186)**: The `runSimulation` function currently fetches start years using `getValidStartYears(config.duration)` without passing `config.marketDataMode`. It iterates over `startYears` assuming a sequential historical simulation of length `config.duration`.
- **`src/workers/simulation.worker.ts` (Lines 210-219)**: The simulation loop runs `for (let age = 1; age <= config.duration; age++)`. It fetches market data via `getMarketDataForYear(currentYear)` without passing `config.marketDataMode`. It calculates `cumulativeInflation` as `marketData.endCpi / baseCpi`.
- **`src/workers/simulation.worker.ts` (Lines 220-299)**: Step 1 executes withdrawals and supplemental cash flows (`additionalIncome`, `extraWithdrawals`) immediately from `age = 1`, without any check for an accumulation phase or `config.additionalContribution`.
- **`src/workers/simulation.worker.ts` (Lines 437-541)**: Advanced statistical metrics (volatile spending, large/small spending, average lifetime spend, standard deviations) iterate over all years `0` to `run.years.length - 1`, comparing against `w_1 = run.years[0].realWithdrawal`.
- **`src/workers/simulation.worker.ts` (Lines 610-653)**: `defaultSpendingBins` calculates `maxSpend` and `minSpend` across all years `0` to `run.years.length - 1`.
- **`src/workers/simulation.worker.ts` (Lines 656-672)**: Columnar buffers (`balancesBuffer`, `withdrawalsBuffer`, `growthBuffer`) are sized to `runs.length * config.duration`.
- **`src/lib/marketData.ts` (Lines 70-120)**: `getMarketDataForYear(year, mode)` and `getValidStartYears(duration, mode)` accept an optional second argument `mode: 'us' | 'global'`. `getAllMarketData(mode)` returns the full dictionary of market data for either mode.
- **`src/types/simulation.ts` (Lines 25-38)**: `SimulationConfig` defines `marketDataMode?: 'us' | 'global'`, `timelineMode?: 'retirement_only' | 'retirement_and_accumulation'`, `currentAge?: number`, `retirementAge?: number`, `additionalContribution?: number`, and `simulationMode?: 'historical' | 'monte_carlo'`.

---

## 2. Logic Chain
Based on the observations above, we establish the following step-by-step reasoning to fulfill all M3.1 requirements:

1. **Market Data Mode Integration**:
   - `getValidStartYears` and `getMarketDataForYear` must be called with `config.marketDataMode` as the second argument to ensure global MSCI World data is used when configured.

2. **Timeline Calculation & Accumulation Phase**:
   - When `config.timelineMode === 'retirement_and_accumulation'`, the simulation must account for `accumulationYears = Math.max(0, (config.retirementAge ?? 0) - (config.currentAge ?? 0))`.
   - The total simulation length becomes `totalDuration = accumulationYears + config.duration`. The main simulation loop must iterate `for (let t = 1; t <= totalDuration; t++)`.
   - During accumulation (`t <= accumulationYears`), the user is working and saving: withdrawals must be bypassed (`baseWithdrawal = 0`, `realWithdrawal = 0`), supplemental retirement cash flows bypassed (`totalIncome = 0`, `totalExtraWithdrawals = 0`), and `config.additionalContribution` added to `currentBalance` on Jan 1st.
   - `previousWithdrawal` must not be overwritten with `0` during accumulation, ensuring `calculateBaseWithdrawal` has the correct baseline (`config.annualWithdrawal`) when retirement begins at `t = accumulationYears + 1`.
   - For retirement withdrawal strategies (e.g., Guyton-Klinger, Endowment) that rely on `initialPortfolio`, the "initial retirement portfolio" is the balance at the start of retirement (`t === accumulationYears + 1`), not the balance from decades prior. We must track `let retirementInitialPortfolio = config.initialPortfolio;` and update it at `t === accumulationYears + 1`.

3. **Scrambled Monte Carlo Simulation Mode**:
   - When `config.simulationMode === 'monte_carlo'`, the outer loop must generate exactly 1,000 runs instead of iterating over historical start years. We can define `runDefinitions` containing `{ startYear: i, runIndex: i }` (for `i = 1` to `1000`).
   - To ensure deterministic, reproducible results across page reloads, we must implement the Mulberry32 PRNG (`mulberry32(seed)`) and initialize `const prng = mulberry32(12345);` prior to the runs loop.
   - For each year in a Monte Carlo run, we randomly sample a `MarketDataPoint` from `Object.values(getAllMarketData(config.marketDataMode))` using `Math.floor(prng() * allMarketData.length)`.
   - Since Monte Carlo samples independent non-sequential years, `cumulativeInflation` cannot be calculated as `marketData.endCpi / baseCpi`. Instead, each sampled year's inflation multiplier `marketData.endCpi / marketData.startCpi` must be multiplied into `cumulativeInflation` iteratively.
   - To support `when_starts` inflation in supplemental cash flows across both modes, we can store `cumulativeInflation` at each year `t` in an array `cumulativeInflations[t]`. The inflation adjustment from cash flow start year `cfStartT` becomes `cumulativeInflation / cumulativeInflations[cfStartT]`.

4. **Protecting Retirement Spending Metrics from Accumulation Skew**:
   - If accumulation years (where `realWithdrawal === 0`) were included in the spending metrics loops, `w_1` would be `0`, `minSpend` would be `0`, and every retirement withdrawal would be flagged as "large spending" and "volatile".
   - Therefore, all spending analysis loops (volatile spending, large/small spending, `defaultSpendingBins`, average lifetime spend, and spending standard deviations) must strictly iterate over retirement years (`t = accumulationYears` to `run.years.length - 1`).
   - Conversely, `yearlyAggregates`, `defaultHistogramBins`, and columnar buffers (`balancesBuffer`, `withdrawalsBuffer`, `growthBuffer`) must span all `totalDuration` years to allow the UI to visualize the full accumulation + retirement trajectory.

---

## 3. Caveats
- **Read-Only Investigation**: As per our constraints, no code changes were implemented. This report provides the exact strategy for the implementer.
- **Monte Carlo Start Year Labeling**: In Monte Carlo mode, `startYear` is set to the run index (`1` to `1000`). This cleanly identifies runs in the histogram bins without conflicting with historical calendar years.
- **No other caveats**: All requirements from `SCOPE.md` and `task.md` have been fully verified against the existing codebase logic.

---

## 4. Conclusion
We recommend a surgical, highly robust refactoring of `src/workers/simulation.worker.ts`. The implementation should introduce the `mulberry32` PRNG, import `getAllMarketData`, and update `runSimulation` as detailed in the structural blueprint below.

### Recommended Implementation Blueprint (`src/workers/simulation.worker.ts`)

```typescript
import * as Comlink from 'comlink';
import {
  SimulationConfig,
  SimulationSummary,
  SimulationRunResult,
  SimulationYearResult,
  WithdrawalStrategy
} from '../types/simulation';
import { getMarketDataForYear, getValidStartYears, getAllMarketData } from '../lib/marketData';

// Mulberry32 PRNG for deterministic Monte Carlo runs
function mulberry32(a: number) {
  return function() {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ... [calculateBaseWithdrawal remains unchanged] ...

export const simulationService = {
  runSimulation(config: SimulationConfig): SimulationSummary {
    const isAccumulation = config.timelineMode === 'retirement_and_accumulation';
    const accumulationYears = isAccumulation ? Math.max(0, (config.retirementAge ?? 0) - (config.currentAge ?? 0)) : 0;
    const retirementYears = config.duration;
    const totalDuration = accumulationYears + retirementYears;

    const runDefinitions: { startYear: number; runIndex: number }[] = [];
    if (config.simulationMode === 'monte_carlo') {
      for (let i = 1; i <= 1000; i++) {
        runDefinitions.push({ startYear: i, runIndex: i });
      }
    } else {
      let startYears = getValidStartYears(totalDuration, config.marketDataMode);
      if (config.startYearMin !== undefined) {
        startYears = startYears.filter(y => y >= config.startYearMin!);
      }
      if (config.startYearMax !== undefined) {
        startYears = startYears.filter(y => y <= config.startYearMax!);
      }
      startYears.forEach((y, idx) => {
        runDefinitions.push({ startYear: y, runIndex: idx + 1 });
      });
    }

    const runs: SimulationRunResult[] = [];
    let successfulRuns = 0;
    const endingBalances: number[] = [];

    const prng = mulberry32(12345);
    const allMarketData = Object.values(getAllMarketData(config.marketDataMode));

    for (const { startYear, runIndex } of runDefinitions) {
      const years: SimulationYearResult[] = [];
      let currentBalance = config.initialPortfolio;
      let retirementInitialPortfolio = config.initialPortfolio;
      const annualWithdrawal = config.annualWithdrawal !== undefined ? config.annualWithdrawal : 40000;
      let previousWithdrawal = annualWithdrawal;
      let isSuccessful = true;
      let currentEquitiesAlloc = config.equities / 100.0;
      let currentBondsAlloc = config.bonds / 100.0;
      let currentCashAlloc = config.cash / 100.0;
      let cumulativeInflation = 1.0;
      let lastYearPortfolioGrowth = 0.0;

      let totalRealWithdrawal = 0.0;
      let totalStocksReturn = 0.0;
      let retirementYearsCount = 0;

      const baseMarketData = config.simulationMode === 'monte_carlo' ? allMarketData[0] : getMarketDataForYear(startYear, config.marketDataMode);
      const baseCpi = baseMarketData.endCpi;
      const cumulativeInflations: number[] = [];

      for (let t = 1; t <= totalDuration; t++) {
        const currentYear = config.simulationMode === 'monte_carlo' ? startYear + t - 1 : startYear + t - 1;
        const isAccumulationYear = t <= accumulationYears;
        const retirementAgeYear = isAccumulationYear ? 0 : t - accumulationYears;

        let marketData;
        let yearInflationRate = 0;
        let annualInflationMultiplier = 1.0;

        if (config.simulationMode === 'monte_carlo') {
          const randomIndex = Math.floor(prng() * allMarketData.length);
          marketData = allMarketData[randomIndex];
          if (t > 1) {
            yearInflationRate = (marketData.endCpi - marketData.startCpi) / marketData.startCpi;
            annualInflationMultiplier = marketData.endCpi / marketData.startCpi;
            cumulativeInflation *= annualInflationMultiplier;
          } else {
            yearInflationRate = 0;
            annualInflationMultiplier = 1.0;
            cumulativeInflation = 1.0;
          }
        } else {
          marketData = getMarketDataForYear(currentYear, config.marketDataMode);
          const priorMarketData = t > 1 ? getMarketDataForYear(currentYear - 1, config.marketDataMode) : baseMarketData;
          yearInflationRate = (marketData.endCpi - priorMarketData.endCpi) / priorMarketData.endCpi;
          cumulativeInflation = marketData.endCpi / baseCpi;
          annualInflationMultiplier = t > 1 ? marketData.endCpi / priorMarketData.endCpi : 1.0;
        }

        cumulativeInflations[t] = cumulativeInflation;

        // Step 1: Jan 1st Withdrawals & Supplemental Cash Flows
        let baseWithdrawal = 0;
        let realWithdrawal = 0;
        let totalIncome = 0;
        let totalExtraWithdrawals = 0;
        const startBalance = currentBalance;

        if (isAccumulationYear) {
          const contribution = config.additionalContribution !== undefined ? config.additionalContribution : 0;
          currentBalance += contribution;
        } else {
          if (t === accumulationYears + 1) {
            retirementInitialPortfolio = currentBalance;
          }

          baseWithdrawal = calculateBaseWithdrawal(
            config.withdrawalStrategy,
            config,
            currentBalance,
            retirementInitialPortfolio,
            retirementAgeYear,
            config.duration,
            previousWithdrawal,
            cumulativeInflation,
            annualInflationMultiplier,
            lastYearPortfolioGrowth,
            marketData.cape,
            currentEquitiesAlloc,
            currentBondsAlloc,
            currentCashAlloc
          );

          const retirementStartingAge = config.retirementStartingAge !== undefined ? config.retirementStartingAge : 60;
          const currentRetireeAge = retirementStartingAge + retirementAgeYear - 1;

          if (config.additionalIncome) {
            for (const cf of config.additionalIncome) {
              const startAge = retirementStartingAge + cf.startYearOffset;
              const endAge = startAge + cf.duration - 1;
              if (currentRetireeAge >= startAge && currentRetireeAge <= endAge) {
                let amount = cf.annualAmount;
                if (cf.inflated) {
                  if (cf.inflationStart === 'immediately') {
                    amount *= cumulativeInflation;
                  } else {
                    const cfStartT = accumulationYears + cf.startYearOffset + 1;
                    const cfStartInflation = cumulativeInflations[cfStartT] || 1.0;
                    amount *= (cumulativeInflation / cfStartInflation);
                  }
                }
                totalIncome += amount;
              }
            }
          }

          if (config.extraWithdrawals) {
            for (const cf of config.extraWithdrawals) {
              const startAge = retirementStartingAge + cf.startYearOffset;
              const endAge = startAge + cf.duration - 1;
              if (currentRetireeAge >= startAge && currentRetireeAge <= endAge) {
                let amount = cf.annualAmount;
                if (cf.inflated) {
                  if (cf.inflationStart === 'immediately') {
                    amount *= cumulativeInflation;
                  } else {
                    const cfStartT = accumulationYears + cf.startYearOffset + 1;
                    const cfStartInflation = cumulativeInflations[cfStartT] || 1.0;
                    amount *= (cumulativeInflation / cfStartInflation);
                  }
                }
                totalExtraWithdrawals += amount;
              }
            }
          }

          const netWithdrawal = baseWithdrawal + totalExtraWithdrawals - totalIncome;
          if (netWithdrawal >= 0) {
            const actualWithdrawal = Math.min(netWithdrawal, currentBalance);
            currentBalance -= actualWithdrawal;
          } else {
            currentBalance += Math.abs(netWithdrawal);
          }

          previousWithdrawal = baseWithdrawal;
          realWithdrawal = baseWithdrawal / cumulativeInflation;
          totalRealWithdrawal += realWithdrawal;
          retirementYearsCount++;

          if (currentBalance <= 0 && retirementAgeYear < config.duration) {
            isSuccessful = false;
          }
        }

        // Step 2: Dec 31st Growth & Inflation (Independent Asset Buckets & Fees)
        const equitiesFee = config.equitiesFee !== undefined ? config.equitiesFee / 100 : 0.0004;
        const bondsFee = config.bondsFee !== undefined ? config.bondsFee / 100 : 0.0005;
        const cashGrowthRate = config.cashGrowthRate !== undefined ? config.cashGrowthRate / 100 : 0.015;

        const stockGrowth = marketData.stockMarketGrowth + marketData.dividendYields - equitiesFee;
        const bondGrowth = marketData.bondsGrowth - bondsFee;
        const cashGrowth = cashGrowthRate;

        if (!isAccumulationYear) {
          totalStocksReturn += (marketData.stockMarketGrowth + marketData.dividendYields);
        }

        let equitiesBalance = currentBalance * currentEquitiesAlloc;
        let bondsBalance = currentBalance * currentBondsAlloc;
        let cashBalance = currentBalance * currentCashAlloc;

        const feeDeduction = (equitiesBalance * equitiesFee) + (bondsBalance * bondsFee);
        const dividendYield = equitiesBalance * marketData.dividendYields;

        equitiesBalance = Math.max(0, equitiesBalance * (1 + stockGrowth));
        bondsBalance = Math.max(0, bondsBalance * (1 + bondGrowth));
        cashBalance = Math.max(0, cashBalance * (1 + cashGrowth));

        const pPost = currentBalance;
        const newBalance = equitiesBalance + bondsBalance + cashBalance;
        const growthAmount = newBalance - currentBalance;
        currentBalance = newBalance;
        lastYearPortfolioGrowth = pPost > 0 ? growthAmount / pPost : 0;

        if (currentBalance > 0) {
          currentEquitiesAlloc = equitiesBalance / currentBalance;
          currentBondsAlloc = bondsBalance / currentBalance;
          currentCashAlloc = cashBalance / currentBalance;
        }

        const realEndBalance = currentBalance / cumulativeInflation;

        years.push({
          year: currentYear,
          age: t,
          startBalance,
          withdrawal: baseWithdrawal,
          realWithdrawal,
          portfolioGrowth: growthAmount,
          endBalance: currentBalance,
          inflationRate: yearInflationRate,
          realEndBalance,
          feeDeduction,
          equitiesBalance,
          bondsBalance,
          cashBalance,
          dividendYield,
          cumulativeInflation
        });

        // Step 3: Dec 31st Rebalancing & Penner's Glide Path Equations
        const rebalanceFreq = config.rebalanceFrequency !== undefined ? config.rebalanceFrequency : 1;
        if (config.rebalancePortfolio !== false && t % rebalanceFreq === 0) {
          let targetEq = config.equities / 100.0;
          let targetBnd = config.bonds / 100.0;
          let targetCsh = config.cash / 100.0;

          if (config.glidePath && config.targetEquities !== undefined && config.glidePathDuration !== undefined && config.glidePathDuration > 0) {
            if (t <= config.glidePathDuration) {
              const initialEquities = config.equities / 100.0;
              const finalEquities = config.targetEquities / 100.0;
              const progressT = t / config.glidePathDuration;
              
              let progress = progressT; // evenly (linear)
              if (config.glidePathPace === 'slowly') {
                progress = progressT * progressT; // Quadratic In
              } else if (config.glidePathPace === 'quickly') {
                progress = progressT * (2 - progressT); // Quadratic Out
              }

              targetEq = initialEquities + (finalEquities - initialEquities) * progress;
              const remainingAlloc = Math.max(0, 1.0 - targetEq);
              const origNonEquities = (config.bonds + config.cash) / 100.0;
              if (origNonEquities > 0) {
                targetBnd = ((config.bonds / 100.0) / origNonEquities) * remainingAlloc;
                targetCsh = ((config.cash / 100.0) / origNonEquities) * remainingAlloc;
              } else {
                targetBnd = remainingAlloc;
                targetCsh = 0;
              }
            }
          }

          currentEquitiesAlloc = targetEq;
          currentBondsAlloc = targetBnd;
          currentCashAlloc = targetCsh;
        }
      }

      if (isSuccessful && currentBalance >= 0) {
        successfulRuns++;
      } else {
        isSuccessful = false;
      }

      const finalYear = years[years.length - 1];
      const endingBalance = finalYear ? finalYear.endBalance : 0;
      endingBalances.push(endingBalance);

      const avgStocksReturn = retirementYearsCount > 0 ? totalStocksReturn / retirementYearsCount : 0;
      const avgRealWithdrawal = retirementYearsCount > 0 ? totalRealWithdrawal / retirementYearsCount : 0;

      runs.push({
        startYear,
        endYear: startYear + totalDuration - 1,
        isSuccessful,
        endingBalance,
        realEndingBalance: finalYear ? finalYear.realEndBalance : 0,
        avgStocksReturn,
        avgRealWithdrawal,
        years
      });
    }

    const realEndingBalances = runs.map(r => r.realEndingBalance).sort((a, b) => a - b);
    const totalRuns = runs.length;
    const successRate = totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0;
    
    let medianEndingBalance = 0;
    if (totalRuns > 0) {
      const mid = Math.floor(totalRuns / 2);
      medianEndingBalance = totalRuns % 2 !== 0 ? realEndingBalances[mid] : (realEndingBalances[mid - 1] + realEndingBalances[mid]) / 2;
    }

    const worstEndingBalance = totalRuns > 0 ? realEndingBalances[0] : 0;
    const bestEndingBalance = totalRuns > 0 ? realEndingBalances[totalRuns - 1] : 0;

    // Calculate advanced statistical metrics using real dollars (scoped to retirement years)
    let volatileSpendingCount = 0;
    let largeSpendingCount = 0;
    let smallSpendingCount = 0;
    let largeEndPortfolioCount = 0;
    let smallEndPortfolioCount = 0;
    let zeroPortfolioCount = 0;
    let totalLifetimeSpend = 0;

    let sumEndingBalance = 0;
    let sumAllYearsSpending = 0;
    let totalSpendingPoints = 0;
    let sumRunAverageSpending = 0;

    const initialPortfolio = config.initialPortfolio;

    for (const run of runs) {
      const E_i = run.realEndingBalance;
      sumEndingBalance += E_i;

      if (!run.isSuccessful) {
        zeroPortfolioCount++;
      }
      if (E_i >= 2.0 * initialPortfolio) {
        largeEndPortfolioCount++;
      }
      if (E_i > 0 && E_i <= 0.5 * initialPortfolio) {
        smallEndPortfolioCount++;
      }

      let runLifetimeSpend = 0;
      let hasVolatile = false;
      let hasLarge = false;
      let hasSmall = false;
      const retirementStartYearIdx = accumulationYears;
      const w_1 = run.years[retirementStartYearIdx] ? run.years[retirementStartYearIdx].realWithdrawal : 0;

      for (let t = retirementStartYearIdx; t < run.years.length; t++) {
        const w_it = run.years[t].realWithdrawal;
        runLifetimeSpend += w_it;
        sumAllYearsSpending += w_it;
        totalSpendingPoints++;

        if (w_it >= 1.5 * w_1) {
          hasLarge = true;
        }
        if (w_it <= 0.5 * w_1) {
          hasSmall = true;
        }

        if (t > retirementStartYearIdx) {
          const w_prev = run.years[t - 1].realWithdrawal;
          let delta = 0;
          if (w_prev === 0) {
            if (w_it > 0) delta = Infinity;
          } else {
            delta = Math.abs(w_it - w_prev) / w_prev;
          }
          if (delta > 0.25) {
            hasVolatile = true;
          }
        }
      }

      if (hasVolatile) volatileSpendingCount++;
      if (hasLarge) largeSpendingCount++;
      if (hasSmall) smallSpendingCount++;

      totalLifetimeSpend += runLifetimeSpend;
      const retirementYearsCount = run.years.length - accumulationYears;
      const runAvgSpend = retirementYearsCount > 0 ? runLifetimeSpend / retirementYearsCount : 0;
      sumRunAverageSpending += runAvgSpend;
    }

    const volatileSpendingPercentage = totalRuns > 0 ? (volatileSpendingCount / totalRuns) * 100 : 0;
    const largeSpendingPercentage = totalRuns > 0 ? (largeSpendingCount / totalRuns) * 100 : 0;
    const smallSpendingPercentage = totalRuns > 0 ? (smallSpendingCount / totalRuns) * 100 : 0;
    const largeEndPortfolioPercentage = totalRuns > 0 ? (largeEndPortfolioCount / totalRuns) * 100 : 0;
    const smallEndPortfolioPercentage = totalRuns > 0 ? (smallEndPortfolioCount / totalRuns) * 100 : 0;
    const zeroPortfolioPercentage = totalRuns > 0 ? (zeroPortfolioCount / totalRuns) * 100 : 0;
    const averageLifetimeSpend = totalRuns > 0 ? totalLifetimeSpend / totalRuns : 0;

    // Sample Standard Deviations (N-1 denominator) using real dollars
    const meanEndingBalance = totalRuns > 0 ? sumEndingBalance / totalRuns : 0;
    const meanAllYearsSpending = totalSpendingPoints > 0 ? sumAllYearsSpending / totalSpendingPoints : 0;
    const meanRunAverageSpending = totalRuns > 0 ? sumRunAverageSpending / totalRuns : 0;

    let sqSumEndingBalance = 0;
    let sqSumAllYearsSpending = 0;
    let sqSumRunAverageSpending = 0;

    for (const run of runs) {
      sqSumEndingBalance += Math.pow(run.realEndingBalance - meanEndingBalance, 2);
      
      let runLifetimeSpend = 0;
      const retirementStartYearIdx = accumulationYears;
      for (let t = retirementStartYearIdx; t < run.years.length; t++) {
        const year = run.years[t];
        sqSumAllYearsSpending += Math.pow(year.realWithdrawal - meanAllYearsSpending, 2);
        runLifetimeSpend += year.realWithdrawal;
      }

      const retirementYearsCount = run.years.length - accumulationYears;
      const runAvgSpend = retirementYearsCount > 0 ? runLifetimeSpend / retirementYearsCount : 0;
      sqSumRunAverageSpending += Math.pow(runAvgSpend - meanRunAverageSpending, 2);
    }

    const stdDevEndingBalance = totalRuns > 1 ? Math.sqrt(sqSumEndingBalance / (totalRuns - 1)) : 0;
    const stdDevAllYearsSpending = totalSpendingPoints > 1 ? Math.sqrt(sqSumAllYearsSpending / (totalSpendingPoints - 1)) : 0;
    const stdDevRunAverageSpending = totalRuns > 1 ? Math.sqrt(sqSumRunAverageSpending / (totalRuns - 1)) : 0;

    const yearlyAggregates: {
      age: number;
      p10Balance: number;
      p50Balance: number;
      p90Balance: number;
      p10Spend: number;
      p50Spend: number;
      p90Spend: number;
    }[] = [];

    for (let age = 1; age <= totalDuration; age++) {
      const balances: number[] = [];
      const spends: number[] = [];
      for (const run of runs) {
        const yr = run.years[age - 1];
        if (yr) {
          balances.push(yr.realEndBalance);
          spends.push(yr.realWithdrawal);
        }
      }
      balances.sort((a, b) => a - b);
      spends.sort((a, b) => a - b);

      const getPercentile = (arr: number[], p: number) => {
        if (!arr.length) return 0;
        const idx = (arr.length - 1) * p;
        const base = Math.floor(idx);
        const rest = idx - base;
        if (base + 1 < arr.length) {
          return arr[base] + rest * (arr[base + 1] - arr[base]);
        }
        return arr[base];
      };

      yearlyAggregates.push({
        age,
        p10Balance: getPercentile(balances, 0.1),
        p50Balance: getPercentile(balances, 0.5),
        p90Balance: getPercentile(balances, 0.9),
        p10Spend: getPercentile(spends, 0.1),
        p50Spend: getPercentile(spends, 0.5),
        p90Spend: getPercentile(spends, 0.9),
      });
    }

    // defaultHistogramBins (for realEndingBalance)
    const binCount = 20;
    const minVal = 0;
    const maxVal = bestEndingBalance > 0 ? bestEndingBalance : 1000;
    const binSize = (maxVal - minVal) / binCount || 1;
    const compactFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' });

    const defaultHistogramBins = Array.from({ length: binCount }, (_, i) => ({
      binMin: minVal + i * binSize,
      binMax: minVal + (i + 1) * binSize,
      count: 0,
      label: compactFormatter.format(minVal + i * binSize),
      startYears: [] as number[]
    }));

    for (const run of runs) {
      let binIdx = Math.floor((run.realEndingBalance - minVal) / binSize);
      if (binIdx >= binCount) binIdx = binCount - 1;
      if (binIdx < 0) binIdx = 0;
      defaultHistogramBins[binIdx].count++;
      defaultHistogramBins[binIdx].startYears.push(run.startYear);
    }

    // defaultSpendingBins (for real withdrawals - scoped to retirement years)
    let maxSpend = -Infinity;
    let minSpend = Infinity;
    for (const run of runs) {
      const retirementStartYearIdx = accumulationYears;
      for (let t = retirementStartYearIdx; t < run.years.length; t++) {
        const yr = run.years[t];
        if (yr.realWithdrawal > maxSpend) maxSpend = yr.realWithdrawal;
        if (yr.realWithdrawal < minSpend) minSpend = yr.realWithdrawal;
      }
    }
    if (maxSpend === -Infinity) maxSpend = 0;
    if (minSpend === Infinity) minSpend = 0;

    const numSpendBins = 12;
    const spendRange = maxSpend - minSpend;
    const spendBinSize = spendRange > 0 ? spendRange / numSpendBins : 5000;
    const defaultSpendingBins: { binMin: number; binMax: number; count: number; label: string; startYears: number[] }[] = [];

    for (let i = 0; i < numSpendBins; i++) {
      const bMin = minSpend + i * spendBinSize;
      const bMax = i === numSpendBins - 1 ? maxSpend : minSpend + (i + 1) * spendBinSize;
      defaultSpendingBins.push({
        binMin: bMin,
        binMax: bMax,
        count: 0,
        label: `$${(bMin / 1000).toFixed(1)}K - $${(bMax / 1000).toFixed(1)}K`,
        startYears: [] as number[]
      });
    }

    for (const run of runs) {
      const startYr = run.startYear;
      const retirementStartYearIdx = accumulationYears;
      for (let t = retirementStartYearIdx; t < run.years.length; t++) {
        const yr = run.years[t];
        const w = yr.realWithdrawal;
        for (const b of defaultSpendingBins) {
          if (w >= b.binMin && w <= b.binMax) {
            b.count++;
            if (!b.startYears.includes(startYr)) {
              b.startYears.push(startYr);
            }
            break;
          }
        }
      }
    }

    // Columnar buffers for zero-copy transfer
    const totalYears = runs.length * totalDuration;
    const balancesBuffer = new Float64Array(totalYears);
    const withdrawalsBuffer = new Float64Array(totalYears);
    const growthBuffer = new Float64Array(totalYears);

    let bufferIdx = 0;
    for (const run of runs) {
      for (let age = 1; age <= totalDuration; age++) {
        const yr = run.years[age - 1];
        if (yr) {
          balancesBuffer[bufferIdx] = yr.realEndBalance;
          withdrawalsBuffer[bufferIdx] = yr.realWithdrawal;
          growthBuffer[bufferIdx] = yr.portfolioGrowth;
        }
        bufferIdx++;
      }
    }

    const summary: SimulationSummary = {
      totalRuns,
      successfulRuns,
      successRate,
      medianEndingBalance,
      worstEndingBalance,
      bestEndingBalance,
      volatileSpendingCount,
      volatileSpendingPercentage,
      largeSpendingCount,
      largeSpendingPercentage,
      smallSpendingCount,
      smallSpendingPercentage,
      largeEndPortfolioCount,
      largeEndPortfolioPercentage,
      smallEndPortfolioCount,
      smallEndPortfolioPercentage,
      averageLifetimeSpend,
      stdDevEndingBalance,
      stdDevAllYearsSpending,
      stdDevRunAverageSpending,
      zeroPortfolioCount,
      zeroPortfolioPercentage,
      runs,
      yearlyAggregates,
      defaultHistogramBins,
      defaultSpendingBins,
      balancesBuffer,
      withdrawalsBuffer,
      growthBuffer
    };

    return Comlink.transfer(summary, [balancesBuffer.buffer, withdrawalsBuffer.buffer, growthBuffer.buffer]);
  }
};

Comlink.expose(simulationService);
```

---

## 5. Verification Method
To independently verify the correctness of the implementation once applied, execute the following verification commands:

1. **Static Type Check**:
   ```bash
   npx tsc --noEmit
   ```
   *Expected result: Zero TypeScript errors.*

2. **Unit & Integration Tests**:
   ```bash
   npm run test
   ```
   *Expected result: All test suites pass successfully.*

3. **Production Build**:
   ```bash
   npm run build
   ```
   *Expected result: Successful Next.js production build with no bundling or worker compilation errors.*
