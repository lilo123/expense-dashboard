# Handoff Report: Milestone 3.1 - Simulation Engine Expansion (Accumulation & Monte Carlo)

## 1. Observation
During our exploration of the codebase for Milestone 3.1 (M3.1), we examined the following key files and observed their current structures and contracts:

- **`src/types/simulation.ts`**: Defines `SimulationConfig` (lines 25-123) which includes the optional fields `marketDataMode?: 'us' | 'global'`, `timelineMode?: 'retirement_only' | 'retirement_and_accumulation'`, `currentAge?: number`, `retirementAge?: number`, `additionalContribution?: number`, and `simulationMode?: 'historical' | 'monte_carlo'`.
- **`src/lib/marketData.ts`**: Exports `getMarketDataForYear(year: number, mode: 'us' | 'global' = 'us')` (lines 70-102), `getValidStartYears(duration: number, mode: 'us' | 'global' = 'us')` (lines 104-116), and `getAllMarketData(mode: 'us' | 'global' = 'us')` (lines 118-120). Each `MarketDataPoint` contains `startCpi` and `endCpi` to allow precise single-year inflation calculation.
- **`src/lib/globalMarketData.ts`**: Implements `createGlobalMarketData(shillerData)` (lines 70-100), providing MSCI World index data from 1970 to 2026.
- **`src/workers/simulation.worker.ts`**:
  - **Market Data Calls**: Currently calls `getValidStartYears(config.duration)` (line 180) and `getMarketDataForYear(startYear)` (line 207) without passing `config.marketDataMode`.
  - **Simulation Loop**: Iterates `for (let age = 1; age <= config.duration; age++)` (line 210), assuming `config.duration` is the total simulation length and that every year is a retirement withdrawal year.
  - **Withdrawal Calculation**: Calls `calculateBaseWithdrawal` (line 221) passing `config.initialPortfolio` as the initial portfolio base for withdrawal strategies.
  - **Supplemental Cash Flows**: Calculates `additionalIncome` and `extraWithdrawals` (lines 243-284) using `currentRetireeAge = retirementStartingAge + age - 1`.
  - **Yearly Aggregates & Buffers**: Loops `for (let age = 1; age <= config.duration; age++)` for `yearlyAggregates` (line 552) and allocates columnar buffers using `const totalYears = runs.length * config.duration;` (line 656).

## 2. Logic Chain
To satisfy the M3.1 requirements specified in `SCOPE.md` and `task.md`, we must make surgical, robust adjustments across `src/workers/simulation.worker.ts`:

1. **Market Data Mode Integration**:
   - `config.marketDataMode` (defaulting to `'us'`) must be passed as the second argument to all invocations of `getValidStartYears`, `getMarketDataForYear`, and `getAllMarketData`.

2. **Timeline Calculation Toggle (Accumulation Phase)**:
   - When `config.timelineMode === 'retirement_and_accumulation'`, the simulation consists of two distinct phases: an accumulation phase of length `accumulationYears = Math.max(0, config.retirementAge - config.currentAge)` followed by a retirement phase of length `config.duration`.
   - The total simulation duration is `totalDuration = accumulationYears + config.duration`. All loops (`age` loop, `yearlyAggregates` loop, and columnar buffer allocations) must use `totalDuration` rather than `config.duration`.
   - **During Accumulation (`age <= accumulationYears`)**: Withdrawals must be zero (`baseWithdrawal = 0`, `realWithdrawal = 0`). `config.additionalContribution` (defaulting to 0) must be added to `currentBalance`. Supplemental retirement cash flows (`additionalIncome`, `extraWithdrawals`) must not apply.
   - **Transition to Retirement (`age === accumulationYears + 1`)**: At the start of retirement, the portfolio balance has grown from `config.initialPortfolio` to a new accumulated balance. Withdrawal strategies that rely on the initial retirement portfolio (e.g., Guyton-Klinger, Endowment, Hebeler) must use this accumulated balance (`retirementInitialPortfolio`) rather than `config.initialPortfolio`.
   - **Spending Bins**: To prevent the $0 withdrawals during accumulation from skewing the retirement spending histogram (`defaultSpendingBins`), `minSpend`, `maxSpend`, and bin counts must be calculated using only retirement years (`yr.age > accumulationYears`).

