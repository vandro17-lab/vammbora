import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { listarUiConfig, type UiConfigValor } from '@/data/ui-config';

interface UiConfigCtx {
  config: Record<string, UiConfigValor>;
  /** Valor publicado de uma chave (ou undefined → usar o padrão). */
  configDe: (key: string) => UiConfigValor | undefined;
  carregando: boolean;
  recarregar: () => Promise<void>;
}

const Ctx = createContext<UiConfigCtx>({
  config: {}, configDe: () => undefined, carregando: false, recarregar: async () => {},
});

/**
 * Provê a configuração visual publicada (textos etc.) para todo o app. Carrega uma
 * vez e recarrega após publicar/remover no editor. Sem banco/tabela, fica vazio e
 * os componentes usam os valores padrão.
 */
export function UiConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<Record<string, UiConfigValor>>({});
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try { setConfig(await listarUiConfig()); }
    finally { setCarregando(false); }
  }, []);

  useEffect(() => { void recarregar(); }, [recarregar]);

  const configDe = useCallback((key: string) => config[key], [config]);

  return <Ctx.Provider value={{ config, configDe, carregando, recarregar }}>{children}</Ctx.Provider>;
}

export const useUiConfig = () => useContext(Ctx);
