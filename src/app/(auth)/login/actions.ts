'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function login(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    redirect('/login?error=' + encodeURIComponent('Could not authenticate user'))
    return
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signup(formData: FormData) {
  const rawEmail = formData.get('email') as string
  const password = formData.get('password') as string
  const secret = formData.get('secret') as string | null
  const email = rawEmail.toLowerCase().trim()

  const secretParam = secret ? `&secret=${secret}` : ''

  if (secret !== 'flow-vip') {
    redirect('/login?error=' + encodeURIComponent('Account access denied. Please request an invitation to enter An-yen.'))
    return
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    redirect(`/login?error=${encodeURIComponent('Server configuration error')}${secretParam}`)
    return
  }

  const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey)

  // 1. Authorization & Allocation Status Gate
  const { data: invites, error: inviteError } = await serviceClient
    .from('invite_requests')
    .select('id, status')
    .ilike('email', email)
    .eq('status', 'approved')
    .limit(1)

  const invite = invites?.[0]

  if (inviteError || !invite) {
    redirect(`/login?error=${encodeURIComponent('Account access denied. This email address has not been approved for early access.')}${secretParam}`)
    return
  }

  // 2. Provision user securely via Admin API (since enable_signup = false)
  const { data: authData, error: createError } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createError || !authData?.user) {
    redirect(`/login?error=${encodeURIComponent('Could not create user account')}${secretParam}`)
    return
  }

  // 3. Transition invite status to claimed
  await serviceClient
    .from('invite_requests')
    .update({ status: 'claimed', updated_at: new Date().toISOString() })
    .eq('id', invite.id)

  // 4. Sign the user in smoothly
  const supabase = await createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
  if (signInError) {
    redirect(`/login?error=${encodeURIComponent('Account successfully created, but automatic sign-in timed out. Please sign in below using your new password.')}${secretParam}`)
    return
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
