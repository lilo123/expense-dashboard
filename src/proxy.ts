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
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
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

// Detect client IP address (Cloudflare connecting-ip takes priority)
function extractClientIp(request: NextRequest): string {
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp;

  const xRealIp = request.headers.get('x-real-ip');
  if (xRealIp) return xRealIp;

  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const firstIp = xff.split(',')[0].trim();
    if (firstIp) return firstIp;
  }

  return '127.0.0.1';
}

// Safely extract rate limiting identifier with precise cookie verification and IP binding
function extractRateLimitKey(request: NextRequest): string {
  const clientIp = extractClientIp(request);

  // 1. Check Authorization Bearer Header
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const sub = parseJwtSub(token);
    if (sub) return `auth:${sub}`;
  }

  // 2. Check Supabase SSR Chunked Authentication Cookies matching active project reference and insulating against OAuth Code Verifiers
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  let projectRef = '';
  try {
    const urlObj = new URL(supabaseUrl);
    projectRef = urlObj.hostname.split('.')[0] || '';
  } catch {
    // Ignore URL parse errors
  }
  const cookiePrefix = projectRef ? `sb-${projectRef}-auth-token` : 'sb-';

  const allCookies = request.cookies.getAll();
  const chunkedAuthCookies = allCookies
    .filter((c) => (c.name === cookiePrefix || c.name.startsWith(projectRef ? `${cookiePrefix}.` : 'sb-')) && !c.name.includes('-code-verifier'))
    .sort((a, b) => {
      const aParts = a.name.split('.');
      const bParts = b.name.split('.');
      const aIndex = aParts.length > 1 ? parseInt(aParts.pop() || '0', 10) : 0;
      const bIndex = bParts.length > 1 ? parseInt(bParts.pop() || '0', 10) : 0;
      return (isNaN(aIndex) ? 0 : aIndex) - (isNaN(bIndex) ? 0 : bIndex);
    });

  if (chunkedAuthCookies.length > 0) {
    try {
      const combinedCookieValue = chunkedAuthCookies.map((c) => c.value).join('');
      const decodedValue = decodeURIComponent(combinedCookieValue);
      if (decodedValue.startsWith('{') || decodedValue.startsWith('[')) {
        const sessionObj = JSON.parse(decodedValue);
        const token = sessionObj?.access_token || sessionObj?.[0]?.access_token;
        if (token) {
          const sub = parseJwtSub(token);
          if (sub) return `auth:${sub}`;
        }
        const userId = sessionObj?.user?.id || sessionObj?.[0]?.user?.id;
        if (userId) return `auth:${userId}`;
      } else {
        const sub = parseJwtSub(decodedValue);
        if (sub) return `auth:${sub}`;
      }
    } catch {
      // Unparseable JSON or damaged chunking structure; fall back gracefully
    }
  }

  // 2b. Fallback legacy check for sb-access-token cookie
  const tokenCookie = request.cookies.get('sb-access-token');
  if (tokenCookie?.value) {
    const sub = parseJwtSub(tokenCookie.value);
    if (sub) return `auth:${sub}`;
  }

  return `ip:${clientIp}`;
}

// Lazy singleton cache for Upstash Ratelimit to prevent Edge cold start lockout
let cachedRatelimit: Ratelimit | null = null;
let isInitialized = false;

function getRatelimit(): Ratelimit | null {
  if (isInitialized) return cachedRatelimit;
  
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    // Keep isInitialized false if env vars missing during early cold start so future runtime queries can retry
    return null;
  }

  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    cachedRatelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(
        Number(process.env.RATE_LIMIT_ALLOWANCE || 15), 
        (process.env.RATE_LIMIT_WINDOW || '60 s') as '60 s'
      ),
      analytics: true,
    });
    isInitialized = true;
  } catch (err) {
    console.error('Upstash Redis lazy initialization error:', err);
  }
  return cachedRatelimit;
}

export default async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // 1. Rate-limiting enforcement upfront BEFORE session handling or CSP compilation to prevent DDoS resource starvation
  let rateLimitHeaders: Record<string, string> = {};
  if (path === '/api/chat') {
    const ratelimit = getRatelimit();
    if (!process.env.UPSTASH_REDIS_REST_URL || !ratelimit) {
      console.warn('[RATE LIMITER NOTICE]: Upstash unconfigured, defaulting to fail-open local emulator mode');
    } else {
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
        } else {
          rateLimitHeaders = {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': reset.toString(),
          };
        }
      } catch (err) {
        console.warn('[RATE LIMITER NOTICE]: Rate limit service verification failed, bypassing rate limiter in fail-open mode');
        console.error('Rate limit failed (fail-open protection bypass active):', err);
      }
    }
  }

  // 2. Clean upfront separation for API JSON routing to insulate from HTML web page CSP header compilation overhead
  if (path.startsWith('/api/')) {
    const apiResponse = await updateSession(request);
    Object.entries(rateLimitHeaders).forEach(([k, v]) => apiResponse.headers.set(k, v));
    return apiResponse;
  }

  // 3. Dynamic Content Security Policy (CSP) Nonces Generation for Web HTML Routes
  const nonce = generateNonce();
  const isDev = process.env.NODE_ENV !== 'production';

  // Dynamically check if connecting to a local database emulator to unblock local E2E runs in production mode
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const isLocalDb = supabaseUrl.includes('localhost') || supabaseUrl.includes('127.0.0.1') || supabaseUrl.includes('[::1]');
  const localConnectOrigins = (isDev || isLocalDb)
    ? ' http://127.0.0.1:* http://localhost:* http://[::1]:* ws://127.0.0.1:* ws://localhost:* ws://[::1]:*' 
    : '';

  const devScriptSources = isDev ? " 'unsafe-eval'" : '';

  // Strictly whitelist required script sources, styles, and databases
  const cspHeaderValue = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com${devScriptSources};
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

  // Inject headers into request safely using new Headers immutability constructor
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspHeaderValue);

  // Call standard updateSession forwarding updated requestHeaders for downstream Server Component CSP nonce propagation
  const response = await updateSession(request, requestHeaders);

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
