'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { DealSchema } from '@/lib/dealValidators';

async function requirePremiumUser(supabase: any) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) throw new Error('Unauthorized');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', authData.user.id)
    .single();

  if (profileError) {
    console.error('[requirePremiumUser] Profile DB Error:', profileError);
    throw new Error('Service temporarily unavailable');
  }

  if (profile?.tier !== 'premium') {
    throw new Error('Premium tier required');
  }

  return authData.user;
}

export async function getDealsAction() {
  const supabase = await createClient();
  try {
    const user = await requirePremiumUser(supabase);
    const { data, error } = await supabase
      .from('deals')
      .select('*, deal_checklist_items(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[getDealsAction] DB Error:', error);
      throw new Error('Failed to fetch deals');
    }
    return data;
  } catch (err: any) {
    if (err.message === 'Premium tier required') return [];
    throw err;
  }
}

export async function createDealAction(data: unknown) {
  const supabase = await createClient();
  const user = await requirePremiumUser(supabase);

  const parsedResult = DealSchema.safeParse(data);
  if (!parsedResult.success) {
    console.error('SafeParse Error:', parsedResult.error.format()); 
    throw new Error('Invalid deal data');
  }
  const parsed = parsedResult.data;
  const { checklist_items, ...dealData } = parsed as any;

  const { data: insertedDeal, error: dealError } = await supabase
    .from('deals')
    .insert({
      user_id: user.id,
      company: dealData.company,
      type: dealData.type,
      status: dealData.status,
      open_date: dealData.open_date,
      note: dealData.note,
      currency: dealData.currency,
      bonus_amount: dealData.bonus_amount,
      type_specific_data: dealData.type_specific_data,
    })
    .select()
    .single();

  if (dealError) {
    console.error('[createDealAction] Deal Error:', dealError);
    throw new Error('Failed to create deal');
  }

  if (checklist_items && checklist_items.length > 0) {
    const itemsToInsert = checklist_items.map((item: any) => ({
      deal_id: insertedDeal.id,
      user_id: user.id,
      action_text: item.action_text,
      deadline: item.deadline,
      is_done: item.is_done,
    }));
    const { error: itemsError } = await supabase
      .from('deal_checklist_items')
      .insert(itemsToInsert);

    if (itemsError) {
      const { error: rollbackError } = await supabase.from('deals').delete().eq('id', insertedDeal.id).eq('user_id', user.id);
      if (rollbackError) console.error('[createDealAction] Rollback Error:', rollbackError);
      console.error('[createDealAction] Items Error:', itemsError);
      throw new Error('Failed to insert checklist items');
    }
  }

  revalidatePath('/deals', 'layout');
  return insertedDeal;
}

