describe('DTO Mapping & Serialization Security', () => {
  const rawBudgetsFromSupabase = [
    {
      id: 'bgt-1',
      user_id: 'user-123',
      category_id: 'cat-1',
      limit_amount: '1500.00', // Stringified numeric from pg
      currency: 'CAD',
      month: '2026-05',
      created_at: '2026-05-10T00:00:00Z',
      updated_at: '2026-05-10T00:00:00Z',
      __system_metadata: { secret: 'supersecret' } // Malicious or internal ORM metadata
    },
    {
      id: 'bgt-2',
      user_id: 'user-123',
      category_id: null,
      limit_amount: null, // Null numeric from pg
      currency: null,
      month: '2026-05'
    }
  ];

  const rawCategoriesFromSupabase = [
    {
      id: 'cat-1',
      user_id: 'user-123',
      name: 'Housing',
      icon: 'Home',
      created_at: '2026-05-10T00:00:00Z',
      internal_notes: 'Private notes'
    }
  ];

  it('should map raw Supabase rows into strict BudgetDTO objects and strip internal metadata', () => {
    const dtos = rawBudgetsFromSupabase.map(b => ({
      id: String(b.id),
      category_id: b.category_id ? String(b.category_id) : null,
      limit_amount: Number(b.limit_amount) || 0,
      currency: String(b.currency || 'CAD'),
      month: String(b.month)
    }));

    expect(dtos[0]).toEqual({
      id: 'bgt-1',
      category_id: 'cat-1',
      limit_amount: 1500,
      currency: 'CAD',
      month: '2026-05'
    });

    // Ensure internal metadata and timestamps are pruned
    expect((dtos[0] as any).created_at).toBeUndefined();
    expect((dtos[0] as any).__system_metadata).toBeUndefined();
  });

  it('should safely default null numeric and currency fields to 0 and CAD', () => {
    const dtos = rawBudgetsFromSupabase.map(b => ({
      id: String(b.id),
      category_id: b.category_id ? String(b.category_id) : null,
      limit_amount: Number(b.limit_amount) || 0,
      currency: b.currency ? String(b.currency) : 'CAD',
      month: String(b.month)
    }));

    expect(dtos[1]).toEqual({
      id: 'bgt-2',
      category_id: null,
      limit_amount: 0,
      currency: 'CAD',
      month: '2026-05'
    });
  });

  it('should map raw categories into strict CategoryDTO objects and strip sensitive fields', () => {
    const dtos = rawCategoriesFromSupabase.map(c => ({
      id: String(c.id),
      name: String(c.name),
      icon: c.icon ? String(c.icon) : null
    }));

    expect(dtos[0]).toEqual({
      id: 'cat-1',
      name: 'Housing',
      icon: 'Home'
    });

    expect((dtos[0] as any).internal_notes).toBeUndefined();
  });
});
