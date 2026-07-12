# Handoff Report: M3.1 (Implement Accumulation & Monte Carlo)

## 1. Observation
During our exploration of the codebase for Milestone 3.1, we directly observed the following from the key files:

- **`src/workers/simulation.worker.ts`**:
  - Lines 180-186: `getValidStartYears(config.duration)` is called without passing `config.marketDataMode`. It also does not account for accumulation years in `config.duration`.
  - Lines 207-218: `getMarketDataForYear(startYear)` and `getMarketDataForYear(currentYear)` are called without `config.marketDataMode`.
  - Lines 210-396: The simulation loop iterates `for (let age = 1; age <= config.duration; age++)`, assuming `config.duration` represents only retirement years, with no accumulation phase logic.
  - Lines 243-283: `additionalIncome` and `extraWithdrawals` use `startYear + cf.startYearOffset` to determine the cash flow start year and calculate inflation adjustments using `getMarketDataForYear(cfStartYear)`.
  - Lines 445-541: Statistical metrics (`volatileSpendingCount`, `largeSpendingCount`, `stdDevAllYearsSpending`, etc.) iterate over all `run.years`, assuming every year is a retirement withdrawal year.
  - Lines 656-672: Columnar buffers (`balancesBuffer`, `withdrawalsBuffer`, `growthBuffer`) allocate `runs.length * config.duration` Float64 entries.

- **`src/lib/marketData.ts`**:
  - Lines 70-102: `export function getMarketDataForYear(year: number, mode: 'us' | 'global' = 'us'): MarketDataPoint` correctly supports `mode`.
  - Lines 104-116: `export function getValidStartYears(duration: number, mode: 'us' | 'global' = 'us'): number[]` correctly supports `mode`.
  - Lines 118-120: `export function getAllMarketData(mode: 'us' | 'global' = 'us'): Record<number, MarketDataPoint>` correctly supports `mode`.

- **`src/lib/globalMarketData.ts`**:
  - Lines 70-100: `createGlobalMarketData` correctly merges annual MSCI World returns (1970–2026) with US Shiller data (used as a proxy for CPI, CAPE, bonds, and dividends).

- **`src/types/simulation.ts` & `src/schemas/simulationSchema.ts`**:
  - Define `marketDataMode?: 'us' | 'global'`, `timelineMode?: 'retirement_only' | 'retirement_and_accumulation'`, `currentAge`, `retirementAge`, `additionalContribution`, and `simulationMode?: 'historical' | 'monte_carlo'`.

## 2. Logic Chain
1. **Market Data Mode Integration**: Since `getValidStartYears`, `getMarketDataForYear`, and `getAllMarketData` in `src/lib/marketData.ts` already accept `mode: 'us' | 'global'`, `simulation.worker.ts` must pass `config.marketDataMode || 'us'` to all these function calls.
2. **Timeline Calculation Toggle**:
   - When `config.timelineMode === 'retirement_and_accumulation'`, the simulation must prepend an accumulation phase of `accumulationYears = config.retirementAge - config.currentAge` years before the `config.duration` retirement phase.
   - The total simulation duration becomes `totalDuration = accumulationYears + config.duration`. `getValidStartYears` must be called with `totalDuration` to ensure enough historical years exist for the full run.
   - During the accumulation phase (`yearIdx <= accumulationYears`), withdrawals must be bypassed (`baseWithdrawal = 0`, `realWithdrawal = 0`), `config.additionalContribution` must be added to `currentBalance`, and market returns compounded.
   - During the retirement phase (`yearIdx > accumulationYears`), `calculateBaseWithdrawal` must be called with `retirementYearIdx = yearIdx - accumulationYears`. To ensure withdrawal strategies (e.g., Guyton-Klinger, Endowment) calculate correct initial withdrawal rates, `retirementInitialPortfolio` must be captured at `retirementYearIdx === 1`.
