/**
 * Camada ÚNICA de encaixe do VanBora.
 *
 * Tanto a demonstração quanto a busca das famílias usam ESTE módulo, que por sua
 * vez chama SEMPRE o mesmo motor real (`src/engine/encaixe-geografico`). Quando os
 * dados mudam (endereço, horário final, capacidade), o resultado muda sozinho.
 *
 * A matriz de tempos pode vir de:
 *  - `criarMatrizDemo()`  — tempos estimados a partir das coordenadas (origem
 *    'demonstracao'); honesta e determinística, para cenários de exemplo.
 *  - um provedor rodoviário real (Geoapify), ligado quando a chave estiver
 *    configurada — o motor nunca inventa tempo: sem dado viário, recusa.
 */
import {
  encontrarEncaixes,
  encontrarIdaVolta,
  simularRota,
  type MatrizViaria,
  type PontoGeo,
  type RotaOperacional,
  type Compromisso,
  type PedidoEncaixe,
  type OpcaoEncaixe,
} from '@/engine/encaixe-geografico';
import type { Rota } from '@/types/motorista';

export { encontrarEncaixes, encontrarIdaVolta, simularRota };
export type { MatrizViaria, PontoGeo, RotaOperacional, Compromisso, PedidoEncaixe, OpcaoEncaixe };

/** Distância em metros entre dois pontos (fórmula de Haversine). */
export function haversineMetros(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * Matriz de DEMONSTRAÇÃO: estima minutos/metros a partir das coordenadas, com um
 * fator de ruas e uma velocidade urbana média. Não é trânsito real, mas é coerente:
 * pontos mais distantes levam mais tempo, e mudar o endereço muda o cálculo.
 */
export function criarMatrizDemo(opts?: { fatorRuas?: number; kmh?: number }): MatrizViaria {
  const fatorRuas = opts?.fatorRuas ?? 1.35; // ruas não são linha reta
  const metrosPorMin = ((opts?.kmh ?? 24) * 1000) / 60;
  return {
    origem: 'demonstracao',
    obter: (a, b) => {
      if (a.id === b.id) return { minutos: 0, metros: 0 };
      if (![a.lat, a.lng, b.lat, b.lng].every(Number.isFinite)) return null;
      const metros = Math.round(haversineMetros(a, b) * fatorRuas);
      const minutos = Math.max(1, Math.round(metros / metrosPorMin));
      return { minutos, metros };
    },
  };
}

/** Converte uma parada do cadastro em ponto geográfico (ou null se sem coordenada). */
function pontoDeParada(p: { id: string; rotulo?: string; destinoNome?: string | null; tipo: string; lat?: number; lng?: number }): PontoGeo | null {
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return null;
  return { id: p.id, nome: p.rotulo || p.destinoNome || p.tipo, lat: p.lat as number, lng: p.lng as number };
}

/**
 * Converte a rota do CADASTRO (telas/banco) na RotaOperacional do motor.
 * Requer coordenadas em todas as paradas (o motor nunca inventa posição).
 * O horário final de cada escola vem de `ultimoDesembarqueMin` (limite rígido).
 */
export function rotaOperacionalDeCadastro(
  rota: Rota,
  opts: { capacidade: number; partidaMin: number; toleranciaMin?: number },
): RotaOperacional | null {
  const ordenadas = [...rota.paradas].sort((a, b) => a.ordem - b.ordem);
  const saida = ordenadas.find((p) => p.tipo === 'saida');
  const inicio = saida && pontoDeParada(saida);
  if (!inicio) return null;

  const limite = rota.ultimoDesembarqueMin ?? undefined;
  const compromissos: Compromisso[] = [];
  for (const p of ordenadas) {
    if (p.tipo === 'saida') continue;
    const ponto = pontoDeParada(p);
    if (!ponto) return null; // sem coordenada não há como estimar
    for (const pax of rota.passageiros.filter((x) => x.embarqueParadaId === p.id)) {
      // Atendimento por aluno (DEC-022); 1 min é só o provisório quando ausente.
      compromissos.push({ id: 'emb:' + pax.id, ponto, tipo: 'embarque', alunoId: pax.id, atendimentoMin: pax.atendimentoMin ?? 1 });
    }
    if (p.tipo === 'escola') {
      compromissos.push({ id: 'escola:' + p.id, ponto, tipo: 'escola', atendimentoMin: 0, limiteEscolaMin: limite });
    }
    for (const pax of rota.passageiros.filter((x) => x.desembarqueParadaId === p.id)) {
      compromissos.push({
        id: 'des:' + pax.id, ponto, tipo: 'desembarque', alunoId: pax.id, atendimentoMin: 0,
        ...(p.tipo === 'escola' ? { limiteEscolaMin: limite } : {}),
      });
    }
  }
  return {
    id: rota.id || 'rota', versao: 1, sentido: rota.sentido, inicio,
    partidaMin: opts.partidaMin, capacidade: opts.capacidade, ocupacaoInicial: 0,
    compromissos, toleranciaMin: Math.min(10, opts.toleranciaMin ?? 10),
  };
}

/**
 * Calcula a SAÍDA de trás pra frente: a última saída possível para que a rota
 * chegue exatamente no horário final (menor limite de escola). Implementa a regra
 * "o horário final manda" (§3.1). Retorna null se faltar dado viário ou limite.
 */
export function partidaRetroativa(rota: RotaOperacional, matriz: MatrizViaria): number | null {
  let total = 0;
  let anterior = rota.inicio;
  for (let i = 0; i < rota.compromissos.length; i++) {
    const c = rota.compromissos[i];
    const t = matriz.obter(anterior, c.ponto, 0);
    if (!t || !Number.isFinite(t.minutos)) return null;
    total += t.minutos;
    if (i < rota.compromissos.length - 1) total += c.atendimentoMin;
    anterior = c.ponto;
  }
  const limites = rota.compromissos.map((c) => c.limiteEscolaMin).filter((v): v is number => Number.isFinite(v as number));
  if (!limites.length) return null;
  return Math.min(...limites) - total;
}
