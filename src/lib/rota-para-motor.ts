import type { Rota, Veiculo } from '@/types/motorista';
import {
  planejarRota,
  avaliarRotaCandidata,
  type RotaPlanejamento,
  type ParadaPlanejamento,
  type PlanoRota,
  type AvaliacaoCandidata,
} from '@/engine/planejamento';
import { capacidadeAlunos } from '@/lib/ocupacao-rota';

/**
 * Adaptador: converte a rota do cadastro (telas/banco) na ENTRADA do motor
 * (`RotaPlanejamento`) e chama o motor real. NÃO inventa tempos: usa os minutos
 * entre paradas informados pelo motorista. Se faltarem dados, não força cálculo —
 * devolve o que falta, em linguagem simples. (Não altera `src/engine/`.)
 *
 * Mapeamento:
 *  - A parada "saída" do cadastro é a SAÍDA do motor (não é uma parada do plano).
 *  - As demais paradas (casa/escola) viram paradas do plano, com embarques/
 *    desembarques por id de passageiro.
 *  - temposTrechosMin[k] = minutos até a parada k (saída -> 1ª parada, etc.).
 */

const DEFAULT_ATENDIMENTO_MIN = 1; // tempo parado em cada parada (embarque/desembarque)

export interface PlanoDoCadastro {
  plano: PlanoRota | null;
  /** Mensagens simples do que falta para o motor calcular de verdade. */
  dadosFaltantes: string[];
}

const ROTULOS: Record<string, string> = {
  capacidadePassageiros: 'capacidade de passageiros da van',
  assentosReservados: 'lugares reservados',
  chegadaFinalAte: 'horário máximo de chegada à última escola',
  saidaPermitida: 'horário mais cedo e mais tarde em que a van pode iniciar a rota',
  limiteABordoMin: 'tempo máximo que cada aluno pode permanecer dentro da van',
  paradas: 'paradas suficientes (saída + pelo menos uma parada)',
  temposTrechosMin: 'tempo de deslocamento, em minutos, entre cada endereço da rota',
};

function amigavel(erros: string[]): string[] {
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const e of erros) {
    const chave = e.replace(/\[.*$/, '').split('.')[0];
    const rot = ROTULOS[chave];
    const txt = rot ? `Falta informar: ${rot}.` : `Dado incompleto: ${e}.`;
    if (!vistos.has(txt)) { vistos.add(txt); out.push(txt); }
  }
  return out;
}

/** Monta a entrada do motor a partir da rota do cadastro. */
export function montarEntradaMotor(rota: Rota, veiculo: Veiculo | null): RotaPlanejamento {
  const ordenadas = [...rota.paradas].sort((a, b) => a.ordem - b.ordem);
  const saida = ordenadas.find((p) => p.tipo === 'saida') ?? null;
  const paradasSeq = ordenadas.filter((p) => p.tipo !== 'saida');

  const paradas: ParadaPlanejamento[] = paradasSeq.map((p) => ({
    id: p.id,
    embarques: rota.passageiros.filter((x) => x.embarqueParadaId === p.id).map((x) => x.id),
    desembarques: rota.passageiros.filter((x) => x.desembarqueParadaId === p.id).map((x) => x.id),
    atendimentoMin: DEFAULT_ATENDIMENTO_MIN,
  }));

  // temposTrechosMin: um por parada. O tempo até a parada k é o "tempoAteProximaMin"
  // da parada anterior (a saída para a 1ª; a parada k-1 para a k).
  const sequenciaComSaida = saida ? [saida, ...paradasSeq] : paradasSeq;
  const temposTrechosMin: number[] = paradasSeq.map((_, k) => {
    const anterior = sequenciaComSaida[k];
    const t = anterior?.tempoAteProximaMin;
    return typeof t === 'number' && t >= 0 ? t : NaN; // NaN -> o motor marca temposTrechosMin faltando
  });

  const reservados = (rota.monitor && rota.monitorOcupaLugar ? 1 : 0) + rota.lugaresReservados;
  const chegadaFinalAte = rota.ultimoDesembarqueMin ?? NaN;
  const antecip = rota.limiteAntecipacaoMin ?? 0;

  return {
    capacidadePassageiros: veiculo?.lugaresPassageiro ?? 0,
    assentosReservados: reservados,
    paradas,
    temposTrechosMin: temposTrechosMin.map((t) => (Number.isNaN(t) ? -1 : t)), // -1 => inválido p/ o motor
    chegadaFinalAte: Number.isNaN(chegadaFinalAte) ? -1 : chegadaFinalAte,
    saidaPermitida: { inicio: 0, fim: Number.isNaN(chegadaFinalAte) ? 0 : chegadaFinalAte },
    limiteABordoMin: null, // pendente de validação legal — não bloqueia
    // antecipação fica guardada para a avaliação de candidatos (avaliarRotaCandidata)
    ...(antecip ? {} : {}),
  };
}

/** Roda o motor real sobre a rota do cadastro. Honesto quando faltam dados. */
export function planejarRotaDoCadastro(rota: Rota, veiculo: Veiculo | null): PlanoDoCadastro {
  const capAlunos = capacidadeAlunos(rota, veiculo);
  if (capAlunos <= 0 && (veiculo?.lugaresPassageiro ?? 0) === 0) {
    return { plano: null, dadosFaltantes: ['Falta informar: capacidade de passageiros da van.'] };
  }
  const entrada = montarEntradaMotor(rota, veiculo);
  const plano = planejarRota(entrada);
  if (!plano.valido) {
    return { plano, dadosFaltantes: amigavel(plano.erros) };
  }
  return { plano, dadosFaltantes: [] };
}

export type { PlanoRota, AvaliacaoCandidata };
export { avaliarRotaCandidata };