3. **Simulation Mode Toggle (Scrambled Monte Carlo)**:
   - When `config.simulationMode === 'monte_carlo'`, the worker must generate exactly 1,000 runs using a seeded Mulberry32 PRNG (`mulberry32(12345)`) to ensure deterministic, reproducible results.
   - Instead of iterating over historical `startYears`, the worker iterates over 1,000 synthetic run definitions (assigning synthetic start years e.g., `2025 + i` for bin tracking).
   - For each year in a Monte Carlo run, a random `MarketDataPoint` is sampled from `getAllMarketData(marketDataMode)`.
   - **Critical CPI Handling**: In Monte Carlo mode, absolute `endCpi` values cannot be used directly from randomly sampled years (as jumping between distant years would cause extreme artificial inflation/deflation). Instead, the annual inflation rate `(sampled.endCpi - sampled.startCpi) / sampled.startCpi` must be compounded onto a synthetic `currentCpi` (starting at 100.0). A `cpiHistory` array must track this progression to allow correct inflation adjustments for `additionalIncome` and `extraWithdrawals`.
4. **Statistical Metrics & Buffer Adjustments**:
   - Spending statistics (`volatileSpendingCount`, `largeSpendingCount`, `stdDevAllYearsSpending`, `averageLifetimeSpend`, etc.) must be calculated exclusively over retirement years (`run.years.slice(accumulationYears)`), as including accumulation years (where withdrawals are 0) would distort the metrics.
   - Columnar buffers and `yearlyAggregates` must be sized and iterated using `totalDuration` to correctly transfer the full simulation timeline back to the UI.

## 3. Caveats
- **Assumptions**: We assume `config.additionalContribution` is added at the beginning of each accumulation year (Step 1) prior to end-of-year growth/inflation compounding (Step 2). We assume `startYear` for Monte Carlo runs can be assigned synthetically (`2025 + i`) so that histogram and spending bins can uniquely identify and group runs.
- **Scope**: No changes are required in `src/lib/marketData.ts`, `src/lib/globalMarketData.ts`, or `src/types/simulation.ts`, as their contracts already fully support M3.1 requirements.

## 4. Conclusion
We recommend a surgical, unified loop refactoring of `src/workers/simulation.worker.ts`. By unifying the simulation loop across both historical and Monte Carlo modes, we eliminate code duplication while cleanly supporting `marketDataMode`, `timelineMode`, and `simulationMode`.

### Recommended Implementation for `src/workers/simulation.worker.ts`

