import type { MatrizViaria } from '@/engine/encaixe-geografico';

/**
 * INTELIGÊNCIA OPERACIONAL (VanBora 2.0) — estrutura mínima para o sistema
 * aprender, no futuro, com tempos REAIS de viagem, embarque e desembarque.
 *
 * Hoje NÃO existe histórico: valem as ESTIMATIVAS INICIAIS abaixo, explícitas e
 * marcadas como `origem: 'inicial'`. Quando houver observações registradas
 * (ex.: o motorista toca "cheguei"/"saí" em cada parada), `aprenderEstimativas`
 * passa a devolver valores `origem: 'aprendido'`. Sem GPS contínuo, sem ML
 * pesado: mediana robusta, que na pesquisa empatou com modelos complexos.
 */
export interface EstimativasOperacionais {
  origem: 'inicial' | 'aprendido';
  /** Quantas observações sustentam a estimativa (0 = nenhuma). */
  amostras: number;
  /** Tempo real ÷ tempo previsto pelo provedor de mapas (típico). */
  fatorViagem: number;
  /** Fator CONSERVADOR (dia ruim) usado para testar a margem de segurança. */
  fatorViagemConservador: number;
  /** Minutos por aluno no embarque / no desembarque. */
  embarqueMin: number;
  desembarqueMin: number;
}

/** Estimativas iniciais — suposições declaradas, não medições. */
export const ESTIMATIVAS_INICIAIS: EstimativasOperacionais = {
  origem: 'inicial', amostras: 0,
  fatorViagem: 1, fatorViagemConservador: 1.15,
  embarqueMin: 1, desembarqueMin: 1,
};

/** Uma medição real, comparável com o que foi previsto. Sem dado pessoal. */
export interface ObservacaoOperacional {
  tipo: 'viagem' | 'embarque' | 'desembarque';
  /** Minutos previstos (viagem) — obrigatório para `viagem`. */
  previstoMin?: number;
  /** Minutos realmente gastos. Para embarque/desembarque: por aluno. */
  realMin: number;
}

/** Mínimo de observações de um tipo antes de confiar mais nos dados do que na estimativa inicial. */
export const AMOSTRAS_MINIMAS = 20;

function quantil(xs: number[], q: number): number {
  const o = [...xs].sort((a, b) => a - b);
  const pos = (o.length - 1) * q, i = Math.floor(pos);
  return o[i] + (o[Math.min(i + 1, o.length - 1)] - o[i]) * (pos - i);
}

/**
 * Atualiza as estimativas com observações reais. Abaixo de `AMOSTRAS_MINIMAS`
 * por tipo, mantém o valor inicial daquele item (não finge aprendizado).
 * Razões fisicamente impossíveis (< 0,3 ou > 5) são descartadas (toque duplo etc.).
 */
export function aprenderEstimativas(
  observacoes: ObservacaoOperacional[], inicial: EstimativasOperacionais = ESTIMATIVAS_INICIAIS,
): EstimativasOperacionais {
  const razoes = observacoes
    .filter((o) => o.tipo === 'viagem' && (o.previstoMin ?? 0) > 0 && o.realMin > 0)
    .map((o) => o.realMin / o.previstoMin!)
    .filter((r) => r >= 0.3 && r <= 5);
  const tempos = (tipo: 'embarque' | 'desembarque') =>
    observacoes.filter((o) => o.tipo === tipo && o.realMin >= 0 && o.realMin <= 30).map((o) => o.realMin);
  const emb = tempos('embarque'), des = tempos('desembarque');
  const out = { ...inicial };
  let usadas = 0;
  if (razoes.length >= AMOSTRAS_MINIMAS) {
    out.fatorViagem = quantil(razoes, 0.5);
    out.fatorViagemConservador = Math.max(out.fatorViagem, quantil(razoes, 0.9));
    usadas += razoes.length;
  }
  if (emb.length >= AMOSTRAS_MINIMAS) { out.embarqueMin = quantil(emb, 0.5); usadas += emb.length; }
  if (des.length >= AMOSTRAS_MINIMAS) { out.desembarqueMin = quantil(des, 0.5); usadas += des.length; }
  return usadas > 0 ? { ...out, origem: 'aprendido', amostras: usadas } : inicial;
}

/** Matriz com os tempos multiplicados por um fator (distâncias inalteradas). */
export function matrizComFator(matriz: MatrizViaria, fator: number): MatrizViaria {
  if (fator === 1) return matriz;
  return {
    origem: matriz.origem,
    obter: (de, para, partida) => {
      const t = matriz.obter(de, para, partida);
      return t ? { minutos: Math.ceil(t.minutos * fator * 10) / 10, metros: t.metros } : null;
    },
  };
}

/** Matriz de "dia ruim": usada só para avaliar se um plano tem margem. */
export function matrizConservadora(matriz: MatrizViaria, e: EstimativasOperacionais = ESTIMATIVAS_INICIAIS): MatrizViaria {
  return matrizComFator(matriz, e.fatorViagemConservador);
}
