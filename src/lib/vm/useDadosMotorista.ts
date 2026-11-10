import { useCallback, useEffect, useState } from 'react';
import { listarVeiculos, listarRotas } from '@/data/motorista-store';
import { DEMO_MOTORISTA } from '@/lib/supabase';
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
  /** Mensagem do erro REAL da consulta (null = sem erro). */
  erro: string | null;
  dados: DadosMotorista;
  indicadores: Indicadores;
  recarregar: () => void;
}

/** Painel sem registros: estado vazio VERDADEIRO (nunca o cenário de exemplo). */
export function dadosVazios(): DadosMotorista {
  const prefs = lerPrefs();
  return { demo: false, veiculo: null, rotas: [], precoDiesel: prefs.precoDiesel, consumoKmL: prefs.consumoKmL, mensalidade: prefs.mensalidade };
}

/**
 * Lê os dados PERSISTIDOS do motorista autenticado (veículos + rotas via store).
 *
 * - Fluxo real: devolve exatamente o que está gravado; sem registros, devolve o
 *   estado vazio. Erros de consulta são propagados (não viram dados de exemplo).
 * - O CENÁRIO DEMONSTRATIVO só aparece no modo demo EXPLÍCITO
 *   (VITE_DEMO_MOTORISTA="true") e apenas enquanto não há registros locais.
 */
export async function carregarDadosMotorista(modoDemo: boolean = DEMO_MOTORISTA): Promise<DadosMotorista> {
  const [veiculos, rotas] = await Promise.all([listarVeiculos(), listarRotas()]);
  if (modoDemo && veiculos.length === 0 && rotas.length === 0) return cenarioDemo();
  return { ...dadosVazios(), veiculo: veiculos[0] ?? null, rotas };
}

const mensagemErro = (e: unknown): string =>
  (e instanceof Error && e.message) || 'Não foi possível carregar os seus dados. Verifique a conexão e tente de novo.';

export function useDadosMotorista(): EstadoDados {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<DadosMotorista>(() => (DEMO_MOTORISTA ? cenarioDemo() : dadosVazios()));

  const carregar = useCallback(() => {
    let vivo = true;
    setCarregando(true);
    setErro(null);
    (async () => {
      try {
        const d = await carregarDadosMotorista();
        if (vivo) setDados(d);
      } catch (e) {
        // Erro real de consulta: informa o motorista e NÃO troca por dados fictícios
        // (mantém o que já estava carregado, se houver).
        if (vivo) setErro(mensagemErro(e));
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => { vivo = false; };
  }, []);

  useEffect(() => carregar(), [carregar]);

  return { carregando, erro, dados, indicadores: calcularIndicadores(dados), recarregar: carregar };
}
