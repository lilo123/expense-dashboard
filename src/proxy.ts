import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'
import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

// Cryptographically secure random nonce generator (base64)
function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  let binary = '';
  for (let i = 0; i < array.length; i++) {
    binary += String.fromCharCode(array[i]);
  }
  return btoa(binary);
}

// Parse the 'sub' claim (user ID) from a JWT payload without external library
function parseJwtSub(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    return payload.sub || null;
  } catch {
    return null;
  }
}

// Extract the rate limiting identifier: JWT sub for authenticated user, IP address for public
function extractRateLimitKey(request: NextRequest): string {
  // 1. Check Authorization Bearer Header
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const sub = parseJwtSub(token);
    if (sub) return `auth:${sub}`;
  }

  // 2. Check sb-access-token cookie
  const tokenCookie = request.cookies.get('sb-access-token');
  if (tokenCookie?.value) {
    const sub = parseJwtSub(tokenCookie.value);
    if (sub) return `auth:${sub}`;
  }

  // 3. Public Client IP detection (Cloudflare proxy header connecting-ip takes priority)
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return `ip:${cfIp}`;

  const xRealIp = request.headers.get('x-real-ip');
  if (xRealIp) return `ip:${xRealIp}`;

  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const firstIp = xff.split(',')[0].trim();
    if (firstIp) return `ip:${firstIp}`;
  }

  return 'ip:127.0.0.1';
}

// Initialize Upstash Redis Rate-limiter with sliding window (15 requests per minute)
let ratelimit: Ratelimit | null = null;
try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(15, '60 s'),
      analytics: true,
    });
  }
} catch (err) {
  console.error('Upstash Redis initialization error:', err);
}

export default async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // 1. Rate-limiting enforcement (Fail-open if Upstash fails or env missing)
  if (path === '/api/chat' && ratelimit) {
    try {
      const key = extractRateLimitKey(request);
      const { success, limit, reset, remaining } = await ratelimit.limit(key);

      if (!success) {
        return new NextResponse(
          JSON.stringify({ error: 'Too Many Requests. Please wait before sending more messages.' }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'X-RateLimit-Limit': limit.toString(),
              'X-RateLimit-Remaining': remaining.toString(),
              'X-RateLimit-Reset': reset.toString(),
            },
          }
        );
      }
    } catch (err) {
      console.error('Rate limit failed (fail-open protection bypass active):', err);
    }
  }

  // 2. Dynamic Content Security Policy (CSP) Nonces Generation
  const nonce = generateNonce();

  // Dynamically check if connecting to a local database emulator to unblock local E2E runs in production mode
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const isLocalDb = supabaseUrl.includes('localhost') || supabaseUrl.includes('127.0.0.1') || supabaseUrl.includes('[::1]');
  const localConnectOrigins = isLocalDb 
    ? ' http://127.0.0.1:* http://localhost:* http://[::1]:* ws://127.0.0.1:* ws://localhost:* ws://[::1]:*' 
    : '';

  // Strictly whitelist required script sources, styles, and databases
  const cspHeaderValue = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com;
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data:;
    font-src 'self' data:;
    connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com${localConnectOrigins};
    frame-src 'self' https://challenges.cloudflare.com;
    media-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    block-all-mixed-content;
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, ' ').trim();

  // Inject headers into request first so updateSession picks them up in cloned NextResponse
  request.headers.set('x-nonce', nonce);
  request.headers.set('Content-Security-Policy', cspHeaderValue);

  // Call standard updateSession (handles Auth redirect gates)
  const response = await updateSession(request);

  // Append CSP header and x-nonce to response headers so browser receives it
  response.headers.set('Content-Security-Policy', cspHeaderValue);
  response.headers.set('x-nonce', nonce);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - all image/font/svg assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf|eot)$).*)',
  ],
};
