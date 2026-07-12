// Ensure global self is defined for Comlink in Node.js environment
if (typeof globalThis.self === 'undefined') {
  (globalThis as any).self = globalThis;
  (globalThis as any).addEventListener = () => {};
}

import { simulationConfigSchema } from '../src/schemas/simulationSchema';
import { SimulationConfig } from '../src/types/simulation';

async function verifyAccumulation() {
  console.log('\n=== [E2E VERIFICATION] Validating F2 Accumulation Phase & Timeline Logic (Tier 2 Boundary & Corner Cases) ===');

  const { simulationService } = await import('../src/workers/simulation.worker');

  let failed = false;

  function assert(condition: boolean, message: string) {
    if (!condition) {
      console.error(`[FAIL] ${message}`);
      failed = true;
    } else {
      console.log(`✔ ${message}`);
    }
  }

  const config: SimulationConfig = {
    marketDataMode: 'us',
    timelineMode: 'retirement_and_accumulation',
    initialPortfolio: 100000,
    currentAge: 40,
    retirementAge: 60,
    duration: 30, // 20 years accumulation (40-59) + 30 years retirement (60-89) = 50 years total
    additionalContribution: 12000, // $1,000/month
    withdrawalStrategy: 'constant_dollar',
    initialWithdrawal: 40000,
    equities: 80,
    bonds: 20,
    cash: 0,
    simulationMode: 'historical',
  } as any; // Cast as any until types are updated in M1

  try {
    // 1. Zod validation & defaults for accumulation config
    console.log('\n--- 1. Zod Validation & Defaults ---');
    const parsed = simulationConfigSchema.safeParse(config);
    assert(parsed.success && parsed.data.timelineMode === 'retirement_and_accumulation', 'Zod schema correctly validates accumulation parameters and timelineMode');

    // 2. Correct calculation of totalDuration
    console.log('\n--- 2. Correct Calculation of totalDuration ---');
    const summary = simulationService.runSimulation(config);
    if (!summary || !summary.runs || summary.runs.length === 0) {
      throw new Error('Simulation returned empty runs summary.');
    }
    console.log(`Successfully executed ${summary.runs.length} simulation runs.`);
    assert(summary.runs[0].years.length === 50, `totalDuration correctly equals 50 (20 accumulation + 30 retirement) (got ${summary.runs[0].years.length})`);

    let accumulationZeroWithdrawalVerified = true;
    let retirementWithdrawalVerified = true;
    let compoundingMathVerified = true;
    let longTermAccumulationVerified = true;

    for (const run of summary.runs) {
      const accumulationYears = run.years.slice(0, 20); // First 20 years (age 40 to 59)
      const retirementYears = run.years.slice(20); // Last 30 years (age 60 to 89)

      // 3. Accumulation phase zero-withdrawal enforcement & Compounding Math
      for (const yr of accumulationYears) {
        if (yr.withdrawal !== 0 || yr.realWithdrawal !== 0) {
          console.error(`[FAIL] Run startYear ${run.startYear}, Age ${yr.age}: Expected $0 withdrawal during accumulation, got $${yr.withdrawal}`);
          accumulationZeroWithdrawalVerified = false;
        }
        
        // Verify exact compounding math: endBalance === startBalance + contribution + portfolioGrowth
        const expectedEndBalance = yr.startBalance + config.additionalContribution! + yr.portfolioGrowth;
        if (Math.abs(yr.endBalance - expectedEndBalance) > 0.01) {
          console.error(`[FAIL] Run startYear ${run.startYear}, Age ${yr.age}: Compounding math mismatch. Expected $${expectedEndBalance}, got $${yr.endBalance}`);
          compoundingMathVerified = false;
        }

        if (yr.endBalance <= yr.startBalance) {
          console.warn(`[WARN] Run startYear ${run.startYear}, Age ${yr.age}: endBalance ($${yr.endBalance}) not greater than startBalance ($${yr.startBalance}) due to bear market dip.`);
        }
      }

      // Verify long-term accumulation: After 20 years of contributions, ending balance must exceed initial portfolio
      if (accumulationYears[19].endBalance <= config.initialPortfolio) {
        console.error(`[FAIL] Run startYear ${run.startYear}: Long-term accumulation failed. End balance $${accumulationYears[19].endBalance} <= Initial $${config.initialPortfolio}`);
        longTermAccumulationVerified = false;
      }

      // 5. Verify Retirement Phase transition & withdrawal resumption
      if (retirementYears.length > 0 && retirementYears[0].withdrawal === 0) {
        console.error(`[FAIL] Run startYear ${run.startYear}, Age ${retirementYears[0].age}: Expected withdrawal > $0 during retirement phase, got $0`);
        retirementWithdrawalVerified = false;
      }
    }

    assert(accumulationZeroWithdrawalVerified, 'Accumulation phase correctly enforces $0 withdrawals');
    assert(compoundingMathVerified && longTermAccumulationVerified, 'Accumulation phase correctly applies contributions and compounds returns (verified exact math and long-term growth)');
    assert(retirementWithdrawalVerified, 'Retirement phase transition correctly resumes withdrawals > $0');

    if (failed) {
      console.error('\n=== [E2E VERIFICATION] Accumulation Verification FAILED ===\n');
      process.exit(1);
    } else {
      console.log('\n=== [E2E VERIFICATION] Accumulation Verification PASSED ===\n');
      process.exit(0);
    }
  } catch (err) {
    console.error('=== [E2E VERIFICATION] Accumulation Verification FAILED ===', err);
    process.exit(1);
  }
}

verifyAccumulation();
