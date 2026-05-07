'use server'

import { createClient } from '@/utils/supabase/server'
import { headers } from 'next/headers'

export async function forgotPasswordAction(email: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  
  const headersList = await headers()
  const host = headersList.get('host')
  const proto = headersList.get('x-forwarded-proto') || 'http'
  const origin = `${proto}://${host}`

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}
