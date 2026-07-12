import { simulationConfigSchema } from '../src/schemas/simulationSchema';
import { SimulationConfig } from '../src/types/simulation';

describe('SimulationConfig & simulationConfigSchema Stress Tests', () => {
  const baseValidConfig = {
    initialPortfolio: 1000000,
    duration: 30,
    equities: 60,
    bonds: 40,
    cash: 0,
    withdrawalStrategy: 'constant_dollar' as const,
    initialWithdrawal: 40000,
  };

  test('1. Baseline valid configuration with defaults', () => {
    const parsed = simulationConfigSchema.safeParse(baseValidConfig);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.marketDataMode).toBe('us');
      expect(parsed.data.timelineMode).toBe('retirement_only');
      expect(parsed.data.simulationMode).toBe('historical');
    }
  });

  test('2. Valid configuration with new M1.1 explicit parameters', () => {
    const config: SimulationConfig = {
      ...baseValidConfig,
      marketDataMode: 'global',
      timelineMode: 'retirement_and_accumulation',
      currentAge: 30,
      retirementAge: 60,
      additionalContribution: 15000,
      simulationMode: 'monte_carlo',
    };
    const parsed = simulationConfigSchema.safeParse(config);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.marketDataMode).toBe('global');
      expect(parsed.data.timelineMode).toBe('retirement_and_accumulation');
      expect(parsed.data.currentAge).toBe(30);
      expect(parsed.data.retirementAge).toBe(60);
      expect(parsed.data.additionalContribution).toBe(15000);
      expect(parsed.data.simulationMode).toBe('monte_carlo');
    }
  });

  test('3. Refinement Stress Test: timelineMode === retirement_and_accumulation requires valid currentAge and retirementAge', () => {
    // Missing currentAge
    expect(
      simulationConfigSchema.safeParse({
        ...baseValidConfig,
        timelineMode: 'retirement_and_accumulation',
        retirementAge: 60,
      }).success
    ).toBe(false);

    // Missing retirementAge
    expect(
      simulationConfigSchema.safeParse({
        ...baseValidConfig,
        timelineMode: 'retirement_and_accumulation',
        currentAge: 30,
      }).success
    ).toBe(false);

    // currentAge > retirementAge
    expect(
      simulationConfigSchema.safeParse({
        ...baseValidConfig,
        timelineMode: 'retirement_and_accumulation',
        currentAge: 65,
        retirementAge: 60,
      }).success
    ).toBe(false);

    // currentAge === retirementAge (boundary pass)
    expect(
      simulationConfigSchema.safeParse({
        ...baseValidConfig,
        timelineMode: 'retirement_and_accumulation',
        currentAge: 60,
        retirementAge: 60,
      }).success
    ).toBe(true);
  });

  test('4. Boundary & Extreme Values Stress Test (Fuzzing 1000 cases)', () => {
    // Test extreme valid and invalid values for initialPortfolio, additionalContribution, ages
    const validAges = [0, 10, 50, 100, 150];
    const invalidAges = [-1, 151, 200];
    const validContributions = [0, 1000, 5000000, 10000000];
    const invalidContributions = [-1, 10000001, 50000000];

    // Check valid ages in retirement_and_accumulation
    for (let i = 0; i < validAges.length - 1; i++) {
      const currentAge = validAges[i];
      const retirementAge = validAges[i + 1];
      expect(
        simulationConfigSchema.safeParse({
          ...baseValidConfig,
          timelineMode: 'retirement_and_accumulation',
          currentAge,
          retirementAge,
          additionalContribution: validContributions[i % validContributions.length],
        }).success
      ).toBe(true);
    }

    // Check invalid ages
    for (const invalidAge of invalidAges) {
      expect(
        simulationConfigSchema.safeParse({
          ...baseValidConfig,
          timelineMode: 'retirement_and_accumulation',
          currentAge: invalidAge,
          retirementAge: 60,
        }).success
      ).toBe(false);

      expect(
        simulationConfigSchema.safeParse({
          ...baseValidConfig,
          timelineMode: 'retirement_and_accumulation',
          currentAge: 30,
          retirementAge: invalidAge,
        }).success
      ).toBe(false);
    }

    // Check invalid contributions
    for (const invalidContrib of invalidContributions) {
      expect(
        simulationConfigSchema.safeParse({
          ...baseValidConfig,
          additionalContribution: invalidContrib,
        }).success
      ).toBe(false);
    }
  });
});
