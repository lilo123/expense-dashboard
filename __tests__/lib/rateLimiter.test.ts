// Hoist-declare mockSupabase via Node global mapping to bypass Jest ES6 hoisting dead-zones
jest.mock('@supabase/supabase-js', () => {
  const mockClientInstance = {
    rpc: jest.fn(),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).mockSupabase = mockClientInstance;

  return {
    createClient: jest.fn(() => mockClientInstance),
  };
});

import { checkRateLimit } from '@/lib/rateLimiter';

// Retrieve the hoisted global mock reference securely
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSupabase = (global as any).mockSupabase;

describe('Centralized Serverless Rate Limiter Store (RPC)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock-url.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-key';
  });

  it('should fail open defensively if a database error occurs', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'DB Down' },
    });

    const res = await checkRateLimit('test-key', 5, 60000);
    expect(res.success).toBe(true);
    expect(res.remaining).toBe(5);
  });

  it('should allow the request and insert a new entry if no limit record exists', async () => {
    const futureReset = new Date(Date.now() + 60000);
    mockSupabase.rpc.mockResolvedValueOnce({
      data: [{ success: true, remaining: 4, reset_at: futureReset.toISOString() }],
      error: null,
    });

    const res = await checkRateLimit('test-key', 5, 60000);
    expect(res.success).toBe(true);
    expect(res.remaining).toBe(4);
    expect(res.reset.getTime()).toBeCloseTo(futureReset.getTime(), -2);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('check_rate_limit_rpc', {
      p_key: 'test-key',
      p_limit: 5,
      p_window_ms: 60000,
    });
  });

  it('should reset the counter and return success if the current time is past the reset_at window', async () => {
    const newReset = new Date(Date.now() + 60000);
    mockSupabase.rpc.mockResolvedValueOnce({
      data: [{ success: true, remaining: 4, reset_at: newReset.toISOString() }],
      error: null,
    });

    const res = await checkRateLimit('test-key', 5, 60000);
    expect(res.success).toBe(true);
    expect(res.remaining).toBe(4);
  });

  it('should reject request (success: false) if limit is reached within active window', async () => {
    const futureReset = new Date(Date.now() + 30000);
    mockSupabase.rpc.mockResolvedValueOnce({
      data: [{ success: false, remaining: 0, reset_at: futureReset.toISOString() }],
      error: null,
    });

    const res = await checkRateLimit('test-key', 5, 60000);
    expect(res.success).toBe(false);
    expect(res.remaining).toBe(0);
    expect(res.reset.getTime()).toBeCloseTo(futureReset.getTime(), -2);
  });

  it('should increment requests_count if under the limit within the active window', async () => {
    const futureReset = new Date(Date.now() + 30000);
    mockSupabase.rpc.mockResolvedValueOnce({
      data: [{ success: true, remaining: 2, reset_at: futureReset.toISOString() }],
      error: null,
    });

    const res = await checkRateLimit('test-key', 5, 60000);
    expect(res.success).toBe(true);
    expect(res.remaining).toBe(2);
  });
});
