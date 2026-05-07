import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import ResetPasswordForm from './ResetPasswordForm'

export default async function ResetPasswordPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login?error=Reset session expired or invalid. Please request a new link.')
  }

  return <ResetPasswordForm />
}
