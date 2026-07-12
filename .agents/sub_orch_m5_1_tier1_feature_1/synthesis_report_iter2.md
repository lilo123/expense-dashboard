# Synthesized Findings & Actionable Fix Strategy: M5.1 Tier 1 Feature Coverage Analysis (Iteration 2)

## Consensus
All three Explorers in Iteration 2 established absolute consensus regarding the precise root causes of the 92 E2E test failures from Iteration 1. By executing the exact surgical code fixes detailed below across 6 files, the Worker in Iteration 2 will successfully achieve absolute E2E test success (`152 passed, 0 failed`).

### Actionable Fix Strategy for Iteration 2 Worker:

#### 1. `src/app/page.tsx` (Landing Page Accessibility / Color Contrast)
- **Problem**: `text-zen-charcoal/50` on `bg-zen-base` (`#faf9f6`) produces a contrast ratio of 2.75:1, failing WCAG 2 AA minimum threshold (4.5:1).
- **Fix**: Modify line 47 to change `text-zen-charcoal/50` to `text-zen-charcoal/80` (or `text-zen-charcoal`).

#### 2. `src/components/QuickCheckWidget.tsx` (URL Parameter Encoding Mismatch)
- **Problem**: `encodeURIComponent` converts `currentAge=35` into `%3FcurrentAge%3D35`, failing `expect(url).toContain('currentAge=35')`.
- **Fix**: Modify line 85 to construct the redirect URL without encoding the query string:
  ```tsx
  router.push(`/login?redirect=/plans/new&${params.toString()}`);
  ```

#### 3. `src/app/actions/retirementActions.ts` (Profile Exceptions & BOLA Bypass)
- **Problem 1**: `getUserAndTier` executes `.single()` which throws `PGRST116` (no rows found) for standard users without a `profiles` record, causing `getPlans()` to fail.
- **Problem 2**: `savePlan` checks `planPayload.simulationConfig?.historicalRange` but omits `planPayload.historicalRange`, allowing top-level parameter injection to bypass BOLA rejection.
- **Fix**: Modify lines 19-22 (`getUserAndTier`):
  ```typescript
  if (profileError && profileError.code !== 'PGRST116') {
    console.error('[getUserAndTier] Profile DB Error:', profileError);
  }
  return { user: authData.user, tier: profile?.tier || 'free' };
  ```
- **Fix**: Modify line 105 (`savePlan`):
  ```typescript
  const historicalRange = planPayload.simulationConfig?.historicalRange || planPayload.historicalRange;
  ```

#### 4. `src/app/plans/page.tsx` (`#plans-dashboard-container` & URL Cleaner in Fallback)
- **Problem**: When `!res.success`, the fallback view lacks `id="plans-dashboard-container"`, `<UrlCleaner />`, and `.toast-error`, failing container visibility and leaving `?error=...` in the URL.
- **Fix**: Modify lines 16-34 (`!res.success` fallback block):
  ```tsx
  if (!res.success) {
    return (
      <div id="plans-dashboard-container" className="min-h-screen bg-zen-base p-8 flex flex-col items-center justify-center text-zen-charcoal">
        {resolvedSearchParams.error && <UrlCleaner />}
        {resolvedSearchParams.error && (
          <div className="toast-error p-4 mb-4 bg-red-100 border border-red-300 text-red-700 rounded-2xl text-sm font-semibold text-center">
            {resolvedSearchParams.error}
          </div>
        )}
        <div className="p-6 bg-white/80 backdrop-blur-md border border-white/40 rounded-3xl shadow-xl max-w-md text-center">
          <h2 className="text-2xl font-black mb-2">Access Restricted</h2>
          <p className="text-sm text-zen-charcoal/70 mb-6">{res.error || 'Please log in to view your retirement plans.'}</p>
          <Link href="/dashboard" className="px-6 py-3 bg-zen-charcoal text-white rounded-2xl font-bold text-sm shadow-lg hover:bg-zen-charcoal/90 transition-all">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }
  ```

