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
const flag = import.meta.env.VITE_USE_SUPABASE;

/**
 * O Supabase é considerado ATIVO quando há URL + chave anon (ou seja, quando o
 * projeto foi configurado). A flag `VITE_USE_SUPABASE` é OPCIONAL e serve apenas
 * para FORÇAR o desligamento (`="false"`) — ex.: publicar uma demo sem banco
 * mesmo tendo as chaves. Assim, "configurei o Supabase" passa a bastar.
 *
 * Lembrete: estas variáveis são lidas no BUILD (Vite). Após configurá-las no
 * provedor de hospedagem, é preciso refazer o deploy para o app enxergá-las.
 */
export const USE_SUPABASE = !!url && !!anonKey && flag !== 'false';

export const supabase: SupabaseClient | null = USE_SUPABASE
  ? createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;
