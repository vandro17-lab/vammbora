import type { Rota, Veiculo, PassageiroRota } from '@/types/motorista';
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

const DEFAULT_ATENDIMENTO_MIN = 1; // provisório quando o aluno não informou (nunca "confirmado")

/** Interseção das janelas individuais (horário habitual ± ajuste) dos alunos
 *  atendidos numa mesma parada. Sem janela se ninguém informou; `undefined`
 *  também quando as janelas informadas são incompatíveis entre si (conflito de
 *  dados — não vira falha dura aqui; a validação específica fica para fase futura). */
function intersecaoJanelas(pax: PassageiroRota[]): { inicio: number; fim: number } | undefined {
  let inicio = -Infinity, fim = Infinity, achou = false;
  for (const x of pax) {
    if (x.horarioHabitualMin == null) continue;
    inicio = Math.max(inicio, x.horarioHabitualMin - (x.ajusteAntesMin ?? 0));
    fim = Math.min(fim, x.horarioHabitualMin + (x.ajusteDepoisMin ?? 0));
    achou = true;
  }
  if (!achou || inicio > fim) return undefined;
  return { inicio: Math.max(0, inicio), fim };
}

export interface PlanoDoCadastro {
  plano: PlanoRota | null;
  /** Mensagens simples do que falta para o motor calcular de verdade. */
  dadosFaltantes: string[];
}

const ROTULOS: Record<string, string> = {
  capacidadePassageiros: 'capacidade de passageiros da van',
  assentosReservados: 'lugares reservados',
  chegadaFinalAte: 'o horário em que você precisa deixar o último aluno',
  saidaPermitida: 'horário mais cedo e mais tarde em que a van pode iniciar a rota',
  limiteABordoMin: 'tempo máximo que cada aluno pode permanecer dentro da van',
  paradas: 'paradas suficientes (saída + pelo menos uma parada)',
  temposTrechosMin: 'os minutos entre as paradas (tempo de deslocamento entre cada endereço)',
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

  const paradas: ParadaPlanejamento[] = paradasSeq.map((p) => {
    const embarques = rota.passageiros.filter((x) => x.embarqueParadaId === p.id).map((x) => x.id);
    const desembarques = rota.passageiros.filter((x) => x.desembarqueParadaId === p.id).map((x) => x.id);
    // O atendimento individual acontece na CASA do aluno (ida: embarque; volta:
    // desembarque). CONSOLIDAÇÃO quando vários alunos partilham a parada: soma
    // SEQUENCIAL (DEC-022), cada evento contado uma vez, sem presumir embarque
    // simultâneo. Escola/saída: atendimento 0 (não é atendimento de aluno).
    const atendidos = p.tipo === 'casa'
      ? rota.passageiros.filter((x) => (rota.sentido === 'ida' ? x.embarqueParadaId : x.desembarqueParadaId) === p.id)
      : [];
    const atendimentoMin = atendidos.reduce((s, x) => s + (x.atendimentoMin ?? DEFAULT_ATENDIMENTO_MIN), 0);
    const janela = intersecaoJanelas(atendidos);
    return { id: p.id, embarques, desembarques, atendimentoMin, ...(janela ? { janela } : {}) };
  });

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
