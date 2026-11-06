import { supabase } from '@/lib/supabase';

/** Uma arte publicada (mapeada a um slot). */
export interface AppAsset {
  slot: string;
  url: string;
  storage_path: string;
  content_type?: string | null;
  width?: number | null;
  height?: number | null;
  updated_at?: string | null;
}

const BUCKET = 'app-assets';

/** Lê todas as artes publicadas (slot -> arte). Sem Supabase, retorna vazio. */
export async function listarAppAssets(): Promise<Record<string, AppAsset>> {
  if (!supabase) return {};
  const { data, error } = await supabase
    .from('app_assets')
    .select('slot,url,storage_path,content_type,width,height,updated_at');
  if (error || !data) return {};
  const mapa: Record<string, AppAsset> = {};
  for (const a of data as AppAsset[]) mapa[a.slot] = a;
  return mapa;
}

/**
 * Publica uma arte em um slot: ENVIA ao Storage e só então registra na tabela.
 * Só retorna sucesso quando AMBOS (arquivo + registro) foram confirmados.
 * Em caso de falha no registro, remove o arquivo recém-enviado (sem órfão).
 * Substituição controlada: ao trocar, apaga o arquivo anterior do slot.
 */
export async function publicarAppAsset(
  slot: string,
  blob: Blob,
  dims: { width: number; height: number },
): Promise<AppAsset> {
  if (!supabase) throw new Error('Banco não configurado neste ambiente.');

  // arte anterior (para apagar depois que a nova estiver publicada)
  const { data: anterior } = await supabase
    .from('app_assets').select('storage_path').eq('slot', slot).maybeSingle();

  const ext = blob.type === 'image/webp' ? 'webp' : 'png';
  const path = `${slot}/${Date.now()}.${ext}`;

  const up = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type || 'image/png', upsert: false, cacheControl: '3600',
  });
  if (up.error) throw up.error;

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const url = pub.publicUrl;

  const { data, error } = await supabase
    .from('app_assets')
    .upsert({ slot, url, storage_path: path, content_type: blob.type, width: dims.width, height: dims.height }, { onConflict: 'slot' })
    .select()
    .single();

  if (error || !data) {
    // registro falhou → não deixa arquivo órfão
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    throw error ?? new Error('Falha ao registrar a arte.');
  }

  // sucesso: remove o arquivo anterior do slot (se houver e for diferente)
  if (anterior?.storage_path && anterior.storage_path !== path) {
    await supabase.storage.from(BUCKET).remove([anterior.storage_path]).catch(() => {});
  }
  return data as AppAsset;
}

/** Remove a arte de um slot (volta ao fallback). Apaga registro e arquivo. */
export async function removerAppAsset(slot: string, storagePath?: string): Promise<void> {
  if (!supabase) throw new Error('Banco não configurado neste ambiente.');
  const { error } = await supabase.from('app_assets').delete().eq('slot', slot);
  if (error) throw error;
  if (storagePath) await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
}
