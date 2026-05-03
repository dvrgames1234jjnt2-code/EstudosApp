import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://iqzfceidhkgwpfenhsuf.supabase.co'
const supabaseAnonKey = 'sb_publishable_Oqmtx5EKYt6ZC9_Fdnhe1Q_iQ2Fnzh6'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