3. **Simulation Mode Toggle (Scrambled Monte Carlo & Mulberry32 PRNG)**:
   - When `config.simulationMode === 'monte_carlo'`, the engine must generate exactly 1,000 unique simulation runs. We achieve this by defining synthetic start years `1` to `1,000`.
   - To ensure deterministic, reproducible results across page reloads, a seeded Mulberry32 PRNG must be initialized before the runs loop with a fixed seed (e.g., `123456789`).
   - For each year of a Monte Carlo run, the engine must randomly sample a historical year from the available dataset pool (`getAllMarketData(config.marketDataMode)`).
   - **Monte Carlo Inflation Handling**: Because sampled years are non-sequential, cumulative inflation cannot be calculated by dividing `marketData.endCpi / baseCpi`. Instead, each year's intrinsic inflation rate `(marketData.endCpi - marketData.startCpi) / marketData.startCpi` must be compounded annually (`cumulativeInflation *= (1 + yearInflationRate)`).
   - **Cash Flow Inflation (`when_starts`)**: By storing `cumulativeInflation` at each `age` in a `cumulativeInflations` array, cash flows with `inflationStart === 'when_starts'` can be correctly adjusted in both historical and Monte Carlo modes using `cumulativeInflation / cumulativeInflations[cfStartAge]`.

## 3. Caveats
- **Seed Selection**: We recommend using `123456789` as the fixed seed for Mulberry32 to guarantee reproducibility. If a different fixed seed is preferred by the team, it can be substituted without affecting the logic.
- **Synthetic Start Years in Monte Carlo**: In Monte Carlo mode, `run.startYear` will be assigned values `1` to `1000`. This perfectly satisfies the `defaultHistogramBins` and `defaultSpendingBins` logic which uses `startYears` to track run IDs.

## 4. Conclusion
We recommend implementing M3.1 in `src/workers/simulation.worker.ts` using the following concrete, drop-in strategy.

