import { createClient } from '@supabase/supabase-js';

// Cliente do lado do servidor com Service Role Key (acesso total, ignora RLS)
// Usado SOMENTE em API routes (server-side), nunca no browser.
export function createSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
