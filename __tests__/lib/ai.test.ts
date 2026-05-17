import { extractExpenseFromMessage } from '@/lib/ai';

describe('AI Extraction Service & Orchestration Gate', () => {
  const mockCategories = [
    { id: 'cat-1', name: 'Groceries' },
    { id: 'cat-2', name: 'Dining Out' },
    { id: 'cat-3', name: 'Misc' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GROQ_API_KEY = 'gsk_test_mock_key_for_tests';
    
    // Setup mock global fetch
    global.fetch = jest.fn();
  });

  it('should extract transaction currency defaulting strictly to user base currency', async () => {
    const mockLlmResponse = {
      choices: [{
        message: {
          tool_calls: [{
            function: {
              name: 'extract_expense',
              arguments: JSON.stringify({
                amount: 25.50,
                currency: 'CAD', // Extracted defaulting to base CAD
                category: 'Groceries',
                item: 'Bananas and Milk',
                date: '2026-05-16',
              }),
            },
          }],
        },
      }],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue(mockLlmResponse),
    });

    const res = await extractExpenseFromMessage(
      'spent 25.50 on Bananas and Milk', 
      mockCategories, 
      'CAD'
    );

    expect(res).not.toHaveProperty('error');
    const successRes = res as any;
    expect(successRes.amount).toBe(25.50);
    expect(successRes.currency).toBe('CAD');
    expect(successRes.category_id).toBe('cat-1');
    expect(successRes.item).toBe('Bananas and Milk');
    
    // Assert fetch parameters set tool_choice to auto for general queries
    const fetchArgs = (global.fetch as jest.Mock).mock.calls[0][1];
    const parsedBody = JSON.parse(fetchArgs.body);
    expect(parsedBody.tool_choice).toBe('auto');
  });

  it('should extract foreign currency spent explicitly', async () => {
    const mockLlmResponse = {
      choices: [{
        message: {
          tool_calls: [{
            function: {
              name: 'extract_expense',
              arguments: JSON.stringify({
                amount: 500000,
                currency: 'VND', // AI extracts raw spent currency VND
                category: 'Misc',
                item: 'Taxi ride',
                date: '2026-05-16',
              }),
            },
          }],
        },
      }],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue(mockLlmResponse),
    });

    const res = await extractExpenseFromMessage(
      'spent 500000 VND on a Taxi ride', 
      mockCategories, 
      'CAD'
    );

    expect(res).not.toHaveProperty('error');
    const successRes = res as any;
    expect(successRes.amount).toBe(500000);
    expect(successRes.currency).toBe('VND');
    expect(successRes.category_id).toBe('cat-3');
  });

  it('should force tool execution when option forceTool is enabled', async () => {
    const mockLlmResponse = {
      choices: [{
        message: {
          tool_calls: [{
            function: {
              name: 'extract_expense',
              arguments: JSON.stringify({
                amount: 10,
                currency: 'USD',
                category: 'Dining Out',
                item: 'Burger',
                date: '2026-05-16',
              }),
            },
          }],
        },
      }],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue(mockLlmResponse),
    });

    const res = await extractExpenseFromMessage(
      'spent 10 USD on a burger', 
      mockCategories, 
      'CAD',
      { forceTool: true }
    );

    expect(res).not.toHaveProperty('error');
    
    // Assert fetch parameters forced tool execution schema
    const fetchArgs = (global.fetch as jest.Mock).mock.calls[0][1];
    const parsedBody = JSON.parse(fetchArgs.body);
    expect(parsedBody.tool_choice).toEqual({
      type: 'function',
      function: { name: 'extract_expense' },
    });
  });
});
