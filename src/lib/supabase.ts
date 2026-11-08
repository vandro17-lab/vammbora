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
/**
 * PADRÃO do projeto Supabase do VanBora (para o app já nascer conectado sem
 * depender de variáveis de ambiente no provedor de deploy).
 *
 * A chave abaixo é a ANON/pública (role "anon"): ela já vai embutida no bundle
 * do site de qualquer forma — não é segredo. A segurança real é garantida pelas
 * políticas RLS no banco (ex.: escrever artes só admin). Para apontar outro
 * projeto, basta definir as variáveis VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY;
 * para forçar o modo demonstração (sem banco), defina VITE_USE_SUPABASE=false.
 */
const DEFAULT_SUPABASE_URL = 'https://rnulmjdsvvuirqijemzy.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJudWxtamRzdnZ1aXJxaWplbXp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3NDk5NjIsImV4cCI6MjEwOTMyNTk2Mn0.Cbne-PvsCtoLcSHgLk89DwmU-bSMPYJvRy61B7_g3a4';

const url = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
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

/**
 * Login DEMONSTRATIVO do motorista (ligado por padrão).
 *
 * Quando ativo, a tela de login do motorista NÃO faz verificação real: entra
 * direto no painel, e o painel do motorista passa a usar o armazenamento LOCAL
 * do navegador (localStorage) em vez do Supabase — assim a demonstração nunca
 * trava por autenticação, cold start ou servidor indisponível.
 *
 * A vitrine da família (escolas, mapas) continua usando o Supabase normalmente;
 * este flag afeta SOMENTE o login e o painel do motorista. Para exigir login
 * real do motorista, defina VITE_DEMO_MOTORISTA="false".
 */
export const DEMO_MOTORISTA = import.meta.env.VITE_DEMO_MOTORISTA !== 'false';

export const supabase: SupabaseClient | null = USE_SUPABASE
  ? createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;
