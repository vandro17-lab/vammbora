import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Destino, Motorista } from '@/types';
import { listarDestinos, listarMotoristas } from '@/data/source';

interface VitrineData {
  destinos: Destino[];
  motoristas: Motorista[];
  destinosPorId: Record<string, Destino>;
  carregando: boolean;
  erro: boolean;
}

const Ctx = createContext<VitrineData>({
  destinos: [],
  motoristas: [],
  destinosPorId: {},
  carregando: true,
  erro: false,
});

/**
 * Carrega a vitrine (destinos + motoristas) uma vez e distribui às telas.
 * Fonte transparente: Supabase quando configurado, senão dados de exemplo locais
 * (ver src/data/source.ts). Assim as telas não sabem de onde vêm os dados.
 */
export function VitrineProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<VitrineData, 'destinosPorId'>>({
    destinos: [],
    motoristas: [],
    carregando: true,
    erro: false,
  });

  useEffect(() => {
    let vivo = true;
    Promise.all([listarDestinos(), listarMotoristas()])
      .then(([destinos, motoristas]) => {
        if (vivo) setState({ destinos, motoristas, carregando: false, erro: false });
      })
      .catch(() => {
        if (vivo) setState({ destinos: [], motoristas: [], carregando: false, erro: true });
      });
    return () => {
      vivo = false;
    };
  }, []);

  const destinosPorId = Object.fromEntries(state.destinos.map((d) => [d.id, d]));

  return <Ctx.Provider value={{ ...state, destinosPorId }}>{children}</Ctx.Provider>;
}

export const useVitrine = () => useContext(Ctx);
