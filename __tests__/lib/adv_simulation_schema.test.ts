import { simulationConfigSchema } from '@/schemas/simulationSchema';

describe('Adversarial Test Coverage Audit - simulationConfigSchema', () => {
  const validBaseConfig = {
    initialPortfolio: 1000000,
    duration: 30,
    equities: 60,
    bonds: 40,
    cash: 0,
    withdrawalStrategy: 'constant_dollar' as const,
    initialWithdrawal: 40000,
  };

  it('should parse valid base config and apply correct defaults for M1.1 fields', () => {
    const result = simulationConfigSchema.safeParse(validBaseConfig);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.marketDataMode).toBe('us');
      expect(result.data.timelineMode).toBe('retirement_only');
      expect(result.data.simulationMode).toBe('historical');
      expect(result.data.currentAge).toBeUndefined();
      expect(result.data.retirementAge).toBeUndefined();
      expect(result.data.additionalContribution).toBeUndefined();
    }
  });

  it('should parse valid config with explicit M1.1 fields', () => {
    const config = {
      ...validBaseConfig,
      marketDataMode: 'global' as const,
      timelineMode: 'retirement_and_accumulation' as const,
      currentAge: 30,
      retirementAge: 60,
      additionalContribution: 12000,
      simulationMode: 'monte_carlo' as const,
    };
    const result = simulationConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.marketDataMode).toBe('global');
      expect(result.data.timelineMode).toBe('retirement_and_accumulation');
      expect(result.data.currentAge).toBe(30);
      expect(result.data.retirementAge).toBe(60);
      expect(result.data.additionalContribution).toBe(12000);
      expect(result.data.simulationMode).toBe('monte_carlo');
    }
  });

  it('should fail refinement if timelineMode is retirement_and_accumulation but currentAge/retirementAge are missing', () => {
    const config = {
      ...validBaseConfig,
      timelineMode: 'retirement_and_accumulation' as const,
    };
    const result = simulationConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Current age and retirement age must be provided');
    }
  });

  it('should fail refinement if timelineMode is retirement_and_accumulation but currentAge > retirementAge', () => {
    const config = {
      ...validBaseConfig,
      timelineMode: 'retirement_and_accumulation' as const,
      currentAge: 65,
      retirementAge: 60,
    };
    const result = simulationConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('current age must be less than or equal to retirement age');
    }
  });

  it('should fail refinement if asset allocation does not equal 100%', () => {
    const config = {
      ...validBaseConfig,
      equities: 50,
      bonds: 40,
      cash: 0,
    };
    const result = simulationConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Asset allocation must equal exactly 100%');
    }
  });

  it('should fail validation on invalid boundary values for M1.1 fields', () => {
    const config = {
      ...validBaseConfig,
      currentAge: -1,
      retirementAge: 151,
      additionalContribution: -100,
    };
    const result = simulationConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });
});
