import { useCallback, useEffect, useState } from 'react';
import { listarVeiculos, listarRotas } from '@/data/motorista-store';
import {
  cenarioDemo, calcularIndicadores, type DadosMotorista, type Indicadores,
  PRECO_DIESEL_PADRAO, CONSUMO_PADRAO_KML, MENSALIDADE_PADRAO,
} from '@/lib/vm/cenario';

/** Preferências de custo informadas pelo motorista (protótipo: localStorage). */
const K_PREFS = 'vambora.vm.prefs';
export interface PrefsCusto { precoDiesel: number; consumoKmL: number; mensalidade: number }

export function lerPrefs(): PrefsCusto {
  try {
    const raw = localStorage.getItem(K_PREFS);
    if (raw) return { precoDiesel: PRECO_DIESEL_PADRAO, consumoKmL: CONSUMO_PADRAO_KML, mensalidade: MENSALIDADE_PADRAO, ...JSON.parse(raw) };
  } catch { /* ignora */ }
  return { precoDiesel: PRECO_DIESEL_PADRAO, consumoKmL: CONSUMO_PADRAO_KML, mensalidade: MENSALIDADE_PADRAO };
}
export function salvarPrefs(p: Partial<PrefsCusto>): void {
  try { localStorage.setItem(K_PREFS, JSON.stringify({ ...lerPrefs(), ...p })); } catch { /* ignora */ }
}

export interface EstadoDados {
  carregando: boolean;
  erro: boolean;
  dados: DadosMotorista;
  indicadores: Indicadores;
  recarregar: () => void;
}

/**
 * Carrega os dados reais do motorista (veículos + rotas via store). Se não houver
 * registros (protótipo sem backend), usa o CENÁRIO DEMONSTRATIVO. Em ambos os
 * casos os indicadores são calculados pelas MESMAS funções reais.
 */
export function useDadosMotorista(): EstadoDados {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [dados, setDados] = useState<DadosMotorista>(() => cenarioDemo());

  const carregar = useCallback(() => {
    let vivo = true;
    setCarregando(true);
    setErro(false);
    (async () => {
      try {
        const [veiculos, rotas] = await Promise.all([listarVeiculos(), listarRotas()]);
        if (!vivo) return;
        const prefs = lerPrefs();
        if (veiculos.length === 0 && rotas.length === 0) {
          setDados(cenarioDemo());
        } else {
          setDados({
            demo: false,
            veiculo: veiculos[0] ?? null,
            rotas,
            precoDiesel: prefs.precoDiesel,
            consumoKmL: prefs.consumoKmL,
            mensalidade: prefs.mensalidade,
          });
        }
      } catch {
        if (vivo) { setErro(true); setDados(cenarioDemo()); }
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => { vivo = false; };
  }, []);

  useEffect(() => carregar(), [carregar]);

  return { carregando, erro, dados, indicadores: calcularIndicadores(dados), recarregar: carregar };
}
