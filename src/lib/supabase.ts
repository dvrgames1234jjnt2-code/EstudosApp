import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

// Cliente principal — usado para auth, histórico, respostas, dúvidas.
// Singleton: reutiliza a mesma instância em todo o bundle do cliente.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'sb-main',        // chave exclusiva → evita colisão de GoTrueClient
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

// Cliente público — sem sessão de auth, sempre usa a anon key.
// Usado para leitura de dados públicos (questoes) que NÃO devem ser
// filtrados pela RLS de usuário logado.
// storageKey diferente garante que os dois GoTrueClients não colidem.
export const supabasePublic = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'sb-public',      // chave exclusiva → contexto isolado
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})
