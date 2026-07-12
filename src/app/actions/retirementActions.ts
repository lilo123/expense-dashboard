'use server';

import { createClient } from '@/utils/supabase/server';
import { SimulationConfig } from '@/types/simulation';

export async function saveSimulationConfig(config: SimulationConfig): Promise<{ success: boolean; id?: string; error?: string }> {
  const supabase = await createClient();

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return { success: false, error: 'Unauthorized' };
    }

    const sessionUserId = userData.user.id;

    // BOLA defense: verify auth.uid() === config.userId
    if (config.userId && config.userId !== sessionUserId) {
      return { success: false, error: 'BOLA Defense Violation: Unauthorized user ID mismatch.' };
    }

    // Fetch user profile to check tier
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', sessionUserId)
      .single();

    if (profileError) {
      return { success: false, error: 'Failed to fetch user profile.' };
    }

    const isPremium = profile?.tier === 'premium';
    const totalYears = config.duration + (config.timelineMode === 'retirement_and_accumulation' && config.retirementAge && config.currentAge ? Math.max(0, config.retirementAge - config.currentAge) : 0);

    // Premium entitlement check
    if (!isPremium && (totalYears >= 125 || config.minWithdrawalLimitEnabled || config.maxWithdrawalLimitEnabled)) {
      return { success: false, error: 'Premium tier required to save 125-year historical range simulation or custom guardrails.' };
    }

    // Resolve household_id
    let householdId = config.householdId;
    if (!householdId) {
      const { data: households } = await supabase
        .from('households')
        .select('id')
        .eq('user_id', sessionUserId)
        .limit(1);

      if (households && households.length > 0) {
        householdId = households[0].id;
      } else {
        // Create default household
        const { data: newHousehold, error: hError } = await supabase
          .from('households')
          .insert({
            user_id: sessionUserId,
            name: 'Default Household',
            province_or_state: 'CA',
            country: 'US',
          })
          .select('id')
          .single();

        if (hError || !newHousehold) {
          return { success: false, error: 'Failed to create default household.' };
        }
        householdId = newHousehold.id;
      }
    }

    const historicalRange = totalYears >= 125 ? '125' : totalYears.toString();

    // Insert into simulation_configs
    const { data: savedConfig, error: insertError } = await supabase
      .from('simulation_configs')
      .insert({
        household_id: householdId,
        user_id: sessionUserId,
        historical_range: historicalRange,
        simulation_paths: config.simulationMode === 'monte_carlo' ? 1000 : 50,
        market_data_mode: config.marketDataMode || 'us',
        withdrawal_strategy: config.withdrawalStrategy || 'constant_dollar',
        rebalance_frequency: config.rebalanceFrequency || 1,
        guardrails_enabled: !!(config.minWithdrawalLimitEnabled || config.maxWithdrawalLimitEnabled),
      })
      .select('id')
      .single();

    if (insertError) {
      return { success: false, error: insertError.message || 'Failed to save simulation configuration.' };
    }

    return { success: true, id: savedConfig.id };
  } catch (err: any) {
    console.error('[SERVER ACTION saveSimulationConfig FAILURE]:', err);
    return { success: false, error: err.message || 'An unexpected error occurred.' };
  }
}
