import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase (opcional).
 *
 * A vitrine da demonstração funciona SEM Supabase (dados de exemplo locais).
 * O Supabase só é ativado quando as três condições abaixo são verdadeiras:
 *   - VITE_USE_SUPABASE = "true"
 *   - VITE_SUPABASE_URL preenchida
 *   - VITE_SUPABASE_ANON_KEY preenchida (chave PÚBLICA/anon — nunca a secreta)
 *
 * A segurança real vem das políticas RLS no banco, não de esconder a chave anon.
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const USE_SUPABASE =
  import.meta.env.VITE_USE_SUPABASE === 'true' && !!url && !!anonKey;

export const supabase: SupabaseClient | null = USE_SUPABASE
  ? createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;
