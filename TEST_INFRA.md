# TEST_INFRA.md — Comprehensive Opaque-Box Test Suite

This document defines the comprehensive opaque-box test suite for the Retirement Calculator Expansion in `expense-dashboard`. It strictly adheres to the **4-Tier Productivity Workflow** and enforces all **Brand & Empathy Assertions ("No Game Overs")** and **Design System Assertions** defined in `TESTING.md`.

---

## 1. Feature 1: Global Market Data Toggle (R1) - [14 Test Cases]

### Tier 1: Local Watch-Mode Unit Testing (Jest / RTL)
1. `test_global_market_data_parsing`: Verify `src/lib/globalMarketData.ts` correctly parses the MSCI World Index CSV (`chart.csv`), validating monthly returns starting from `12/1969`.
2. `test_market_data_mode_schema`: Verify `simulationConfigSchema` correctly validates `marketDataMode: 'us' | 'global'` and rejects invalid mode strings.
3. `test_get_market_data_us`: Verify `getMarketData('us', year)` returns correct Shiller market data points.
4. `test_get_market_data_global`: Verify `getMarketData('global', year)` returns correct MSCI World market data points.
5. `test_get_valid_start_years_us`: Verify `getValidStartYears('us', 30)` returns valid range (e.g., 1871 to 1996).
6. `test_get_valid_start_years_global`: Verify `getValidStartYears('global', 30)` returns valid range starting from 1970 (e.g., 1970 to 1996).
7. `test_calculator_params_market_toggle_render`: Verify `CalculatorParams.tsx` renders the Global Market Data toggle with correct ARIA labels and default state ('us').

### Tier 2: Targeted Single-Spec E2E (Playwright Desktop Chromium)
8. `e2e_market_data_toggle_interaction`: Verify clicking the Global Market Data toggle updates the simulation context and triggers a worker recalculation.
9. `e2e_global_market_summary_view_update`: Verify switching to Global Market Data dynamically updates the `SummaryView` success rate and median ending balance without page reload.
10. `e2e_global_market_data_persistence`: Verify active market data mode ('global') is preserved in client state/localStorage across client-side navigation.

### Tier 3: Automated Git Pre-Push Smoke Tests
11. `smoke_market_toggle_calculation_flow`: Verify the end-to-end flow of selecting Global Market Data, submitting parameters, and receiving successful simulation results.
12. `smoke_market_data_error_boundary`: Verify that if market data parsing fails or is missing, the global empathetic error catch-all (*"Uh oh, the system tripped up! Don't worry, your data is safe. Let's try that again."*) is displayed without raw logs.

### Tier 4: Asynchronous Cloud CI/CD Auditing (Multi-Browser & A11y)
13. `ci_market_toggle_cross_browser`: Verify Global Market Data toggle renders and functions correctly across all 5 browser emulations (Chromium, Firefox, Webkit, Mobile Chrome, Mobile Safari).
14. `ci_market_toggle_a11y_contrast`: Execute `@axe-core/playwright` on `CalculatorParams.tsx` to assert zero WCAG 2.1 AA/AAA violations for the market data toggle button and labels.

---

## 2. Feature 2: Accumulation Phase & Timeline Calculation Toggle (R2) - [16 Test Cases]

### Tier 1: Local Watch-Mode Unit Testing (Jest / RTL)
15. `test_timeline_mode_schema`: Verify `simulationConfigSchema` validates `timelineMode: 'retirement_only' | 'retirement_and_accumulation'`, `currentAge`, `retirementAge`, and `additionalContribution`.
16. `test_timeline_validation_rules`: Verify Zod refinement rules enforce `currentAge < retirementAge` when `timelineMode === 'retirement_and_accumulation'`.
17. `test_worker_accumulation_zero_withdrawals`: Verify `simulation.worker.ts` applies exactly $0 withdrawal during accumulation years (`age < retirementAge - currentAge + 1`).
18. `test_worker_accumulation_contributions`: Verify `simulation.worker.ts` correctly adds `additionalContribution` to the portfolio balance during accumulation years.
19. `test_worker_accumulation_compounding`: Verify `simulation.worker.ts` correctly compounds market growth on both initial portfolio and annual contributions during accumulation years.
20. `test_worker_retirement_transition`: Verify `simulation.worker.ts` correctly transitions to withdrawal phase at `retirementAge`, applying the configured withdrawal strategy.
21. `test_ui_retirement_only_grey_out`: Verify `CalculatorParams.tsx` disables and greys out `currentAge`, `retirementAge`, and `additionalContribution` when `timelineMode === 'retirement_only'`.
22. `test_ui_retirement_accumulation_enable`: Verify `CalculatorParams.tsx` enables `currentAge`, `retirementAge`, and `additionalContribution` when `timelineMode === 'retirement_and_accumulation'`.