```typescript
// Add Mulberry32 PRNG helper at the top of the file
function mulberry32(a: number) {
  return function() {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

```typescript
// Replace runSimulation in simulationService
export const simulationService = {
  runSimulation(config: SimulationConfig): SimulationSummary {
    const marketDataMode = config.marketDataMode || 'us';
    const simulationMode = config.simulationMode || 'historical';
    const timelineMode = config.timelineMode || 'retirement_only';

    const accumulationYears = timelineMode === 'retirement_and_accumulation' && config.retirementAge !== undefined && config.currentAge !== undefined
      ? Math.max(0, config.retirementAge - config.currentAge)
      : 0;
    const totalDuration = accumulationYears + config.duration;

    let runDefinitions: { startYear: number; isMonteCarlo: boolean }[] = [];
    let allMarketData: MarketDataPoint[] = [];
    let prng: () => number = () => 0;

    if (simulationMode === 'historical') {
      let startYears = getValidStartYears(totalDuration, marketDataMode);
      if (config.startYearMin !== undefined) {
        startYears = startYears.filter(y => y >= config.startYearMin!);
      }
      if (config.startYearMax !== undefined) {
        startYears = startYears.filter(y => y <= config.startYearMax!);
      }
      runDefinitions = startYears.map(startYear => ({ startYear, isMonteCarlo: false }));
    } else {
      prng = mulberry32(12345);
      allMarketData = Object.values(getAllMarketData(marketDataMode));
      runDefinitions = Array.from({ length: 1000 }, (_, i) => ({ startYear: 2025 + i, isMonteCarlo: true }));
    }

    const runs: SimulationRunResult[] = [];
    let successfulRuns = 0;
    const endingBalances: number[] = [];

    for (const { startYear, isMonteCarlo } of runDefinitions) {
      const years: SimulationYearResult[] = [];
      let currentBalance = config.initialPortfolio;
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

      let retirementInitialPortfolio = config.initialPortfolio;

      const baseMarketData = !isMonteCarlo ? getMarketDataForYear(startYear, marketDataMode) : null;
      const baseCpi = !isMonteCarlo ? baseMarketData!.endCpi : 100.0;

      let currentCpi = 100.0;
      const cpiHistory: number[] = [baseCpi];

      for (let yearIdx = 1; yearIdx <= totalDuration; yearIdx++) {
        const isAccumulation = yearIdx <= accumulationYears;
        const retirementYearIdx = yearIdx - accumulationYears;

        let marketData: MarketDataPoint;
        let yearInflationRate: number;
        let annualInflationMultiplier: number;

        if (!isMonteCarlo) {
          const currentYear = startYear + yearIdx - 1;
          marketData = getMarketDataForYear(currentYear, marketDataMode);
          const priorMarketData = yearIdx > 1 ? getMarketDataForYear(currentYear - 1, marketDataMode) : baseMarketData!;
          yearInflationRate = (marketData.endCpi - priorMarketData.endCpi) / priorMarketData.endCpi;
          cumulativeInflation = marketData.endCpi / baseCpi;
          annualInflationMultiplier = yearIdx > 1 ? marketData.endCpi / priorMarketData.endCpi : 1.0;
          cpiHistory.push(marketData.endCpi);
        } else {
          const randomIndex = Math.floor(prng() * allMarketData.length);
          marketData = allMarketData[randomIndex];
          yearInflationRate = (marketData.endCpi - marketData.startCpi) / marketData.startCpi;
          const priorCpi = currentCpi;
          currentCpi = priorCpi * (1 + yearInflationRate);
          cumulativeInflation = currentCpi / 100.0;
          annualInflationMultiplier = 1 + yearInflationRate;
          cpiHistory.push(currentCpi);
        }

        // Step 1: Jan 1st Withdrawals & Supplemental Cash Flows
        let baseWithdrawal = 0;
        let totalIncome = 0;
        let totalExtraWithdrawals = 0;
        const startBalance = currentBalance;

        if (isAccumulation) {
          currentBalance += (config.additionalContribution || 0);
        } else {
          if (retirementYearIdx === 1) {
            retirementInitialPortfolio = currentBalance;
          }

          baseWithdrawal = calculateBaseWithdrawal(
            config.withdrawalStrategy,
            config,
            currentBalance,
            retirementInitialPortfolio,
            retirementYearIdx,
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
          const currentRetireeAge = retirementStartingAge + retirementYearIdx - 1;

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
                    const cfStartCpi = cpiHistory[accumulationYears + cf.startYearOffset] || cpiHistory[0];
                    const currentYearCpi = !isMonteCarlo ? marketData.endCpi : currentCpi;
                    amount *= (currentYearCpi / cfStartCpi);
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
                    const cfStartCpi = cpiHistory[accumulationYears + cf.startYearOffset] || cpiHistory[0];
                    const currentYearCpi = !isMonteCarlo ? marketData.endCpi : currentCpi;
                    amount *= (currentYearCpi / cfStartCpi);
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
        }

        const realWithdrawal = baseWithdrawal / cumulativeInflation;
        totalRealWithdrawal += realWithdrawal;

        if (currentBalance <= 0 && yearIdx < totalDuration) {
          isSuccessful = false;
        }

        // Step 2: Dec 31st Growth & Inflation
        const equitiesFee = config.equitiesFee !== undefined ? config.equitiesFee / 100 : 0.0004;
        const bondsFee = config.bondsFee !== undefined ? config.bondsFee / 100 : 0.0005;
        const cashGrowthRate = config.cashGrowthRate !== undefined ? config.cashGrowthRate / 100 : 0.015;

        const stockGrowth = marketData.stockMarketGrowth + marketData.dividendYields - equitiesFee;
        const bondGrowth = marketData.bondsGrowth - bondsFee;
        const cashGrowth = cashGrowthRate;

        totalStocksReturn += (marketData.stockMarketGrowth + marketData.dividendYields);

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
          year: !isMonteCarlo ? startYear + yearIdx - 1 : startYear + yearIdx - 1,
          age: yearIdx,
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

        // Step 3: Dec 31st Rebalancing & Glide Path
        const rebalanceFreq = config.rebalanceFrequency !== undefined ? config.rebalanceFrequency : 1;
        if (config.rebalancePortfolio !== false && yearIdx % rebalanceFreq === 0) {
          let targetEq = config.equities / 100.0;
          let targetBnd = config.bonds / 100.0;
          let targetCsh = config.cash / 100.0;

          if (config.glidePath && config.targetEquities !== undefined && config.glidePathDuration !== undefined && config.glidePathDuration > 0) {
            if (yearIdx <= config.glidePathDuration) {
              const initialEquities = config.equities / 100.0;
              const finalEquities = config.targetEquities / 100.0;
              const t = yearIdx / config.glidePathDuration;
              
              let progress = t;
              if (config.glidePathPace === 'slowly') {
                progress = t * t;
              } else if (config.glidePathPace === 'quickly') {
                progress = t * (2 - t);
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

      const avgStocksReturn = totalStocksReturn / totalDuration;
      const avgRealWithdrawal = totalRealWithdrawal / config.duration;

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
      
      const retirementYears = run.years.slice(accumulationYears);
      const w_1 = retirementYears[0] ? retirementYears[0].realWithdrawal : 0;

      for (let t = 0; t < retirementYears.length; t++) {
        const w_it = retirementYears[t].realWithdrawal;
        runLifetimeSpend += w_it;
        sumAllYearsSpending += w_it;
        totalSpendingPoints++;

        if (w_it >= 1.5 * w_1) {
          hasLarge = true;
        }
        if (w_it <= 0.5 * w_1) {
          hasSmall = true;
        }

        if (t >= 1) {
          const w_prev = retirementYears[t - 1].realWithdrawal;
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
      const runAvgSpend = retirementYears.length > 0 ? runLifetimeSpend / retirementYears.length : 0;
      sumRunAverageSpending += runAvgSpend;
    }

    const volatileSpendingPercentage = totalRuns > 0 ? (volatileSpendingCount / totalRuns) * 100 : 0;
    const largeSpendingPercentage = totalRuns > 0 ? (largeSpendingCount / totalRuns) * 100 : 0;
    const smallSpendingPercentage = totalRuns > 0 ? (smallSpendingCount / totalRuns) * 100 : 0;
    const largeEndPortfolioPercentage = totalRuns > 0 ? (largeEndPortfolioCount / totalRuns) * 100 : 0;
    const smallEndPortfolioPercentage = totalRuns > 0 ? (smallEndPortfolioCount / totalRuns) * 100 : 0;
    const zeroPortfolioPercentage = totalRuns > 0 ? (zeroPortfolioCount / totalRuns) * 100 : 0;
    const averageLifetimeSpend = totalRuns > 0 ? totalLifetimeSpend / totalRuns : 0;

    const meanEndingBalance = totalRuns > 0 ? sumEndingBalance / totalRuns : 0;
    const meanAllYearsSpending = totalSpendingPoints > 0 ? sumAllYearsSpending / totalSpendingPoints : 0;
    const meanRunAverageSpending = totalRuns > 0 ? sumRunAverageSpending / totalRuns : 0;

    let sqSumEndingBalance = 0;
    let sqSumAllYearsSpending = 0;
    let sqSumRunAverageSpending = 0;

    for (const run of runs) {
      sqSumEndingBalance += Math.pow(run.realEndingBalance - meanEndingBalance, 2);
      
      let runLifetimeSpend = 0;
      const retirementYears = run.years.slice(accumulationYears);
      for (const year of retirementYears) {
        sqSumAllYearsSpending += Math.pow(year.realWithdrawal - meanAllYearsSpending, 2);
        runLifetimeSpend += year.realWithdrawal;
      }

      const runAvgSpend = retirementYears.length > 0 ? runLifetimeSpend / retirementYears.length : 0;
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

    let maxSpend = -Infinity;
    let minSpend = Infinity;
    for (const run of runs) {
      const retirementYears = run.years.slice(accumulationYears);
      for (const yr of retirementYears) {
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
      const retirementYears = run.years.slice(accumulationYears);
      for (const yr of retirementYears) {
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
```

## 5. Verification Method
To independently verify the recommended implementation once applied:
1. **Type & Lint Check**: Run `npx tsc --noEmit` to verify TypeScript compilation and ensure all types/contracts are respected.
2. **Unit Tests**: Run `npm run test` to verify that existing simulation tests pass and that the new accumulation and Monte Carlo behaviors function correctly.
3. **Build Check**: Run `npm run build` to verify production bundling of the Web Worker and Next.js application.
4. **Invalidation Conditions**: If `npm run test` fails due to unexpected buffer sizes or mismatched withdrawal calculations during accumulation, inspect `totalDuration` and `retirementYears` slicing logic.
