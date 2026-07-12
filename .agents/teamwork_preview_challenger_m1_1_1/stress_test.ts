import { simulationConfigSchema } from '../../src/schemas/simulationSchema';
import { SimulationConfig } from '../../src/types/simulation';

console.log('--- STARTING STRESS TEST & EDGE CASE VERIFICATION ---');

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: any) {
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`[FAIL] ${testName}`, details ? details : '');
  }
}

// Helper for valid base config
const getBaseConfig = (): any => ({
  initialPortfolio: 1000000,
  duration: 30,
  equities: 60,
  bonds: 40,
  cash: 0,
  withdrawalStrategy: 'constant_dollar',
  initialWithdrawal: 40000,
});

// --- SECTION 1: DETERMINISTIC EDGE CASE & BOUNDARY TESTING ---
console.log('\n--- SECTION 1: DETERMINISTIC EDGE CASE & BOUNDARY TESTING ---');

// 1. Base Valid Config
let res = simulationConfigSchema.safeParse(getBaseConfig());
assert(res.success, 'Base valid configuration parses successfully', res.error);
if (res.success) {
  assert(res.data.marketDataMode === 'us', 'marketDataMode defaults to us');
  assert(res.data.timelineMode === 'retirement_only', 'timelineMode defaults to retirement_only');
  assert(res.data.simulationMode === 'historical', 'simulationMode defaults to historical');
}

// 2. Explicit valid marketDataMode, timelineMode, simulationMode
res = simulationConfigSchema.safeParse({
  ...getBaseConfig(),
  marketDataMode: 'global',
  timelineMode: 'retirement_only',
  simulationMode: 'monte_carlo',
});
assert(res.success, 'Explicit global, retirement_only, monte_carlo parses successfully', res.error);

// 3. Invalid marketDataMode
res = simulationConfigSchema.safeParse({
  ...getBaseConfig(),
  marketDataMode: 'mars',
});
assert(!res.success, 'Invalid marketDataMode fails parsing');

// 4. Invalid simulationMode
res = simulationConfigSchema.safeParse({
  ...getBaseConfig(),
  simulationMode: 'quantum',
});
assert(!res.success, 'Invalid simulationMode fails parsing');

// 5. timelineMode: retirement_and_accumulation without currentAge/retirementAge
res = simulationConfigSchema.safeParse({
  ...getBaseConfig(),
  timelineMode: 'retirement_and_accumulation',
});
assert(!res.success, 'retirement_and_accumulation without currentAge/retirementAge fails refinement');

// 6. timelineMode: retirement_and_accumulation with currentAge > retirementAge
res = simulationConfigSchema.safeParse({
  ...getBaseConfig(),
  timelineMode: 'retirement_and_accumulation',
  currentAge: 60,
  retirementAge: 50,
});
assert(!res.success, 'retirement_and_accumulation with currentAge > retirementAge fails refinement');

// 7. timelineMode: retirement_and_accumulation with currentAge === retirementAge
res = simulationConfigSchema.safeParse({
  ...getBaseConfig(),
  timelineMode: 'retirement_and_accumulation',
  currentAge: 60,
  retirementAge: 60,
  additionalContribution: 10000,
});
assert(res.success, 'retirement_and_accumulation with currentAge === retirementAge passes refinement', res.error);

// 8. timelineMode: retirement_and_accumulation with currentAge < retirementAge
res = simulationConfigSchema.safeParse({
  ...getBaseConfig(),
  timelineMode: 'retirement_and_accumulation',
  currentAge: 30,
  retirementAge: 60,
  additionalContribution: 25000,
});
assert(res.success, 'retirement_and_accumulation with currentAge < retirementAge passes refinement', res.error);

// 9. additionalContribution boundaries
res = simulationConfigSchema.safeParse({ ...getBaseConfig(), additionalContribution: 0 });
assert(res.success, 'additionalContribution = 0 passes', res.error);

