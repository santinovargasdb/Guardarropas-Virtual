import { createClient } from '@supabase/supabase-js';

// Strip trailing slash so the SDK never constructs double-slash paths
// (e.g. "https://xxx.supabase.co/" → "https://xxx.supabase.co").
const rawUrl      = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseUrl = rawUrl.replace(/\/+$/, '');
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured =
  supabaseUrl.trim()      !== '' &&
  supabaseAnonKey.trim()  !== '' &&
  supabaseUrl             !== 'tu_supabase_url' &&
  supabaseAnonKey         !== 'tu_supabase_anon_key';

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      db: { schema: 'public' },
    })
  : null;
