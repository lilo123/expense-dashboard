import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          if (typeof document === 'undefined') return '';
          const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
          return match ? decodeURIComponent(match[2]) : '';
        },
        set(name: string, value: string, options: any) {
          if (typeof document === 'undefined') return;
          let cookieStr = `${name}=${encodeURIComponent(value)}`;
          if (options.path) cookieStr += `; path=${options.path}`;
          if (options.maxAge) cookieStr += `; max-age=${options.maxAge}`;
          if (options.sameSite) cookieStr += `; samesite=${options.sameSite}`;
          if (options.secure && !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('127.0.0.1')) cookieStr += `; secure`;
          document.cookie = cookieStr;
        },
        remove(name: string, options: any) {
          if (typeof document === 'undefined') return;
          let cookieStr = `${name}=; max-age=0`;
          if (options.path) cookieStr += `; path=${options.path}`;
          if (options.sameSite) cookieStr += `; samesite=${options.sameSite}`;
          if (options.secure && !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('127.0.0.1')) cookieStr += `; secure`;
          document.cookie = cookieStr;
        }
      }
    }
  )
}
