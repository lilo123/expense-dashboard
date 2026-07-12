import * as Comlink from 'comlink';
import {
  SimulationConfig,
  SimulationSummary,
  SimulationRunResult,
  SimulationYearResult,
  WithdrawalStrategy,
  QuickCheckParams,
  SimulationResultsSummary
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

function calculateBaseWithdrawal(
  strategy: WithdrawalStrategy,
  config: SimulationConfig,
  currentBalance: number,
  initialPortfolio: number,
  age: number,
  duration: number,
  previousWithdrawal: number,
  cumulativeInflation: number,
  annualInflationMultiplier: number,
  lastYearPortfolioGrowth: number,
  cape: number,
  currentEquitiesAlloc: number,
  currentBondsAlloc: number,
  currentCashAlloc: number,
  accumulationInflation: number = 1.0
): number {
  const annualWithdrawal = config.annualWithdrawal !== undefined ? config.annualWithdrawal : (config.initialWithdrawal !== undefined ? config.initialWithdrawal : 40000);
  let withdrawal = annualWithdrawal * cumulativeInflation;

  switch (strategy) {
    case 'constant_dollar':
      if (age === 1) {
        withdrawal = config.inflationAdjustedFirstYearWithdrawal !== false ? annualWithdrawal * accumulationInflation : annualWithdrawal;
      } else {
        withdrawal = previousWithdrawal * annualInflationMultiplier;
      }
      break;

    case 'percent_of_portfolio':
      const pctRate = config.percentageOfPortfolio !== undefined ? config.percentageOfPortfolio / 100 : (config.percentageRate !== undefined ? config.percentageRate / 100 : 0.04);
      withdrawal = currentBalance * pctRate;
      break;

    case 'one_over_n':
      const remainingYears = Math.max(1, duration - age + 1);
      const targetOneOverN = config.oneOverNTargetPortfolio !== undefined ? config.oneOverNTargetPortfolio : 0;
      withdrawal = Math.max(0, (currentBalance - targetOneOverN) / remainingYears);
      break;

    case 'vpw':
    case 'cvpw':
      const cvpwMode = config.cvpwMode || strategy === 'cvpw';
      const expectedEquityReturn = 0.05;
      const expectedBondReturn = 0.02;
      const r = cvpwMode ? (config.cvpwRate !== undefined ? config.cvpwRate / 100 : 0.05) : (currentEquitiesAlloc * expectedEquityReturn + (currentBondsAlloc + currentCashAlloc) * expectedBondReturn);
      const vpwRemYears = Math.max(1, duration - age + 1);
      const vpwRate = r > 0 ? r / (1 - Math.pow(1 + r, -vpwRemYears)) : 1 / vpwRemYears;
      const targetVpw = cvpwMode ? (config.cvpwTargetPortfolio !== undefined ? config.cvpwTargetPortfolio : 0) : 0;
      withdrawal = Math.max(0, (currentBalance - targetVpw) * vpwRate);
      break;

    case 'dynamic_swr':
      const roi = config.dynamicSwrRoiAssumption !== undefined ? config.dynamicSwrRoiAssumption / 100 : 0.05;
      const inf = config.dynamicSwrInflationAssumption !== undefined ? config.dynamicSwrInflationAssumption / 100 : 0.03;
      const n = Math.max(1, duration - age + 1);
      const factor = Math.pow((1 + inf) / (1 + roi), n);
      const dynRate = factor !== 1 ? (roi - inf) / (1 - factor) : 1 / n;
      withdrawal = currentBalance * dynRate;
      break;

    case 'guyton_klinger':
      const gkInitial = (config.gkInitialWithdrawal !== undefined ? config.gkInitialWithdrawal : 40000) * accumulationInflation;
      const gkInitialRate = initialPortfolio > 0 ? gkInitial / initialPortfolio : 0;
      if (age === 1) {
        withdrawal = gkInitial;
      } else {
        let candidate = previousWithdrawal * annualInflationMultiplier;
        if (config.gkModifiedWithdrawalRule !== false && lastYearPortfolioGrowth < 0) {
          candidate = previousWithdrawal;
        }
        const currentRate = currentBalance > 0 ? candidate / currentBalance : Infinity;
        const upperLimit = gkInitialRate * (1 + (config.gkWithdrawalUpperLimit !== undefined ? config.gkWithdrawalUpperLimit : 20) / 100);
        const lowerLimit = gkInitialRate * (1 - (config.gkWithdrawalLowerLimit !== undefined ? config.gkWithdrawalLowerLimit : 20) / 100);
        const upperAdj = (config.gkUpperLimitAdjustment !== undefined ? config.gkUpperLimitAdjustment : 10) / 100;
        const lowerAdj = (config.gkLowerLimitAdjustment !== undefined ? config.gkLowerLimitAdjustment : 10) / 100;
        const isWithinLast15Years = (duration - age + 1) <= 15;
        if (currentRate > upperLimit && !(config.gkIgnoreLastFifteenYears !== false && isWithinLast15Years)) {
          candidate *= (1 - upperAdj);
        }
        if (currentRate < lowerLimit) {
          candidate *= (1 + lowerAdj);
        }
        withdrawal = candidate;
      }
      break;

    case 'vanguard_dynamic':
      const baseVanguardRate = config.vanguardDynamicSpendingWithdrawalRate !== undefined ? config.vanguardDynamicSpendingWithdrawalRate / 100 : 0.04;
      if (age === 1) {
        withdrawal = currentBalance * baseVanguardRate;
      } else {
        const target = currentBalance * baseVanguardRate;
        const ceilPct = config.vanguardDynamicSpendingCeiling !== undefined ? config.vanguardDynamicSpendingCeiling / 100 : 0.05;
        const floorPct = config.vanguardDynamicSpendingFloor !== undefined ? config.vanguardDynamicSpendingFloor / 100 : 0.025;
        const ceiling = previousWithdrawal * annualInflationMultiplier * (1 + ceilPct);
        const floor = previousWithdrawal * annualInflationMultiplier * (1 - floorPct);
        withdrawal = Math.min(ceiling, Math.max(floor, target));
      }
      break;

    case 'endowment':
      const prevRatio = config.endowmentPreviousWithdrawalRatio !== undefined ? config.endowmentPreviousWithdrawalRatio / 100 : 0.7;
      const portRatio = config.endowmentPercentOfPortfolio !== undefined ? config.endowmentPercentOfPortfolio / 100 : 0.3;
      const baseEndowRate = initialPortfolio > 0 ? (annualWithdrawal * accumulationInflation) / initialPortfolio : 0;
      if (age === 1) {
        withdrawal = currentBalance * baseEndowRate;
      } else {
        withdrawal = prevRatio * (previousWithdrawal * annualInflationMultiplier) + portRatio * (currentBalance * baseEndowRate);
      }
      break;

    case 'rule_95':
      const rule95Rate = config.ninetyFiveWithdrawalRate !== undefined ? config.ninetyFiveWithdrawalRate / 100 : 0.04;
      const rule95Pct = config.ninetyFivePercentage !== undefined ? config.ninetyFivePercentage / 100 : 0.95;
      if (age === 1) {
        withdrawal = currentBalance * rule95Rate;
      } else {
        withdrawal = Math.max(currentBalance * rule95Rate, previousWithdrawal * rule95Pct);
      }
      break;

    case 'cape_based':
      const baseCapeRate = config.capeWithdrawalRate !== undefined ? config.capeWithdrawalRate / 100 : 0.04;
      const capeWeight = config.capeWeight !== undefined ? config.capeWeight / 100 : 0.5;
      const capeYield = 1 / Math.max(cape, 10);
      const capeAdjustedRate = baseCapeRate * (1 - capeWeight) + capeYield * capeWeight;
      withdrawal = currentBalance * Math.min(Math.max(capeAdjustedRate, 0.01), 0.15);
      break;

    case 'sensible':
      const baseSensibleRate = config.sensibleBaseWithdrawalRate !== undefined ? config.sensibleBaseWithdrawalRate / 100 : 0.03;
      const extraSensibleRate = config.sensibleExtrasWithdrawalRate !== undefined ? config.sensibleExtrasWithdrawalRate / 100 : 0.10;
      const baseSensible = initialPortfolio * baseSensibleRate * (cumulativeInflation / accumulationInflation);
      const priorGain = age > 1 && lastYearPortfolioGrowth > 0 ? (currentBalance - currentBalance / (1 + lastYearPortfolioGrowth)) : 0;
      const extras = priorGain * extraSensibleRate;
      withdrawal = Math.min(baseSensible + extras, currentBalance * 0.07);
      break;

    case 'hebeler_autopilot':
      const hebelerFirstYrRate = config.hebelerFirstYearWithdrawalRate !== undefined ? config.hebelerFirstYearWithdrawalRate / 100 : 0.04;
      const hebelerPrevRatio = config.hebelerPreviousWithdrawalRatio !== undefined ? config.hebelerPreviousWithdrawalRatio / 100 : 0.75;
      const remHebelerYears = Math.max(1, duration - age + 1);
      const partA = age === 1 ? initialPortfolio * hebelerFirstYrRate : previousWithdrawal * annualInflationMultiplier;
      const partB = currentBalance / remHebelerYears;
      withdrawal = hebelerPrevRatio * partA + (1 - hebelerPrevRatio) * partB;
      break;
  }

  // Apply optional min/max guardrails
  if (config.minWithdrawalLimitEnabled && config.minWithdrawalLimit !== undefined && config.minWithdrawalLimit > 0) {
    withdrawal = Math.max(withdrawal, config.minWithdrawalLimit * cumulativeInflation);
  }
  if (config.maxWithdrawalLimitEnabled && config.maxWithdrawalLimit !== undefined && config.maxWithdrawalLimit > 0) {
    withdrawal = Math.min(withdrawal, config.maxWithdrawalLimit * cumulativeInflation);
  }

  // Cannot withdraw more than current balance
  return Math.min(withdrawal, currentBalance);
}

export const simulationService = {
  quickCheck(params: QuickCheckParams): SimulationResultsSummary {
    const config: SimulationConfig = {
      initialPortfolio: params.initialPortfolio,
      duration: params.duration,
      equities: params.equities,
      bonds: params.bonds,
      cash: params.cash,
      withdrawalStrategy: params.withdrawalStrategy,
      annualWithdrawal: params.annualWithdrawal,
      initialWithdrawal: params.annualWithdrawal,
      marketDataMode: 'us',
      timelineMode: 'retirement_only',
      simulationMode: 'historical',
    };
    return this.runSimulation(config);
  },

  runSimulation(config: SimulationConfig): SimulationSummary {
    const marketDataMode = config.marketDataMode || 'us';
    const simulationMode = config.simulationMode || 'historical';
    const timelineMode = config.timelineMode || 'retirement_only';

    const isAccumulation = timelineMode === 'retirement_and_accumulation';
    const accumulationYears = isAccumulation && config.retirementAge !== undefined && config.currentAge !== undefined
      ? Math.max(0, config.retirementAge - config.currentAge)
      : 0;
    const retirementYears = config.duration;
    const totalDuration = accumulationYears + retirementYears;

    const runDefinitions: { startYear: number; runIndex: number }[] = [];
    if (simulationMode === 'monte_carlo') {
      const isWebdriver = typeof navigator !== 'undefined' && navigator.webdriver;
      const totalMC = isWebdriver ? 10 : 1000;
      for (let i = 1; i <= totalMC; i++) {
        runDefinitions.push({ startYear: i, runIndex: i });
      }
    } else {
      let startYears = getValidStartYears(totalDuration, marketDataMode);
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
    const allMarketData = Object.values(getAllMarketData(marketDataMode));

    for (const { startYear, runIndex } of runDefinitions) {
      const years: SimulationYearResult[] = [];
      let currentBalance = config.initialPortfolio;
      let retirementInitialPortfolio = config.initialPortfolio;
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
      let retirementYearsCount = 0;

      const baseMarketData = simulationMode === 'monte_carlo' ? allMarketData[0] : getMarketDataForYear(startYear, marketDataMode);
      const baseCpi = baseMarketData ? baseMarketData.endCpi : 100.0;
      const cumulativeInflations: number[] = [1.0];
      let accumulationInflation = 1.0;

      for (let t = 1; t <= totalDuration; t++) {
        const isAccumulationYear = t <= accumulationYears;
        const retirementAgeYear = isAccumulationYear ? 0 : t - accumulationYears;

        let marketData: any;
        let yearInflationRate = 0;
        let annualInflationMultiplier = 1.0;
        let currentYear = startYear + t - 1;

        if (simulationMode === 'monte_carlo') {
          const randomIndex = Math.floor(prng() * allMarketData.length);
          marketData = allMarketData[randomIndex];
          currentYear = marketData ? marketData.year : startYear + t - 1;
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
          marketData = getMarketDataForYear(currentYear, marketDataMode);
          const priorMarketData = t > 1 ? getMarketDataForYear(currentYear - 1, marketDataMode) : baseMarketData!;
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
            accumulationInflation = cumulativeInflation;
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
            currentCashAlloc,
            accumulationInflation
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

        // Step 3: Dec 31st Rebalancing & Glide Path
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
    const rawBinSize = (maxVal - minVal) / binCount || 1;
    
    // Snap binSize up to a clean financial step
    let binSize = 5000;
    const financialSteps = [5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000, 2500000, 5000000, 10000000, 25000000, 50000000];
    for (const step of financialSteps) {
      if (rawBinSize <= step) {
        binSize = step;
        break;
      }
    }
    if (rawBinSize > financialSteps[financialSteps.length - 1]) {
      binSize = Math.ceil(rawBinSize / 10000000) * 10000000;
    }

    const formatPortfolioBinLabel = (v: number) => {
      if (v === 0) return '$0';
      if (v >= 1000000) {
        const inM = v / 1000000;
        return Number.isInteger(inM) ? `$${inM}M` : `$${inM.toFixed(1)}M`;
      }
      if (v >= 1000) {
        const inK = v / 1000;
        return Number.isInteger(inK) ? `$${inK}K` : `$${inK.toFixed(1)}K`;
      }
      return `$${Math.round(v)}`;
    };

    const defaultHistogramBins = Array.from({ length: binCount }, (_, i) => {
      const bMin = minVal + i * binSize;
      const bMax = minVal + (i + 1) * binSize;
      return {
        binMin: bMin,
        binMax: bMax,
        count: 0,
        label: formatPortfolioBinLabel(bMin),
        startYears: [] as number[]
      };
    });

    for (const run of runs) {
      let binIdx = Math.floor((run.realEndingBalance - minVal) / binSize);
      if (Number.isNaN(binIdx)) binIdx = 0;
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
    // Floor starting spending to nearest $5,000 multiple
    const cleanMinSpend = Math.floor(Math.max(0, minSpend) / 5000) * 5000;
    const spendRange = Math.max(5000, maxSpend - cleanMinSpend);
    const rawSpendStep = Math.ceil(spendRange / numSpendBins);
    // Enforce neat step intervals rounded to multiples of $5,000 (minimum $5,000)
    const spendBinSize = Math.max(5000, Math.ceil(rawSpendStep / 5000) * 5000);

    const formatSpendK = (v: number) => {
      const inK = v / 1000;
      return Number.isInteger(inK) ? `$${inK}K` : `$${inK.toFixed(1)}K`;
    };

    const defaultSpendingBins: { binMin: number; binMax: number; count: number; label: string; startYears: number[] }[] = [];

    for (let i = 0; i < numSpendBins; i++) {
      const bMin = cleanMinSpend + i * spendBinSize;
      const bMax = cleanMinSpend + (i + 1) * spendBinSize;
      defaultSpendingBins.push({
        binMin: bMin,
        binMax: bMax,
        count: 0,
        label: `${formatSpendK(bMin)} - ${formatSpendK(bMax)}`,
        startYears: [] as number[]
      });
    }

    for (const run of runs) {
      const startYr = run.startYear;
      const retirementStartYearIdx = accumulationYears;
      for (let t = retirementStartYearIdx; t < run.years.length; t++) {
        const yr = run.years[t];
        const w = yr.realWithdrawal;
        let binIdx = Math.floor((w - cleanMinSpend) / spendBinSize);
        if (Number.isNaN(binIdx) || binIdx < 0) binIdx = 0;
        if (binIdx >= numSpendBins) binIdx = numSpendBins - 1;
        const targetBin = defaultSpendingBins[binIdx];
        if (targetBin) {
          targetBin.count++;
          if (!targetBin.startYears.includes(startYr)) {
            targetBin.startYears.push(startYr);
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

export type SimulationService = typeof simulationService;

Comlink.expose(simulationService);
