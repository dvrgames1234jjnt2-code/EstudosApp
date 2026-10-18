import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

// Cliente principal — usado para auth, histórico, etc.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Cliente público — sem sessão de auth, sempre usa a anon key.
// Usado para leitura de dados públicos (questoes) que NÃO devem ser
// filtrados pela RLS de usuário logado.
export const supabasePublic = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})
