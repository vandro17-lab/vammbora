import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { listarAppAssets, type AppAsset } from '@/data/app-assets';

interface AppAssetsCtx {
  assets: Record<string, AppAsset>;
  /** URL publicada do slot, ou undefined (→ usar fallback). */
  url: (slot: string) => string | undefined;
  carregando: boolean;
  recarregar: () => Promise<void>;
}

const Ctx = createContext<AppAssetsCtx>({
  assets: {}, url: () => undefined, carregando: false, recarregar: async () => {},
});

/**
 * Provê as artes publicadas (slot -> URL) para todo o app. Carrega uma vez e
 * permite recarregar após publicar/remover no admin. Sem Supabase, fica vazio
 * e os componentes caem no fallback (visual atual).
 */
export function AppAssetsProvider({ children }: { children: ReactNode }) {
  const [assets, setAssets] = useState<Record<string, AppAsset>>({});
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try { setAssets(await listarAppAssets()); }
    finally { setCarregando(false); }
  }, []);

  useEffect(() => { void recarregar(); }, [recarregar]);

  const url = useCallback((slot: string) => assets[slot]?.url, [assets]);

  return <Ctx.Provider value={{ assets, url, carregando, recarregar }}>{children}</Ctx.Provider>;
}

export const useAppAssets = () => useContext(Ctx);
