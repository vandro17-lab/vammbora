import type { PontoGeo, MatrizViaria, Trecho } from '@/engine/encaixe-geografico';
import { supabase } from '@/lib/supabase';

/**
 * Matriz viária REAL para o simulador: busca tempos/distâncias entre todos os
 * pontos usando o proxy `/api/mapas` (Geoapify Route Matrix). Nunca usa linha
 * reta como substituta silenciosa: um par sem trajeto vira `null`, e o motor
 * marca o trecho como indisponível.
 */

export type CodigoFalhaMatriz = 'sem_sessao' | 'mapas_indisponivel' | 'muitos_pontos';

export class FalhaMatriz extends Error {
  codigo: CodigoFalhaMatriz;
  constructor(codigo: CodigoFalhaMatriz, mensagem: string) {
    super(mensagem);
    this.codigo = codigo;
    this.name = 'FalhaMatriz';
  }
}

interface RespostaMatriz {
  tempos?: (number | null)[][];
  distancias?: (number | null)[][];
  erro?: string;
}

const LIMITE_PONTOS = 25;

/** Constrói uma MatrizViaria a partir das tabelas de tempos/distâncias por índice. */
export function matrizDeTabelas(
  pontos: PontoGeo[],
  tempos: (number | null)[][],
  distancias: (number | null)[][],
): MatrizViaria {
  const indice = new Map(pontos.map((p, i) => [p.id, i]));
  return {
    origem: 'geoapify',
    obter(de: PontoGeo, para: PontoGeo): Trecho | null {
      if (de.id === para.id) return { minutos: 0, metros: 0 };
      const i = indice.get(de.id);
      const j = indice.get(para.id);
      if (i === undefined || j === undefined) return null;
      const min = tempos[i]?.[j];
      const met = distancias[i]?.[j];
      if (typeof min !== 'number' || typeof met !== 'number' || !Number.isFinite(min) || !Number.isFinite(met)) return null;
      return { minutos: Math.max(0, Math.round(min * 100) / 100), metros: Math.max(0, Math.round(met)) };
    },
  };
}

/** Busca a matriz viária real dos pontos informados. Lança FalhaMatriz em erro. */
export async function obterMatrizViaria(pontos: PontoGeo[]): Promise<MatrizViaria> {
  if (pontos.length < 2) throw new FalhaMatriz('mapas_indisponivel', 'São necessários pelo menos dois pontos.');
  if (pontos.length > LIMITE_PONTOS) throw new FalhaMatriz('muitos_pontos', 'A rota tem pontos demais para o cálculo rodoviário.');

  const sessao = (await supabase?.auth.getSession())?.data.session ?? null;
  if (!sessao?.access_token) throw new FalhaMatriz('sem_sessao', 'Entre na sua conta de motorista para calcular trajetos reais.');

  let resposta: Response;
  try {
    resposta = await fetch('/api/mapas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sessao.access_token },
      body: JSON.stringify({ operacao: 'matriz', pontos: pontos.map((p) => ({ lat: p.lat, lng: p.lng })) }),
      cache: 'no-store',
    });
  } catch {
    throw new FalhaMatriz('mapas_indisponivel', 'Não foi possível consultar o mapa. Confira a conexão e tente novamente.');
  }
  const dados = (await resposta.json().catch(() => ({}))) as RespostaMatriz;
  if (!resposta.ok || !dados.tempos || !dados.distancias) {
    throw new FalhaMatriz('mapas_indisponivel', dados.erro ?? 'Serviço de mapas indisponível no momento.');
  }
  return matrizDeTabelas(pontos, dados.tempos, dados.distancias);
}
