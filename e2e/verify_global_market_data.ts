// Ensure global self is defined for Comlink in Node.js environment
if (typeof globalThis.self === 'undefined') {
  (globalThis as any).self = globalThis;
  (globalThis as any).addEventListener = () => {};
}

import { simulationConfigSchema } from '../src/schemas/simulationSchema';
import { SimulationConfig } from '../src/types/simulation';
import { getMarketDataForYear, getValidStartYears, getAllMarketData, globalMarketData, shillerMarketData } from '../src/lib/marketData';

async function verifyGlobalMarketData() {
  console.log('\n=== [E2E VERIFICATION] Validating F1 Global Market Data Toggle (Tier 2 Boundary & Corner Cases) ===');
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

  try {
    // 1. Zod validation & defaults
    console.log('\n--- 1. Zod Validation & Defaults ---');
    const parsed = simulationConfigSchema.safeParse({
      initialPortfolio: 1000000,
      duration: 30,
      equities: 60,
      bonds: 40,
      cash: 0,
      withdrawalStrategy: 'constant_dollar',
      initialWithdrawal: 40000,
      marketDataMode: 'global'
    });
    assert(parsed.success && parsed.data.marketDataMode === 'global', 'Zod schema correctly validates and defaults global marketDataMode');

    // 2. Start year boundaries (1970 vs 1871)
    console.log('\n--- 2. Start Year Boundaries (1970 vs 1871) ---');
    const usYears = getValidStartYears(30, 'us');
    const globalYears = getValidStartYears(30, 'global');
    assert(usYears[0] === 1871, `US mode start year boundary is 1871 (got ${usYears[0]})`);
    assert(globalYears[0] === 1970, `Global mode start year boundary is 1970 (got ${globalYears[0]})`);

    // 3. Out-of-bounds fallbacks
    console.log('\n--- 3. Out-of-Bounds Fallbacks ---');
    const oobUs = getMarketDataForYear(1800, 'us');
    const oobGlobal = getMarketDataForYear(1900, 'global');
    assert(oobUs.year === 1800 && oobUs.startCpi === 322.0 && oobUs.cape === 35.0, 'US mode correctly applies fallback for out-of-bounds year 1800');
    assert(oobGlobal.year === 1900 && oobGlobal.startCpi === 322.0 && oobGlobal.cape === 25.0, 'Global mode correctly applies fallback for out-of-bounds year 1900');

    // 4. MSCI/Shiller proxy merging integrity
    console.log('\n--- 4. MSCI/Shiller Proxy Merging Integrity ---');
    const gData1975 = getMarketDataForYear(1975, 'global');
    const sData1975 = getMarketDataForYear(1975, 'us');
    assert(gData1975.startCpi === sData1975.startCpi && gData1975.endCpi === sData1975.endCpi && gData1975.cape === sData1975.cape && gData1975.dividendYields === sData1975.dividendYields && gData1975.bondsGrowth === sData1975.bondsGrowth, 'Global market data correctly merges Shiller proxy metrics (CPI, CAPE, bonds, dividends)');
    assert(gData1975.stockMarketGrowth !== sData1975.stockMarketGrowth, `Global stock market growth (${gData1975.stockMarketGrowth}) correctly differs from US stock market growth (${sData1975.stockMarketGrowth})`);

    // 5. Simulation execution under global mode
    console.log('\n--- 5. Simulation Execution under Global Mode ---');
    const config: SimulationConfig = {
      marketDataMode: 'global',
      timelineMode: 'retirement_only',
      initialPortfolio: 1000000,
      duration: 30,
      withdrawalStrategy: 'constant_dollar',
      initialWithdrawal: 40000,
      equities: 60,
      bonds: 40,
      cash: 0,
      simulationMode: 'historical',
    } as any;
    const summary = simulationService.runSimulation(config);
    assert(summary && summary.runs && summary.runs.length > 0, `Simulation successfully executed ${summary?.runs?.length} runs under global market data mode`);
    assert(summary.runs[0].startYear === 1970, `First simulation run correctly starts at 1970 under global mode`);

    if (failed) {
      console.error('\n=== [E2E VERIFICATION] Global Market Data Verification FAILED ===\n');
      process.exit(1);
    } else {
      console.log('\n=== [E2E VERIFICATION] Global Market Data Verification PASSED ===\n');
      process.exit(0);
    }
  } catch (err) {
    console.error('=== [E2E VERIFICATION] Global Market Data Verification FAILED ===', err);
    process.exit(1);
  }
}

verifyGlobalMarketData();
