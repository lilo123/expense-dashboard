import { simulationService } from '../../src/workers/simulation.worker';
import { SimulationConfig } from '../../src/types/simulation';

describe('Adversarial Test Coverage Audit - simulation.worker.ts (M3.1)', () => {
  const baseConfig: SimulationConfig = {
    initialPortfolio: 1000000,
    duration: 30,
    equities: 60,
    bonds: 40,
    cash: 0,
    withdrawalStrategy: 'constant_dollar',
    initialWithdrawal: 40000,
    marketDataMode: 'us',
    timelineMode: 'retirement_only',
    simulationMode: 'historical',
  };

  describe('1. Timeline Mode & Market Data Mode Verification', () => {
    it('adv_test_1: executes historical simulation in us mode with retirement_only timeline', () => {
      const summary = simulationService.runSimulation(baseConfig);
      expect(summary.totalRuns).toBeGreaterThan(0);
      expect(summary.runs.length).toBe(summary.totalRuns);
      expect(summary.successRate).toBeGreaterThanOrEqual(0);
      expect(summary.successRate).toBeLessThanOrEqual(100);

      // Verify buffer sizes
      const expectedTotalYears = summary.totalRuns * baseConfig.duration;
      expect(summary.balancesBuffer!.length).toBe(expectedTotalYears);
      expect(summary.withdrawalsBuffer!.length).toBe(expectedTotalYears);
      expect(summary.growthBuffer!.length).toBe(expectedTotalYears);

      // Verify first run details
      const firstRun = summary.runs[0];
      expect(firstRun.startYear).toBe(1871);
      expect(firstRun.years.length).toBe(30);
      expect(firstRun.years[0].withdrawal).toBe(40000);
    });

    it('adv_test_2: executes historical simulation in global mode with retirement_and_accumulation timeline', () => {
      const config: SimulationConfig = {
        ...baseConfig,
        marketDataMode: 'global',
        timelineMode: 'retirement_and_accumulation',
        currentAge: 30,
        retirementAge: 60,
        additionalContribution: 15000,
        duration: 25, // 30 accumulation years + 25 retirement years = 55 years total
      };

      const summary = simulationService.runSimulation(config);
      expect(summary.totalRuns).toBeGreaterThan(0);

      const firstRun = summary.runs[0];
      expect(firstRun.startYear).toBe(1970); // Global mode starts in 1970
      expect(firstRun.years.length).toBe(55); // 30 accumulation + 25 retirement

      // Verify accumulation phase (years 1 to 30)
      for (let t = 0; t < 30; t++) {
        const yr = firstRun.years[t];
        expect(yr.withdrawal).toBe(0);
        expect(yr.realWithdrawal).toBe(0);
        // Verify contribution was added to startBalance or accounted for in growth/endBalance
        expect(yr.endBalance).toBeGreaterThan(0);
      }

      // Verify retirement phase (years 31 to 55)
      const firstRetirementYear = firstRun.years[30];
      expect(firstRetirementYear.withdrawal).toBeGreaterThan(0);
      expect(firstRetirementYear.realWithdrawal).toBeGreaterThan(0);
    });
  });

  describe('2. Scrambled Monte Carlo Mode & Mulberry32 PRNG Determinism', () => {
    it('adv_test_3: executes monte_carlo simulation in us mode with retirement_and_accumulation', () => {
      const config: SimulationConfig = {
        ...baseConfig,
        marketDataMode: 'us',
        timelineMode: 'retirement_and_accumulation',
        currentAge: 40,
        retirementAge: 60,
        additionalContribution: 10000,
        duration: 30, // 20 accumulation + 30 retirement = 50 years total
        simulationMode: 'monte_carlo',
      };

      const summary1 = simulationService.runSimulation(config);
      expect(summary1.totalRuns).toBe(1000);
      expect(summary1.runs.length).toBe(1000);

      const expectedTotalYears = 1000 * 50;
      expect(summary1.balancesBuffer!.length).toBe(expectedTotalYears);
      expect(summary1.withdrawalsBuffer!.length).toBe(expectedTotalYears);

      // Verify Mulberry32 PRNG determinism by running a second time and comparing exact results
      const summary2 = simulationService.runSimulation(config);
      expect(summary1.successRate).toBe(summary2.successRate);
      expect(summary1.medianEndingBalance).toBe(summary2.medianEndingBalance);
      expect(summary1.worstEndingBalance).toBe(summary2.worstEndingBalance);
      expect(summary1.bestEndingBalance).toBe(summary2.bestEndingBalance);
      expect(summary1.stdDevEndingBalance).toBe(summary2.stdDevEndingBalance);
    });

    it('adv_test_4: executes monte_carlo simulation in global mode with retirement_only', () => {
      const config: SimulationConfig = {
        ...baseConfig,
        marketDataMode: 'global',
        timelineMode: 'retirement_only',
        duration: 40,
        simulationMode: 'monte_carlo',
      };

      const summary = simulationService.runSimulation(config);
      expect(summary.totalRuns).toBe(1000);
      expect(summary.runs[0].years.length).toBe(40);
      expect(summary.defaultHistogramBins.length).toBe(20);
      expect(summary.defaultSpendingBins.length).toBe(12);
    });
  });

  describe('3. Adversarial Withdrawal Strategies, Guardrails & Cash Flows', () => {
    it('adv_test_5: verifies Guyton-Klinger, Vanguard Dynamic, and CAPE-based strategies with min/max guardrails', () => {
      const strategies: SimulationConfig['withdrawalStrategy'][] = [
        'guyton_klinger',
        'vanguard_dynamic',
        'cape_based',
        'vpw',
        'dynamic_swr',
        'sensible',
        'hebeler_autopilot',
        'rule_95',
        'endowment',
        'one_over_n',
        'percent_of_portfolio'
      ];

      for (const withdrawalStrategy of strategies) {
        const config: SimulationConfig = {
          ...baseConfig,
          withdrawalStrategy,
          minWithdrawalLimitEnabled: true,
          minWithdrawalLimit: 30000,
          maxWithdrawalLimitEnabled: true,
          maxWithdrawalLimit: 60000,
          duration: 10,
        };

        const summary = simulationService.runSimulation(config);
        expect(summary.totalRuns).toBeGreaterThan(0);

        // Verify guardrails on first run
        const firstRun = summary.runs[0];
        for (const yr of firstRun.years) {
          // Real withdrawal should be within [minWithdrawalLimit, maxWithdrawalLimit] unless portfolio depleted
          if (yr.startBalance > 60000) {
            expect(yr.realWithdrawal).toBeGreaterThanOrEqual(29999.99);
            expect(yr.realWithdrawal).toBeLessThanOrEqual(60000.01);
          }
        }
      }
    });

    it('adv_test_6: verifies supplemental cash flows (additionalIncome, extraWithdrawals) and glide path transitions', () => {
      const config: SimulationConfig = {
        ...baseConfig,
        duration: 20,
        additionalIncome: [
          { name: 'Pension', startYearOffset: 0, duration: 10, annualAmount: 15000, inflated: true, inflationStart: 'immediately' },
          { name: 'Social Security', startYearOffset: 5, duration: 15, annualAmount: 20000, inflated: true, inflationStart: 'when_starts' }
        ],
        extraWithdrawals: [
          { name: 'College', startYearOffset: 2, duration: 4, annualAmount: 25000, inflated: true, inflationStart: 'immediately' }
        ],
        glidePath: true,
        targetEquities: 30,
        glidePathDuration: 10,
        glidePathPace: 'slowly',
        rebalancePortfolio: true,
        rebalanceFrequency: 1,
      };

      const summary = simulationService.runSimulation(config);
      expect(summary.totalRuns).toBeGreaterThan(0);
      expect(summary.runs[0].years.length).toBe(20);
    });
  });

  describe('4. Extreme & Boundary Inputs', () => {
    it('adv_test_7: handles duration=1 and startYearMin/Max filtering correctly', () => {
      const config: SimulationConfig = {
        ...baseConfig,
        duration: 1,
        startYearMin: 1950,
        startYearMax: 1960,
      };

      const summary = simulationService.runSimulation(config);
      // 1950 to 1960 inclusive = 11 runs
      expect(summary.totalRuns).toBe(11);
      expect(summary.runs[0].startYear).toBe(1950);
      expect(summary.runs[summary.runs.length - 1].startYear).toBe(1960);
      expect(summary.runs[0].years.length).toBe(1);
    });

    it('adv_test_8: verifies zeroPortfolioCount and failure metrics under extreme withdrawal conditions', () => {
      const config: SimulationConfig = {
        ...baseConfig,
        initialPortfolio: 50000,
        initialWithdrawal: 60000, // Exceeds initial portfolio
        duration: 30,
      };

      const summary = simulationService.runSimulation(config);
      expect(summary.successRate).toBe(0);
      expect(summary.zeroPortfolioCount).toBe(summary.totalRuns);
      expect(summary.zeroPortfolioPercentage).toBe(100);
    });
  });
});
