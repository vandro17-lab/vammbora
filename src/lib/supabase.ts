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
 * PADRÃO do projeto Supabase do Vambora (para o app já nascer conectado sem
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
 * Login DEMONSTRATIVO do motorista — DESLIGADO por padrão.
 *
 * Padrão (fluxo real): o motorista autentica no Supabase e veículos/rotas são
 * gravados no banco (RLS por dono).
 *
 * Só quando VITE_DEMO_MOTORISTA="true" é definido explicitamente no build: a
 * tela de login entra direto no painel, sem verificação, e o painel usa o
 * armazenamento LOCAL do navegador (localStorage) em vez do Supabase.
 *
 * Sem Supabase configurado (USE_SUPABASE=false) o painel continua funcionando
 * localmente, como antes. A vitrine da família não é afetada por este flag.
 */
export const DEMO_MOTORISTA = import.meta.env.VITE_DEMO_MOTORISTA === 'true';

/**
 * Busca DEMONSTRATIVA da família — DESLIGADA por padrão.
 *
 * Padrão (fluxo real): a tela de resultados consulta `/api/buscar-rotas`, que
 * avalia as rotas REAIS cadastradas no Supabase com o motor de encaixe.
 *
 * Só com VITE_DEMO_BUSCA="true" explícito (ou sem Supabase configurado) a tela
 * mostra as ofertas de exemplo (motoristas e vans fictícios).
 */
export const DEMO_BUSCA = import.meta.env.VITE_DEMO_BUSCA === 'true';

export const supabase: SupabaseClient | null = USE_SUPABASE
  ? createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;