### Tier 2: Targeted Single-Spec E2E (Playwright Desktop Chromium)
23. `e2e_timeline_toggle_grey_out_logic`: Verify toggling to `Retirement Period Only` instantly adds `disabled` attributes and grey-out styling to accumulation input fields.
24. `e2e_timeline_toggle_accumulation_input`: Verify toggling to `Retirement & Accumulation Period` allows typing into `Current Age` (e.g., 40), `Retirement Age` (e.g., 60), and `Additional Yearly Contributions` (e.g., 12000).
25. `e2e_accumulation_chart_rendering`: Verify `PortfolioValueView` renders a continuous 50-year timeline chart showing portfolio growth in the first 20 years and drawdown in the last 30 years.
26. `e2e_accumulation_zero_jargon`: Verify UI contains zero negative financial jargon ("Debt", "Penalty", "Failing", "Over-limit", "Deficit") during accumulation and retirement simulation views.

### Tier 3: Automated Git Pre-Push Smoke Tests
27. `smoke_timeline_toggle_calculation`: Verify the critical path of toggling timeline mode, entering accumulation parameters, and successfully executing the Web Worker simulation.
28. `smoke_timeline_invalid_age_safeguard`: Verify entering `currentAge >= retirementAge` displays a friendly, empathetic validation message without crashing the simulation engine.

### Tier 4: Asynchronous Cloud CI/CD Auditing (Multi-Browser & A11y)
29. `ci_timeline_inputs_mobile_compression`: Verify mobile viewports (Pixel 5, iPhone 12) correctly compress large contribution numbers (e.g., `12,000` -> `12K`) in the accumulation summary views.
30. `ci_timeline_toggle_layout_stability`: Throttling network/worker, verify strict bounding box alignment (`Math.abs(plannerBox.y - skeletonBox.y) <= 1.0px`) when toggling timeline modes to ensure zero Cumulative Layout Shift (CLS).

---

## 3. Feature 3: Simulation Mode Toggle (Historical Backtesting vs. Scrambled Monte Carlo) (R3) - [15 Test Cases]

### Tier 1: Local Watch-Mode Unit Testing (Jest / RTL)
31. `test_simulation_mode_schema`: Verify `simulationConfigSchema` validates `simulationMode: 'historical' | 'monte_carlo'`.
32. `test_mulberry32_prng_determinism`: Verify the Mulberry32 PRNG utility in `simulation.worker.ts` produces identical pseudo-random number sequences for a given seed.
33. `test_worker_monte_carlo_1000_runs`: Verify `simulation.worker.ts` generates exactly 1,000 simulation runs when `simulationMode === 'monte_carlo'`.
34. `test_worker_monte_carlo_scrambling`: Verify `simulation.worker.ts` correctly samples annual returns randomly from the active market dataset (US or Global) for each year of a Monte Carlo run.
35. `test_worker_monte_carlo_reproducibility`: Verify two consecutive invocations of `runSimulation` with identical `monte_carlo` config produce the exact same `SimulationSummary` output.
36. `test_ui_simulation_mode_toggle`: Verify `CalculatorParams.tsx` renders the Simulation Mode toggle (Historical vs. Monte Carlo) with correct default state ('historical').

### Tier 2: Targeted Single-Spec E2E (Playwright Desktop Chromium)
37. `e2e_simulation_mode_toggle_switch`: Verify toggling to `Scrambled Monte Carlo` triggers the Web Worker to compute 1,000 runs and updates the `SummaryView`.
38. `e2e_monte_carlo_simulations_list_view`: Verify `SimulationsListView` seamlessly virtualizes or renders the 1,000 Monte Carlo simulation runs without DOM lag or memory leaks.
39. `e2e_monte_carlo_page_reload_persistence`: Verify `Scrambled Monte Carlo` mode and its deterministic results persist across page reloads without Next.js hydration mismatch warnings.

### Tier 3: Automated Git Pre-Push Smoke Tests
40. `smoke_monte_carlo_full_calculation`: Verify the end-to-end execution of a 50-year Scrambled Monte Carlo simulation (combining Global Market Data and Accumulation Phase) completes successfully.
41. `smoke_monte_carlo_worker_error_handling`: Verify that if the Web Worker terminates or stalls during Monte Carlo execution, the UI recovers gracefully with the global empathetic error message.

### Tier 4: Asynchronous Cloud CI/CD Auditing (Multi-Browser & A11y)
42. `ci_monte_carlo_performance_benchmarking`: Verify Web Worker execution of 1,000 Monte Carlo runs completes within acceptable timeouts across all 5 browser emulations in CI.
43. `ci_monte_carlo_charts_visual_snapshot`: Verify `SummaryView` and `PortfolioValueView` in Monte Carlo mode match baseline visual screenshots (`toHaveScreenshot`) to ensure pristine glassmorphism and chart rendering.
44. `ci_monte_carlo_a11y_aria_announcements`: Verify screen reader ARIA live regions correctly announce the completion of the 1,000 Monte Carlo simulation runs.
45. `ci_monte_carlo_zero_console_errors`: Verify global Jest/Playwright console guard intercepts zero React hydration, key prop, or unmounted component state update warnings during Monte Carlo execution.