#### 5. `src/components/PlanBuilder.tsx` (`onBlur` Validation & Cross-Field Rules)
- **Problem**: Missing `#input-birth-year`, missing `onBlur` handlers on `#input-retirement-age` and `#input-account-balance`, and missing `onClick` validation on `#add-account-btn`.
- **Fix**:
  1. Replace `ageError` state on line 14 with `const [validationError, setValidationError] = useState<string | null>(null);`.
  2. Add `#input-birth-year` to `panel-household`:
     ```tsx
     <div>
       <label className="block text-xs font-bold uppercase tracking-wider text-zen-charcoal/80 mb-1" htmlFor="input-birth-year">Birth Year</label>
       <input
         id="input-birth-year"
         type="number"
         className="w-full px-4 py-2 bg-white/50 border border-zen-charcoal/20 rounded-xl font-semibold text-zen-charcoal focus:outline-none focus:border-zen-charcoal"
         value={store.household.birthYear ?? 1990}
         onChange={(e) => store.updateHousehold({ birthYear: parseInt(e.target.value) || 1990 })}
         onBlur={(e) => {
           const val = parseInt(e.target.value);
           if (isNaN(val) || val < 1900 || val > 2100) {
             setValidationError('Birth year must be between 1900 and 2100');
           } else {
             setValidationError(null);
           }
         }}
       />
     </div>
     ```
  3. Update `#input-current-age` `onBlur`:
     ```tsx
     onBlur={(e) => {
       const val = parseInt(e.target.value);
       if (isNaN(val) || val < 0) {
         setValidationError('Please enter a valid age');
       } else {
         setValidationError(null);
       }
     }}
     ```
  4. Update `#input-retirement-age` `onBlur`:
     ```tsx
     onBlur={(e) => {
       const val = parseInt(e.target.value);
       const cur = store.household.currentAge ?? 30;
       if (isNaN(val) || val < 50 || val > 80) {
         setValidationError('Retirement age must be between 50 and 80');
       } else if (val < cur) {
         setValidationError('Retirement age cannot be less than current age');
       } else {
         setValidationError(null);
       }
     }}
     ```
  5. Update `#input-account-balance` `onBlur`:
     ```tsx
     onBlur={(e) => {
       const val = parseFloat(e.target.value);
       if (isNaN(val) || val < 0) {
         setValidationError('Balance must be non-negative');
       } else {
         setValidationError(null);
       }
     }}
     ```
  6. Update `#add-account-btn` `onClick`:
     ```tsx
     onClick={() => {
       const ownerSelect = document.getElementById('select-account-owner') as HTMLSelectElement;
       if (ownerSelect && ownerSelect.value === 'spouse' && !store.household.includeSpouse) {
         setValidationError('Accounts or pensions cannot belong to spouse if no spouse is defined in household');
       } else {
         setValidationError(null);
       }
     }}
     ```
  7. Render `{validationError && <div className="validation-error text-red-600 text-xs mt-1" role="alert">{validationError}</div>}` in both `panel-household` and `panel-accounts`.

#### 6. `src/components/SimulationTab.tsx` (`.toast-error` & Session Cache Leakage)
- **Problem**: `store.error` lacks `toast-error` class. Client-side `useEffect` calls `supabase.auth.getUser()` and inherits cached premium sessions in shared browser contexts, preventing `#premium-lock-card` from rendering for standard users.
- **Fix**: Modify line 127 to add `toast-error` to the class list: `className="toast-error p-4 bg-red-100 border border-red-300 text-red-700 rounded-2xl text-sm font-semibold text-center"`.
- **Fix**: Modify lines 13-29 (`useEffect`):
  ```tsx
  useEffect(() => {
    async function checkTier() {
      if (userTier !== 'premium') {
        setEffectiveTier(userTier);
        return;
      }
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('tier')
          .eq('id', authData.user.id)
          .single();
        if (profile?.tier) {
          setEffectiveTier(profile.tier);
        }
      }
    }
    checkTier();
  }, [userTier]);
  ```

## Resolved Conflicts & Dissenting Views
- None. Complete consensus achieved across all Explorers.
