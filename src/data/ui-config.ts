import { supabase } from '@/lib/supabase';

/**
 * Configuração visual do app (textos, e futuramente cabeçalhos/botões/cartões),
 * guardada como mapa `chave -> valor JSON` na tabela `app_ui_config`.
 *
 * Mesma filosofia do gerenciador de artes (app_assets): leitura pública; escrita
 * só admin (garantida por RLS no banco). A chave é um identificador ESTÁVEL de
 * componente (ex.: "rotas.header.titulo"), independente de posição no código.
 *
 * Enquanto a tabela não existir no banco (SQL ainda não aplicado), a leitura
 * devolve vazio (o app usa os valores padrão) e a publicação avisa com clareza.
 */

export interface EstiloTexto {
  tamanhoPx?: number;                 // tamanho absoluto da fonte
  peso?: number;                      // 400..800
  cor?: string;                       // hex
  alinhamento?: 'left' | 'center' | 'right';
}

export interface ConfigTexto {
  tipo: 'texto';
  conteudo?: string;                  // sobrescreve o texto padrão (opcional)
  estilo?: EstiloTexto;
}

/** União extensível (banner, botão, cartão… entram aqui depois). */
export type UiConfigValor = ConfigTexto;

/** Estilo base de um texto (para o painel pré-preencher os controles). */
export interface BaseTexto {
  tamanhoPx: number;
  peso: number;
  cor: string;
  alinhamento: 'left' | 'center' | 'right';
}

/** Definição de um texto editável no layout (identidade + padrão + base). */
export interface TextoDef {
  key: string;               // identificador estável, ex.: "rotas.header.titulo"
  padrao: string;            // conteúdo padrão (fallback)
  base: BaseTexto;           // estilo base, para o painel começar coerente
  conteudoEditavel: boolean; // false para textos dinâmicos (só a aparência muda)
}

const TABELA = 'app_ui_config';

/** Erro de "tabela inexistente" do PostgREST/Postgres (42P01). */
function tabelaInexistente(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42P01' || /relation .*app_ui_config.* does not exist/i.test(error.message ?? '');
}

/** Lê todas as configurações (chave -> valor). Sem banco/tabela, retorna vazio. */
export async function listarUiConfig(): Promise<Record<string, UiConfigValor>> {
  if (!supabase) return {};
  const { data, error } = await supabase.from(TABELA).select('key,value');
  if (error || !data) return {};
  const mapa: Record<string, UiConfigValor> = {};
  for (const row of data as Array<{ key: string; value: UiConfigValor }>) mapa[row.key] = row.value;
  return mapa;
}

/** Publica (upsert) a configuração de uma chave. Só admin (RLS). */
export async function publicarUiConfig(key: string, value: UiConfigValor): Promise<void> {
  if (!supabase) throw new Error('Banco não configurado neste ambiente.');
  const { error } = await supabase.from(TABELA).upsert({ key, value }, { onConflict: 'key' });
  if (error) {
    if (tabelaInexistente(error)) {
      throw new Error('A tabela app_ui_config ainda não foi criada no banco. Rode o SQL de migração indicado e tente de novo.');
    }
    throw new Error(error.message);
  }
}

/** Remove a configuração de uma chave (volta ao padrão). Só admin (RLS). */
export async function removerUiConfig(key: string): Promise<void> {
  if (!supabase) throw new Error('Banco não configurado neste ambiente.');
  const { error } = await supabase.from(TABELA).delete().eq('key', key);
  if (error && !tabelaInexistente(error)) throw new Error(error.message);
}