export async function updateDealAction(id: string, data: unknown) {
  const supabase = await createClient();
  const user = await requirePremiumUser(supabase);

  const parsedResult = DealSchema.safeParse(data);
  if (!parsedResult.success) {
    console.error('SafeParse Error:', parsedResult.error.format()); 
    throw new Error('Invalid deal data');
  }
  const parsed = parsedResult.data;
  const { checklist_items, ...dealData } = parsed as any;

  const { data: updatedDeal, error: dealError } = await supabase
    .from('deals')
    .update({
      company: dealData.company,
      type: dealData.type,
      status: dealData.status,
      open_date: dealData.open_date,
      note: dealData.note,
      currency: dealData.currency,
      bonus_amount: dealData.bonus_amount,
      type_specific_data: dealData.type_specific_data,
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (dealError || !updatedDeal) {
    console.error('[updateDealAction] Deal Error:', dealError);
    throw new Error('Failed to update deal');
  }

  if (checklist_items) {
    const itemsToInsert = checklist_items.filter((i: any) => !i.id).map((item: any) => ({
      deal_id: id,
      user_id: user.id,
      action_text: item.action_text,
      deadline: item.deadline,
      is_done: item.is_done,
    }));
    
    const itemsToUpdateRaw = checklist_items.filter((i: any) => i.id);
    const updatedIds = itemsToUpdateRaw.map((i: any) => i.id);

    if (updatedIds.length > 0) {
      const { data: existingItems, error: verifyError } = await supabase
        .from('deal_checklist_items')
        .select('id')
        .eq('deal_id', id)
        .eq('user_id', user.id)
        .in('id', updatedIds);

      if (verifyError || !existingItems || existingItems.length !== updatedIds.length) {
        console.error('[updateDealAction] Ownership Verify Error:', verifyError);
        throw new Error('Unauthorized item modification');
      }
    }

    const itemsToUpdate = itemsToUpdateRaw.map((item: any) => ({
      id: item.id,
      deal_id: id,
      user_id: user.id,
      action_text: item.action_text,
      deadline: item.deadline,
      is_done: item.is_done,
    }));

    if (itemsToInsert.length > 0) {
      const { error } = await supabase.from('deal_checklist_items').insert(itemsToInsert);
      if (error) {
        console.error('[updateDealAction] Insert Items Error:', error);
        throw new Error('Failed to insert items');
      }
    }
    
    if (itemsToUpdate.length > 0) {
      const { error } = await supabase.from('deal_checklist_items').upsert(itemsToUpdate, { onConflict: 'id' });
      if (error) {
        console.error('[updateDealAction] Update Items Error:', error);
        throw new Error('Failed to update items');
      }
    }
    
    if (updatedIds.length > 0) {
      const { error: delErr } = await supabase.from('deal_checklist_items').delete().eq('deal_id', id).eq('user_id', user.id).not('id', 'in', `(${updatedIds.join(',')})`);
      if (delErr) console.error('[updateDealAction] Cleanup Error:', delErr);
    } else {
      const { error: delErr } = await supabase.from('deal_checklist_items').delete().eq('deal_id', id).eq('user_id', user.id);
      if (delErr) console.error('[updateDealAction] Cleanup Error:', delErr);
    }
  }

  revalidatePath('/deals', 'layout');
  return updatedDeal;
}

export async function toggleChecklistItemAction(itemId: string, isDone: boolean) {
  const supabase = await createClient();
  const user = await requirePremiumUser(supabase);

  if (!itemId || typeof isDone !== 'boolean') throw new Error('Invalid input');

  const { data, error } = await supabase
    .from('deal_checklist_items')
    .update({ is_done: isDone })
    .eq('id', itemId)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error || !data) {
    console.error('[toggleChecklistItemAction] Error:', error);
    throw new Error('Failed to toggle item');
  }
  
  revalidatePath('/deals', 'layout');
  return { success: true };
}

export async function updateSpendProgressAction(id: string, progress: number) {
  const supabase = await createClient();
  const user = await requirePremiumUser(supabase);

  if (!id || typeof progress !== 'number' || isNaN(progress) || progress < 0) {
    throw new Error('Invalid spend progress input');
  }

  const { data: deal, error: fetchError } = await supabase
    .from('deals')
    .select('type, type_specific_data')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();
    
  if (fetchError || !deal) throw new Error('Deal not found');
  if (deal.type !== 'credit_card') throw new Error('Progress update only supported for credit cards');
  
  const updatedData = { ...deal.type_specific_data, spend_progress: progress };

  const { error: updateError } = await supabase
    .from('deals')
    .update({ type_specific_data: updatedData })
    .eq('id', id)
    .eq('user_id', user.id);

  if (updateError) {
    console.error('[updateSpendProgressAction] Error:', updateError);
    throw new Error('Failed to update progress');
  }
  
  revalidatePath('/deals', 'layout');
  return { success: true, progress };
}

export async function deleteDealAction(id: string) {
  const supabase = await createClient();
  const user = await requirePremiumUser(supabase);

  const { data: existing, error: findError } = await supabase
    .from('deals')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (findError || !existing) {
    console.error('[deleteDealAction] Deal not found:', findError);
    throw new Error('Failed to delete deal');
  }

  const { error } = await supabase
    .from('deals')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('[deleteDealAction] Error:', error);
    throw new Error('Failed to delete deal');
  }
  
  revalidatePath('/deals', 'layout');
  return { success: true };
}
