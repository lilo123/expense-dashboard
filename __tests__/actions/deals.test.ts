import { 
  getDealsAction, 
  createDealAction, 
  updateDealAction, 
  toggleChecklistItemAction, 
  updateSpendProgressAction, 
  deleteDealAction 
} from '@/app/actions/deals';
import { DealStatusEnum } from '@/lib/dealValidators';
import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

describe('Finance Deals Actions', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws Unauthorized for unauthenticated users', async () => {
    mockSupabase = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: new Error('Auth error') }) }
    };
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);

    await expect(getDealsAction()).rejects.toThrow('Unauthorized');
    await expect(createDealAction({} as any)).rejects.toThrow('Unauthorized');
    await expect(updateDealAction('id', {} as any)).rejects.toThrow('Unauthorized');
    await expect(toggleChecklistItemAction('id', true)).rejects.toThrow('Unauthorized');
    await expect(updateSpendProgressAction('id', 100)).rejects.toThrow('Unauthorized');
    await expect(deleteDealAction('id')).rejects.toThrow('Unauthorized');
  });

  it('blocks standard tier users from accessing premium features', async () => {
    mockSupabase = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { tier: 'standard' }, error: null })
          })
        })
      })
    };
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);

    const deals = await getDealsAction();
    expect(deals).toEqual([]);

    await expect(createDealAction({} as any)).rejects.toThrow('Premium tier required');
    await expect(updateDealAction('id', {} as any)).rejects.toThrow('Premium tier required');
    await expect(toggleChecklistItemAction('id', true)).rejects.toThrow('Premium tier required');
    await expect(updateSpendProgressAction('id', 100)).rejects.toThrow('Premium tier required');
    await expect(deleteDealAction('id')).rejects.toThrow('Premium tier required');
  });

  const setupPremium = () => {
    const createChainable = (defaultResult: any = { data: null, error: null }) => {
      const c: any = {
        result: defaultResult,
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        upsert: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        then: function(resolve: any, reject: any) {
          if (c.result && c.result.error && c.result.error.forceReject) {
            return Promise.reject(c.result.error).catch(reject);
          }
          return Promise.resolve(c.result).then(resolve);
        }
      };
      return c;
    };

    const dealsChainable = createChainable();
    const itemsChainable = createChainable();

    mockSupabase = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-premium' } }, error: null }) },
      from: jest.fn().mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: { tier: 'premium' }, error: null })
              })
            })
          };
        }
        if (table === 'deal_checklist_items') {
          return itemsChainable;
        }
        return dealsChainable;
      })
    };
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);
    return { dealsChainable, itemsChainable, mockSupabase };
  };

  it('getDealsAction successfully fetches joined checklist items', async () => {
    const { dealsChainable } = setupPremium();
    const mockData = [{ id: 'deal-1', deal_checklist_items: [] }];
    dealsChainable.result = { data: mockData, error: null };

    const res = await getDealsAction();
    expect(res).toEqual(mockData);
    expect(mockSupabase.from).toHaveBeenCalledWith('deals');
    expect(dealsChainable.select).toHaveBeenCalledWith('*, deal_checklist_items(*)');
    
    dealsChainable.result = { data: null, error: { message: 'DB Error' } };
    await expect(getDealsAction()).rejects.toThrow('Failed to fetch deals');
  });

  it('createDealAction creates deals without checklist items', async () => {
    const { dealsChainable } = setupPremium();
    dealsChainable.result = { data: { id: 'new-deal' }, error: null };

    await createDealAction({ type: 'credit_card', company: 'Chase', type_specific_data: { card_name: 'Sapphire', action_date: '2026-07-01' } });
    expect(mockSupabase.from).toHaveBeenCalledWith('deals');
    expect(dealsChainable.insert).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith('/deals', 'layout');
  });

  it('createDealAction simulates transaction rollbacks if checklist items insert fails', async () => {
    const { dealsChainable, itemsChainable } = setupPremium();
    dealsChainable.result = { data: { id: 'new-deal-2' }, error: null };
    itemsChainable.result = { data: null, error: { message: 'Checklist insert failed' } };

    await expect(createDealAction({ type: 'bank_account', company: 'Citi', type_specific_data: { action_date: '2026-07-15' }, checklist_items: [{ action_text: 'Do it' }] })).rejects.toThrow('Failed to insert checklist items');
    expect(mockSupabase.from).toHaveBeenCalledWith('deals');
    expect(dealsChainable.delete).toHaveBeenCalled();
  });

  it('updateDealAction performs complex checklist synchronization with ownership verification', async () => {
    const { dealsChainable, itemsChainable } = setupPremium();
    dealsChainable.result = { data: { id: 'deal-1' }, error: null };
    
    // itemsChainable needs to return existing items during verify check, then success for upsert/delete
    itemsChainable.result = { data: [{ id: '11111111-1111-1111-1111-111111111111' }], error: null };

    const payload = {
      company: 'Citi',
      type: 'bank_account',
      type_specific_data: { action_date: '2026-08-01' },
      checklist_items: [
        { id: '11111111-1111-1111-1111-111111111111', action_text: 'Existing' },
        { action_text: 'New item' }
      ]
    };

    await updateDealAction('deal-1', payload);
    
    expect(mockSupabase.from).toHaveBeenCalledWith('deal_checklist_items');
    expect(itemsChainable.insert).toHaveBeenCalled();
    expect(itemsChainable.upsert).toHaveBeenCalled();
    expect(itemsChainable.delete).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith('/deals', 'layout');
  });

  it('toggleChecklistItemAction updates status and revalidates', async () => {
    const { itemsChainable } = setupPremium();
    itemsChainable.result = { data: { id: 'item-1' }, error: null };

    await toggleChecklistItemAction('item-1', true);
    
    expect(mockSupabase.from).toHaveBeenCalledWith('deal_checklist_items');
    expect(itemsChainable.update).toHaveBeenCalledWith({ is_done: true });
    expect(revalidatePath).toHaveBeenCalledWith('/deals', 'layout');
  });

  it('updateSpendProgressAction fetches, merges, and updates type_specific_data', async () => {
    const { dealsChainable } = setupPremium();
    dealsChainable.result = { 
      data: { type: 'credit_card', type_specific_data: { target_spend: 4000, spend_progress: 1000 } }, 
      error: null 
    };

    await updateSpendProgressAction('deal-1', 2500);

    expect(mockSupabase.from).toHaveBeenCalledWith('deals');
    expect(dealsChainable.select).toHaveBeenCalledWith('type, type_specific_data');
    expect(dealsChainable.update).toHaveBeenCalledWith({
      type_specific_data: { target_spend: 4000, spend_progress: 2500 }
    });
    expect(revalidatePath).toHaveBeenCalledWith('/deals', 'layout');
  });

  it('deleteDealAction enforces constraints and revalidates', async () => {
    const { dealsChainable } = setupPremium();
    dealsChainable.result = { data: { id: 'deal-1' }, error: null };

    await deleteDealAction('deal-1');

    expect(mockSupabase.from).toHaveBeenCalledWith('deals');
    expect(dealsChainable.delete).toHaveBeenCalled();
    expect(dealsChainable.eq).toHaveBeenCalledWith('id', 'deal-1');
    expect(dealsChainable.eq).toHaveBeenCalledWith('user_id', 'user-premium');
    expect(revalidatePath).toHaveBeenCalledWith('/deals', 'layout');
  });

  it('rejects createDealAction and updateDealAction on invalid Zod payloads', async () => {
    setupPremium();
    await expect(createDealAction({ type: 'invalid_type' })).rejects.toThrow('Invalid deal data');
    await expect(updateDealAction('deal-1', { type: 'invalid_type' })).rejects.toThrow('Invalid deal data');
  });

  it('handles database deletion and mutation failures securely', async () => {
    const { dealsChainable, itemsChainable } = setupPremium();
    dealsChainable.result = { data: null, error: { message: 'DB drop' } };
    itemsChainable.result = { data: null, error: { message: 'DB drop' } };

    await expect(deleteDealAction('deal-1')).rejects.toThrow('Failed to delete deal');
    await expect(toggleChecklistItemAction('item-1', true)).rejects.toThrow('Failed to toggle item');
  });

  it('allows creating and updating deals with canceled status', async () => {
    const { dealsChainable } = setupPremium();
    dealsChainable.result = { data: { id: 'canceled-deal', status: 'canceled' }, error: null };

    await createDealAction({
      type: 'credit_card',
      company: 'Amex',
      status: 'canceled',
      type_specific_data: { card_name: 'Cobalt', action_date: '2026-07-01' }
    });
    expect(mockSupabase.from).toHaveBeenCalledWith('deals');
    expect(dealsChainable.insert).toHaveBeenCalledWith(expect.objectContaining({ status: 'canceled' }));

    await updateDealAction('deal-1', {
      type: 'credit_card',
      company: 'Amex',
      status: 'canceled',
      type_specific_data: { card_name: 'Cobalt' }
    });
    expect(dealsChainable.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'canceled' }));
  });

  it('rejects invalid deal status in Zod schema', async () => {
    setupPremium();
    await expect(createDealAction({
      type: 'credit_card',
      company: 'Amex',
      status: 'invalid_status' as any,
      type_specific_data: { card_name: 'Cobalt' }
    })).rejects.toThrow('Invalid deal data');
  });

  it('validates all 6 statuses in DealStatusEnum and permits deal creation with them', async () => {
    const { dealsChainable } = setupPremium();
    dealsChainable.result = { data: { id: 'status-test-deal' }, error: null };

    const validStatuses = ['exploring', 'active', 'ready_to_claim', 'claimed', 'closed', 'canceled'] as const;

    for (const status of validStatuses) {
      expect(DealStatusEnum.parse(status)).toBe(status);

      await createDealAction({
        type: 'credit_card',
        company: 'Bank',
        status,
        type_specific_data: { card_name: 'Card' }
      });
      expect(dealsChainable.insert).toHaveBeenCalledWith(expect.objectContaining({ status }));
    }
  });
});