res = simulationConfigSchema.safeParse({ ...getBaseConfig(), additionalContribution: 10000000 });
assert(res.success, 'additionalContribution = 10,000,000 passes', res.error);

res = simulationConfigSchema.safeParse({ ...getBaseConfig(), additionalContribution: -1 });
assert(!res.success, 'additionalContribution = -1 fails');

res = simulationConfigSchema.safeParse({ ...getBaseConfig(), additionalContribution: 10000001 });
assert(!res.success, 'additionalContribution = 10,000,001 fails');

// 10. currentAge / retirementAge boundaries
res = simulationConfigSchema.safeParse({ ...getBaseConfig(), currentAge: 0, retirementAge: 150, timelineMode: 'retirement_and_accumulation' });
assert(res.success, 'currentAge=0, retirementAge=150 passes', res.error);

res = simulationConfigSchema.safeParse({ ...getBaseConfig(), currentAge: -1 });
assert(!res.success, 'currentAge = -1 fails');

res = simulationConfigSchema.safeParse({ ...getBaseConfig(), retirementAge: 151 });
assert(!res.success, 'retirementAge = 151 fails');

// 11. Asset allocation refinement
res = simulationConfigSchema.safeParse({ ...getBaseConfig(), equities: 50, bonds: 40, cash: 0 });
assert(!res.success, 'Asset allocation sum = 90 fails refinement');

res = simulationConfigSchema.safeParse({ ...getBaseConfig(), equities: 60, bonds: 50, cash: 0 });
assert(!res.success, 'Asset allocation sum = 110 fails refinement');

// 12. minWithdrawal / maxWithdrawal refinement
res = simulationConfigSchema.safeParse({ ...getBaseConfig(), minWithdrawal: 50000, maxWithdrawal: 40000 });
assert(!res.success, 'minWithdrawal > maxWithdrawal fails refinement');

// 13. minWithdrawalLimit / maxWithdrawalLimit refinement
res = simulationConfigSchema.safeParse({ ...getBaseConfig(), minWithdrawalLimitEnabled: true, maxWithdrawalLimitEnabled: true, minWithdrawalLimit: 60000, maxWithdrawalLimit: 50000 });
assert(!res.success, 'minWithdrawalLimit > maxWithdrawalLimit fails refinement');


// --- SECTION 2: DIFFERENTIAL FUZZING / STRESS TESTING ---
console.log('\n--- SECTION 2: DIFFERENTIAL FUZZING / STRESS TESTING (10,000 ITERATIONS) ---');

// Oracle function to predict whether an input object should pass schema validation
function oracle(data: any): boolean {
  if (data.initialPortfolio < 10000 || data.initialPortfolio > 10000000) return false;
  if (data.duration < 10 || data.duration > 65) return false;
  if (data.equities < 0 || data.equities > 100) return false;
  if (data.bonds < 0 || data.bonds > 100) return false;
  if (data.cash < 0 || data.cash > 100) return false;
  if ((data.equities + data.bonds + data.cash) !== 100) return false;
  if (data.initialWithdrawal < 1000 || data.initialWithdrawal > 1000000) return false;
  
  if (data.marketDataMode !== undefined && !['us', 'global'].includes(data.marketDataMode)) return false;
  if (data.timelineMode !== undefined && !['retirement_only', 'retirement_and_accumulation'].includes(data.timelineMode)) return false;
  if (data.simulationMode !== undefined && !['historical', 'monte_carlo'].includes(data.simulationMode)) return false;

  if (data.currentAge !== undefined && (data.currentAge < 0 || data.currentAge > 150)) return false;
  if (data.retirementAge !== undefined && (data.retirementAge < 0 || data.retirementAge > 150)) return false;
  if (data.additionalContribution !== undefined && (data.additionalContribution < 0 || data.additionalContribution > 10000000)) return false;

  if (data.timelineMode === 'retirement_and_accumulation') {
    if (data.currentAge === undefined || data.retirementAge === undefined || data.currentAge > data.retirementAge) {
      return false;
    }
  }

  if (data.minWithdrawal !== undefined && data.maxWithdrawal !== undefined && data.minWithdrawal > data.maxWithdrawal) return false;
  if (data.minWithdrawalLimitEnabled && data.maxWithdrawalLimitEnabled && data.minWithdrawalLimit !== undefined && data.maxWithdrawalLimit !== undefined && data.minWithdrawalLimit > data.maxWithdrawalLimit) return false;
  if (data.glidePath && data.targetEquities !== undefined && (data.targetEquities < 0 || data.targetEquities > 100)) return false;

  return true;
}

