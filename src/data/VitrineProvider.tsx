import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Destino, Motorista } from '@/types';
import { listarDestinos, listarMotoristas, MODO_DEMO } from '@/data/source';

export type VitrineStatus = 'carregando' | 'pronto' | 'erro';

interface VitrineData {
  destinos: Destino[];
  motoristas: Motorista[];
  destinosPorId: Record<string, Destino>;
  status: VitrineStatus;
  /** true quando rodando com dados de exemplo (Supabase desligado). */
  modoDemo: boolean;
  /** Recarrega a vitrine (usado no "tentar de novo"). */
  recarregar: () => void;
}

const Ctx = createContext<VitrineData>({
  destinos: [],
  motoristas: [],
  destinosPorId: {},
  status: 'carregando',
  modoDemo: MODO_DEMO,
  recarregar: () => {},
});

/**
 * Carrega a vitrine (destinos + motoristas) e distribui às telas.
 * Fonte transparente: Supabase quando configurado, senão dados de exemplo locais.
 * Com o Supabase ativo, uma falha vira status 'erro' (NÃO cai em demonstração
 * escondido); a tela oferece "tentar de novo".
 */
export function VitrineProvider({ children }: { children: ReactNode }) {
  const [destinos, setDestinos] = useState<Destino[]>([]);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [status, setStatus] = useState<VitrineStatus>('carregando');

  const carregar = useCallback(async () => {
    setStatus('carregando');
    try {
      const [d, m] = await Promise.all([listarDestinos(), listarMotoristas()]);
      setDestinos(d);
      setMotoristas(m);
      setStatus('pronto');
    } catch {
      setDestinos([]);
      setMotoristas([]);
      setStatus('erro');
    }
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      if (vivo) await carregar();
    })();
    return () => {
      vivo = false;
    };
  }, [carregar]);

  const destinosPorId = Object.fromEntries(destinos.map((d) => [d.id, d]));

  return (
    <Ctx.Provider
      value={{
        destinos,
        motoristas,
        destinosPorId,
        status,
        modoDemo: MODO_DEMO,
        recarregar: carregar,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useVitrine = () => useContext(Ctx);
