import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import SettingsWrapper from '@/components/SettingsWrapper';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: userData, error } = await supabase.auth.getUser();

  // Secure Server Redirect: prevent unauthorized access
  if (error || !userData?.user) {
    redirect('/login');
  }

  return (
    <div className="max-w-md mx-auto py-8 px-4">
      <SettingsWrapper userEmail={userData.user.email || ''} />
    </div>
  );
}