// PRNG for reproducible fuzzing (Mulberry32)
function mulberry32(a: number) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(123456789);

function getRandomInt(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(random() * arr.length)];
}

const strategies = [
  'constant_dollar', 'percent_of_portfolio', 'one_over_n', 'vpw', 'cvpw',
  'dynamic_swr', 'guyton_klinger', 'vanguard_dynamic', 'endowment', 'rule_95',
  'cape_based', 'sensible', 'hebeler_autopilot'
];

let fuzzMatches = 0;
let fuzzMismatches = 0;
const NUM_ITERATIONS = 10000;

for (let i = 0; i < NUM_ITERATIONS; i++) {
  // Generate random/adversarial inputs
  const eq = getRandomInt(0, 100);
  const bd = getRandomInt(0, 100 - eq);
  // 80% chance to make sum 100, 20% chance to make it invalid
  const cs = random() < 0.8 ? (100 - eq - bd) : getRandomInt(0, 100);

  const candidate: any = {
    initialPortfolio: random() < 0.9 ? getRandomInt(10000, 10000000) : getRandomInt(0, 20000000),
    duration: random() < 0.9 ? getRandomInt(10, 65) : getRandomInt(5, 80),
    equities: eq,
    bonds: bd,
    cash: cs,
    withdrawalStrategy: getRandomElement(strategies),
    initialWithdrawal: random() < 0.9 ? getRandomInt(1000, 1000000) : getRandomInt(0, 2000000),
    marketDataMode: getRandomElement(['us', 'global', undefined, 'invalid']),
    timelineMode: getRandomElement(['retirement_only', 'retirement_and_accumulation', undefined]),
    simulationMode: getRandomElement(['historical', 'monte_carlo', undefined, 'invalid']),
    currentAge: random() < 0.8 ? getRandomInt(20, 70) : getRandomElement([undefined, -5, 160]),
    retirementAge: random() < 0.8 ? getRandomInt(50, 70) : getRandomElement([undefined, -5, 160]),
    additionalContribution: random() < 0.8 ? getRandomInt(0, 50000) : getRandomElement([undefined, -100, 20000000]),
  };

  const expected = oracle(candidate);
  const actual = simulationConfigSchema.safeParse(candidate).success;

  if (expected === actual) {
    fuzzMatches++;
  } else {
    fuzzMismatches++;
    console.error(`[FUZZ MISMATCH] Iteration ${i}`);
    console.error('Candidate:', JSON.stringify(candidate));
    console.error(`Expected: ${expected}, Actual: ${actual}`);
    if (!actual) {
      console.error('Zod Error:', simulationConfigSchema.safeParse(candidate).error);
    }
    break;
  }
}

console.log(`Fuzzing Results: ${fuzzMatches} matches, ${fuzzMismatches} mismatches out of ${NUM_ITERATIONS} iterations.`);

if (fuzzMismatches === 0 && failedTests === 0) {
  console.log('\n[VERDICT: PASS] All stress tests and edge case verifications succeeded!');
} else {
  console.error('\n[VERDICT: FAIL] Stress tests or edge case verifications failed.');
  process.exit(1);
}
