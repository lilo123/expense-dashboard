import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            const { domain, ...restOptions } = options;
            cookieStore.set({ name, value, ...restOptions, secure: process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('127.0.0.1') ? false : options.secure })
          } catch (error) {
            // Handle cookie setter errors in Server Components
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            const { domain, ...restOptions } = options;
            cookieStore.set({ name, value: '', ...restOptions, secure: process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('127.0.0.1') ? false : options.secure })
          } catch (error) {
            // Handle cookie setter errors in Server Components
          }
        },
      },
    }
  )
}
