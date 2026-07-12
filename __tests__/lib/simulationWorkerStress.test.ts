import { simulationService } from '@/workers/simulation.worker';
import { SimulationConfig } from '@/types/simulation';
import { getMarketDataForYear } from '@/lib/marketData';

describe('Simulation Worker - Empirical Stress & Correctness Verification', () => {
  // 1. Verify Retirement & Accumulation Period logic
  it('correctly applies zero withdrawals, adds contributions, and compounds returns during accumulation', () => {
    const config: SimulationConfig = {
      initialPortfolio: 100000,
      initialWithdrawal: 40000,
      duration: 30,
      withdrawalStrategy: 'constant_dollar',
      equities: 60,
      bonds: 40,
      cash: 0,
      timelineMode: 'retirement_and_accumulation',
      currentAge: 50,
      retirementAge: 60, // 10 years of accumulation
      additionalContribution: 15000,
      marketDataMode: 'us',
      simulationMode: 'historical',
      startYearMin: 1970,
      startYearMax: 1970,
    };

    const summary = simulationService.runSimulation(config);
    expect(summary.runs.length).toBeGreaterThan(0);

    const run = summary.runs[0];
    expect(run.years.length).toBe(40); // 10 accumulation + 30 retirement

    // Oracle verification for accumulation years (years 1 to 10)
    let expectedBalance = 100000;
    for (let t = 1; t <= 10; t++) {
      const yearResult = run.years[t - 1];
      expect(yearResult.withdrawal).toBe(0);
      expect(yearResult.realWithdrawal).toBe(0);

      // Verify contribution was added before growth
      const startBalance = expectedBalance + 15000;
      
      // Calculate expected growth
      const marketData = getMarketDataForYear(1970 + t - 1, 'us');
      const equitiesFee = 0.0004;
      const bondsFee = 0.0005;
      const stockGrowth = marketData.stockMarketGrowth + marketData.dividendYields - equitiesFee;
      const bondGrowth = marketData.bondsGrowth - bondsFee;

      let eq = startBalance * 0.60;
      let bnd = startBalance * 0.40;
      eq = Math.max(0, eq * (1 + stockGrowth));
      bnd = Math.max(0, bnd * (1 + bondGrowth));
      expectedBalance = eq + bnd;

      expect(yearResult.endBalance).toBeCloseTo(expectedBalance, 2);
    }

    // Verify first retirement year (year 11) has withdrawals
    const firstRetirementYear = run.years[10];
    expect(firstRetirementYear.withdrawal).toBeGreaterThan(0);
  });

  // 2. Verify Scrambled Monte Carlo determinism and run count (1,000 runs)
  it('generates exactly 1,000 simulation runs in Monte Carlo mode and is deterministic across invocations', () => {
    const config: SimulationConfig = {
      initialPortfolio: 1000000,
      initialWithdrawal: 40000,
      duration: 30,
      withdrawalStrategy: 'constant_dollar',
      equities: 80,
      bonds: 20,
      cash: 0,
      timelineMode: 'retirement_only',
      marketDataMode: 'global',
      simulationMode: 'monte_carlo',
    };

    const summary1 = simulationService.runSimulation(config);
    expect(summary1.totalRuns).toBe(1000);
    expect(summary1.runs.length).toBe(1000);

    const summary2 = simulationService.runSimulation(config);
    expect(summary2.totalRuns).toBe(1000);
    expect(summary2.runs.length).toBe(1000);

    // Verify exact match between summary1 and summary2 (determinism)
    expect(summary1.medianEndingBalance).toBe(summary2.medianEndingBalance);
    expect(summary1.successRate).toBe(summary2.successRate);
    expect(summary1.runs[0].endingBalance).toBe(summary2.runs[0].endingBalance);
    expect(summary1.runs[999].endingBalance).toBe(summary2.runs[999].endingBalance);
  });

  // 3. Stress-test edge cases (Minimal, Maximal, Degenerate, Boundary values)
  it('robustly handles extreme edge cases without throwing errors or producing NaN', () => {
    const edgeCases: SimulationConfig[] = [
      // Minimal duration & zero accumulation
      {
        initialPortfolio: 10000,
        initialWithdrawal: 1000,
        duration: 1,
        withdrawalStrategy: 'constant_dollar',
        equities: 100,
        bonds: 0,
        cash: 0,
        timelineMode: 'retirement_only',
        marketDataMode: 'us',
        simulationMode: 'historical',
      },
      // Maximal duration & large accumulation
      {
        initialPortfolio: 5000000,
        initialWithdrawal: 100000,
        duration: 50,
        withdrawalStrategy: 'guyton_klinger',
        equities: 50,
        bonds: 30,
        cash: 20,
        timelineMode: 'retirement_and_accumulation',
        currentAge: 20,
        retirementAge: 70, // 50 years accumulation, 50 years retirement = 100 years total
        additionalContribution: 50000,
        marketDataMode: 'global',
        simulationMode: 'monte_carlo',
      },
      // Degenerate zero values
      {
        initialPortfolio: 0,
        initialWithdrawal: 0,
        duration: 30,
        withdrawalStrategy: 'vpw',
        equities: 0,
        bonds: 0,
        cash: 100,
        timelineMode: 'retirement_and_accumulation',
        currentAge: 40,
        retirementAge: 40, // 0 years accumulation
        additionalContribution: 0,
        marketDataMode: 'us',
        simulationMode: 'monte_carlo',
      },
      // Extreme market crash scenario / high withdrawal
      {
        initialPortfolio: 100000,
        initialWithdrawal: 90000, // 90% withdrawal rate
        duration: 30,
        withdrawalStrategy: 'constant_dollar',
        equities: 100,
        bonds: 0,
        cash: 0,
        timelineMode: 'retirement_only',
        marketDataMode: 'global',
        simulationMode: 'historical',
      },
    ];

    for (const config of edgeCases) {
      const summary = simulationService.runSimulation(config);
      expect(summary.runs.length).toBeGreaterThan(0);
      expect(isNaN(summary.successRate)).toBe(false);
      expect(isNaN(summary.medianEndingBalance)).toBe(false);
      expect(summary.balancesBuffer).toBeDefined();
      expect(summary.withdrawalsBuffer).toBeDefined();
      expect(summary.growthBuffer).toBeDefined();
    }
  });

  // 4. Performance Testing (TLE/MLE Prevention)
  it('completes a full 1,000 run Monte Carlo simulation with 60-year total duration within performance limits', () => {
    const config: SimulationConfig = {
      initialPortfolio: 1000000,
      initialWithdrawal: 40000,
      duration: 40,
      withdrawalStrategy: 'constant_dollar',
      equities: 70,
      bonds: 30,
      cash: 0,
      timelineMode: 'retirement_and_accumulation',
      currentAge: 40,
      retirementAge: 60, // 20 years accumulation + 40 years retirement = 60 years total
      additionalContribution: 20000,
      marketDataMode: 'global',
      simulationMode: 'monte_carlo',
    };

    const startTime = Date.now();
    const summary = simulationService.runSimulation(config);
    const endTime = Date.now();
    const elapsedTime = endTime - startTime;

    expect(summary.totalRuns).toBe(1000);
    expect(summary.runs[0].years.length).toBe(60);
    // Ensure it runs in under 5000ms
    expect(elapsedTime).toBeLessThan(5000);
  });
});
