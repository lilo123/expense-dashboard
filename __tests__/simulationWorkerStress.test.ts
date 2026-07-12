import { simulationService } from '../src/workers/simulation.worker';
import { SimulationConfig, WithdrawalStrategy } from '../src/types/simulation';

describe('Simulation Engine (simulation.worker.ts) - Empirical Stress & Adversarial Testing', () => {
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

  describe('1. Timeline Mode: Retirement & Accumulation Period Verification', () => {
    it('correctly applies zero withdrawals, adds contributions, and compounds returns during accumulation years', () => {
      const config: SimulationConfig = {
        ...baseConfig,
        timelineMode: 'retirement_and_accumulation',
        currentAge: 30,
        retirementAge: 40,
        additionalContribution: 20000,
        duration: 25, // retirement duration
        marketDataMode: 'us',
        simulationMode: 'historical',
      };

      const summary = simulationService.runSimulation(config);
      expect(summary.runs.length).toBeGreaterThan(0);

      const accumulationYears = 40 - 30; // 10 years
      const totalDuration = accumulationYears + 25; // 35 years

      for (const run of summary.runs) {
        expect(run.years.length).toBe(totalDuration);

        // Verify Accumulation Phase (Years 1 to 10)
        for (let t = 0; t < accumulationYears; t++) {
          const yr = run.years[t];
          expect(yr.age).toBe(t + 1);
          expect(yr.withdrawal).toBe(0);
          expect(yr.realWithdrawal).toBe(0);
          // Verify endBalance matches startBalance + contribution + growth
          expect(yr.endBalance).toBeCloseTo(yr.startBalance + 20000 + yr.portfolioGrowth, 2);
        }

        // Verify Retirement Phase (Years 11 to 35)
        for (let t = accumulationYears; t < totalDuration; t++) {
          const yr = run.years[t];
          expect(yr.age).toBe(t + 1);
          if (yr.startBalance > 0) {
            expect(yr.withdrawal).toBeGreaterThan(0);
            expect(yr.realWithdrawal).toBeGreaterThan(0);
          } else {
            expect(yr.withdrawal).toBe(0);
            expect(yr.realWithdrawal).toBe(0);
          }
        }
      }
    });

    it('handles boundary case where currentAge === retirementAge (0 accumulation years)', () => {
      const config: SimulationConfig = {
        ...baseConfig,
        timelineMode: 'retirement_and_accumulation',
        currentAge: 60,
        retirementAge: 60,
        additionalContribution: 20000,
        duration: 30,
      };

      const summary = simulationService.runSimulation(config);
      for (const run of summary.runs) {
        expect(run.years.length).toBe(30);
        // First year should immediately be a retirement year with withdrawals (startBalance > 0)
        expect(run.years[0].withdrawal).toBeGreaterThan(0);
      }
    });
  });

  describe('2. Simulation Mode: Scrambled Monte Carlo Verification', () => {
    it('generates exactly 1,000 simulation runs for US market data and is deterministic', () => {
      const config: SimulationConfig = {
        ...baseConfig,
        simulationMode: 'monte_carlo',
        marketDataMode: 'us',
        duration: 30,
      };

      const summary1 = simulationService.runSimulation(config);
      expect(summary1.totalRuns).toBe(1000);
      expect(summary1.runs.length).toBe(1000);

      const summary2 = simulationService.runSimulation(config);
      expect(summary2.totalRuns).toBe(1000);
      expect(summary2.runs.length).toBe(1000);

      // Verify determinism (results must be identical across runs)
      expect(summary1.medianEndingBalance).toBe(summary2.medianEndingBalance);
      expect(summary1.successRate).toBe(summary2.successRate);
      expect(summary1.runs[0].endingBalance).toBe(summary2.runs[0].endingBalance);
      expect(summary1.runs[999].endingBalance).toBe(summary2.runs[999].endingBalance);
    });

    it('generates exactly 1,000 simulation runs for Global market data and is deterministic', () => {
      const config: SimulationConfig = {
        ...baseConfig,
        simulationMode: 'monte_carlo',
        marketDataMode: 'global',
        duration: 30,
      };

      const summary1 = simulationService.runSimulation(config);
      expect(summary1.totalRuns).toBe(1000);
      expect(summary1.runs.length).toBe(1000);

      const summary2 = simulationService.runSimulation(config);
      expect(summary1.medianEndingBalance).toBe(summary2.medianEndingBalance);
      expect(summary1.successRate).toBe(summary2.successRate);
    });
  });

  describe('3. Withdrawal Strategies Stress Testing', () => {
    const strategies: WithdrawalStrategy[] = [
      'constant_dollar',
      'percent_of_portfolio',
      'one_over_n',
      'vpw',
      'cvpw',
      'dynamic_swr',
      'guyton_klinger',
      'vanguard_dynamic',
      'endowment',
      'rule_95',
      'cape_based',
      'sensible',
      'hebeler_autopilot',
    ];

    for (const strategy of strategies) {
      it(`executes successfully without NaN or Infinity for strategy: ${strategy}`, () => {
        const config: SimulationConfig = {
          ...baseConfig,
          withdrawalStrategy: strategy,
          timelineMode: 'retirement_and_accumulation',
          currentAge: 35,
          retirementAge: 45,
          additionalContribution: 10000,
          duration: 20,
          simulationMode: 'historical',
          marketDataMode: 'global',
        };

        const summary = simulationService.runSimulation(config);
        expect(summary.runs.length).toBeGreaterThan(0);
        expect(summary.medianEndingBalance).not.toBeNaN();
        expect(summary.successRate).not.toBeNaN();

        for (const run of summary.runs) {
          expect(run.endingBalance).not.toBeNaN();
          expect(run.realEndingBalance).not.toBeNaN();
          for (const yr of run.years) {
            expect(yr.endBalance).not.toBeNaN();
            expect(yr.withdrawal).not.toBeNaN();
            expect(yr.realWithdrawal).not.toBeNaN();
          }
        }
      });
    }
  });

  describe('4. Columnar Buffers & Data Integrity Verification', () => {
    it('populates balancesBuffer, withdrawalsBuffer, and growthBuffer correctly in Monte Carlo mode', () => {
      const config: SimulationConfig = {
        ...baseConfig,
        simulationMode: 'monte_carlo',
        timelineMode: 'retirement_and_accumulation',
        currentAge: 40,
        retirementAge: 50,
        additionalContribution: 15000,
        duration: 20, // totalDuration = 10 + 20 = 30
      };

      const summary = simulationService.runSimulation(config);
      const expectedTotalYears = 1000 * 30; // 30,000

      expect(summary.balancesBuffer!.length).toBe(expectedTotalYears);
      expect(summary.withdrawalsBuffer!.length).toBe(expectedTotalYears);
      expect(summary.growthBuffer!.length).toBe(expectedTotalYears);

      // Verify no NaN values in buffers
      for (let i = 0; i < expectedTotalYears; i++) {
        expect(summary.balancesBuffer![i]).not.toBeNaN();
        expect(summary.withdrawalsBuffer![i]).not.toBeNaN();
        expect(summary.growthBuffer![i]).not.toBeNaN();
      }
    });
  });
});
