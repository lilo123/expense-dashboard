// api.js - Centralized API and Supabase Client
export const supabaseUrl = 'https://zjanajeevdvhbeuyflmg.supabase.co';
export const supabaseKey = 'sb_publishable_alSzFV8OWSBkCnF8z5-0_Q_2MefRVwD';
export const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