### Helper Function: Mulberry32 PRNG
Add the Mulberry32 generator at the top of `src/workers/simulation.worker.ts` (e.g., below the imports):
```typescript
function getMulberry32(seed: number) {
  let a = seed;
  return function(): number {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

### Main Simulation Logic (`runSimulation`)
Update `runSimulation` in `src/workers/simulation.worker.ts` as follows:

```typescript
export const simulationService = {
  runSimulation(config: SimulationConfig): SimulationSummary {
    const marketDataMode = config.marketDataMode || 'us';
    const simulationMode = config.simulationMode || 'historical';
    const timelineMode = config.timelineMode || 'retirement_only';

    const accumulationYears = timelineMode === 'retirement_and_accumulation' && config.retirementAge !== undefined && config.currentAge !== undefined
      ? Math.max(0, config.retirementAge - config.currentAge)
      : 0;
    const totalDuration = accumulationYears + config.duration;

    let startYears: number[] = [];
    let prng: () => number = () => 0;
    let allMarketData: Record<number, any> = {};
    let availableMarketYears: number[] = [];

    if (simulationMode === 'monte_carlo') {
      const totalMonteCarloRuns = 1000;
      startYears = Array.from({ length: totalMonteCarloRuns }, (_, i) => i + 1);
      prng = getMulberry32(123456789);
      allMarketData = getAllMarketData(marketDataMode);
      availableMarketYears = Object.keys(allMarketData).map(Number).sort((a, b) => a - b);
    } else {
      startYears = getValidStartYears(totalDuration, marketDataMode);
      if (config.startYearMin !== undefined) {
        startYears = startYears.filter(y => y >= config.startYearMin!);
      }
      if (config.startYearMax !== undefined) {
        startYears = startYears.filter(y => y <= config.startYearMax!);
      }
    }

    const runs: SimulationRunResult[] = [];
    let successfulRuns = 0;
    const endingBalances: number[] = [];

    for (const startYear of startYears) {
      const years: SimulationYearResult[] = [];
      let currentBalance = config.initialPortfolio;
      const annualWithdrawal = config.annualWithdrawal !== undefined ? config.annualWithdrawal : (config.initialWithdrawal !== undefined ? config.initialWithdrawal : 40000);
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
      const cumulativeInflations: number[] = [1.0];

      let baseMarketData = simulationMode === 'historical' ? getMarketDataForYear(startYear, marketDataMode) : null;
      let baseCpi = baseMarketData ? baseMarketData.endCpi : 1.0;

      for (let age = 1; age <= totalDuration; age++) {
        let marketData: any;
        let yearInflationRate = 0;
        let annualInflationMultiplier = 1.0;
        let currentYear = startYear + age - 1;

        if (simulationMode === 'monte_carlo') {
          const sampledYear = availableMarketYears[Math.floor(prng() * availableMarketYears.length)];
          marketData = allMarketData[sampledYear];
          currentYear = sampledYear;
          yearInflationRate = (marketData.endCpi - marketData.startCpi) / marketData.startCpi;
          annualInflationMultiplier = age > 1 ? 1 + yearInflationRate : 1.0;
          cumulativeInflation = age === 1 ? 1.0 : cumulativeInflation * annualInflationMultiplier;
        } else {
          marketData = getMarketDataForYear(currentYear, marketDataMode);
          const priorMarketData = age > 1 ? getMarketDataForYear(currentYear - 1, marketDataMode) : baseMarketData!;
          yearInflationRate = (marketData.endCpi - priorMarketData.endCpi) / priorMarketData.endCpi;
          cumulativeInflation = marketData.endCpi / baseCpi;
          annualInflationMultiplier = age > 1 ? marketData.endCpi / priorMarketData.endCpi : 1.0;
        }
        cumulativeInflations[age] = cumulativeInflation;

        const startBalance = currentBalance;
        let baseWithdrawal = 0;
        let totalIncome = 0;
        let totalExtraWithdrawals = 0;
        let realWithdrawal = 0;

        if (age <= accumulationYears) {
          const additionalContribution = config.additionalContribution !== undefined ? config.additionalContribution : 0;
          currentBalance += additionalContribution;
          baseWithdrawal = 0;
          realWithdrawal = 0;
          previousWithdrawal = annualWithdrawal;
        } else {
          const retirementYear = age - accumulationYears;
          baseWithdrawal = calculateBaseWithdrawal(
            config.withdrawalStrategy,
            config,
            currentBalance,
            retirementInitialPortfolio,
            retirementYear,
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

          const retirementStartingAge = config.retirementAge !== undefined ? config.retirementAge : (config.retirementStartingAge !== undefined ? config.retirementStartingAge : 60);
          const currentRetireeAge = retirementStartingAge + retirementYear - 1;

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
                    const cfStartAge = accumulationYears + cf.startYearOffset + 1;
                    const baseCfInflation = cumulativeInflations[cfStartAge] || 1.0;
                    amount *= (cumulativeInflation / baseCfInflation);
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
                    const cfStartAge = accumulationYears + cf.startYearOffset + 1;
                    const baseCfInflation = cumulativeInflations[cfStartAge] || 1.0;
                    amount *= (cumulativeInflation / baseCfInflation);
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

          if (currentBalance <= 0 && retirementYear < config.duration) {
            isSuccessful = false;
          }
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

        if (age === accumulationYears) {
          retirementInitialPortfolio = currentBalance;
        }

        const realEndBalance = currentBalance / cumulativeInflation;

        years.push({
          year: currentYear,
          age,
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
        if (config.rebalancePortfolio !== false && age % rebalanceFreq === 0) {
          let targetEq = config.equities / 100.0;
          let targetBnd = config.bonds / 100.0;
          let targetCsh = config.cash / 100.0;

          if (config.glidePath && config.targetEquities !== undefined && config.glidePathDuration !== undefined && config.glidePathDuration > 0) {
            if (age <= config.glidePathDuration) {
              const initialEquities = config.equities / 100.0;
              const finalEquities = config.targetEquities / 100.0;
              const t = age / config.glidePathDuration;
              
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

    // (Keep existing statistical calculations lines 423-541 unchanged)

    // Update yearlyAggregates loop to use totalDuration
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

    // (Keep defaultHistogramBins lines 587-608 unchanged)

    // Update defaultSpendingBins to filter out accumulation years
    let maxSpend = -Infinity;
    let minSpend = Infinity;
    for (const run of runs) {
      for (const yr of run.years) {
        if (yr.age > accumulationYears) {
          if (yr.realWithdrawal > maxSpend) maxSpend = yr.realWithdrawal;
          if (yr.realWithdrawal < minSpend) minSpend = yr.realWithdrawal;
        }
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
      for (const yr of run.years) {
        if (yr.age > accumulationYears) {
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
    }

    // Update columnar buffers to use totalDuration
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
After the implementer applies the recommended changes to `src/workers/simulation.worker.ts`, verify the implementation using the following commands:

1. **TypeScript Type Check**:
   ```bash
   npx tsc --noEmit
   ```
   *Expected Result*: Zero errors, confirming all contracts and buffer types align.

2. **Unit & Integration Tests**:
   ```bash
   npm run test
   ```
   *Expected Result*: All tests pass successfully.

3. **Production Build Check**:
   ```bash
   npm run build
   ```
   *Expected Result*: Successful Next.js build with no worker bundling or linting errors.
