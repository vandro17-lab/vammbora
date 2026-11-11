import type { CriteriosBusca } from '@/types';
import type { CartaoRotaRealDados } from '@/lib/busca-rotas-reais-cliente';
import { horaParaMinutoDoDia, horarioDoSentido } from '@/lib/searchParams';

/**
 * CONTEXTO DE UM PEDIDO DE CONTATO / INTERESSE (puro, sem rede).
 *
 * Quando a família fala com um motorista ou deixa o interesse numa rota, o que
 * ela buscou e o que foi calculado vai junto: sentido(s), o horário de cada
 * sentido, a rota e as condições do encaixe (inclusive a VERSÃO da rota sobre a
 * qual a conta foi feita). Sem isso, quem atende não sabe se o pedido era de
 * ida, de volta, para chegar até que horas — nem se a rota mudou depois.
 *
 * Contato e interesse NÃO reservam vaga. Nada aqui envia mensagem: o contexto só
 * acompanha o que a própria família decidir enviar.
 *
 * PRIVACIDADE: o contexto não leva o endereço da família nem dado nenhum de
 * quem já está na rota — só o que a busca já mostrou a ela.
 */

export interface TrechoPedido {
  sentido: 'ida' | 'volta';
  /** Ida: precisa chegar à escola até. Volta: liberado a partir de. `null` = não informado. */
  horarioMin: number | null;
}

export interface RotaDoInteresse {
  rotaId: string;
  sentido: 'ida' | 'volta';
  /** Veredito mostrado à família (compatível / sob confirmação). */
  status: string;
  /** Visita a escola, aceita incluí-la ou cadastro antigo por proximidade. */
  origemEscola: string | null;
  passagemCasaMin: number | null;
  horarioEscolaMin: number | null;
  /** Versão (opaca) da rota + van sobre a qual o encaixe foi calculado. */
  versao: string | null;
  /** Horários por estimativa (sem consulta às ruas). */
  temposEstimados: boolean;
  /** Condição resumida do encaixe (texto já mostrado à família). */
  condicao: string;
}

export interface ContextoInteresse {
  destinoId: string | null;
  contratacao: string;
  trechos: TrechoPedido[];
  rota: RotaDoInteresse | null;
}

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}h${String(Math.round(min) % 60).padStart(2, '0')}`;

/** Contexto do que a família buscou e, se houver, da rota em que se interessou. */
export function contextoDoInteresse(criterios: CriteriosBusca, cartao: CartaoRotaRealDados | null = null): ContextoInteresse {
  // Interesse numa rota específica: só o sentido DELA (ida válida não é pacote ida e volta).
  const sentidos: ('ida' | 'volta')[] = cartao ? [cartao.sentido] : criterios.modalidade === 'ambos' ? ['ida', 'volta'] : [criterios.modalidade];
  return {
    destinoId: criterios.destinoId,
    contratacao: criterios.contratacao,
    trechos: sentidos.map((sentido) => ({ sentido, horarioMin: horaParaMinutoDoDia(horarioDoSentido(criterios, sentido)) })),
    rota: cartao ? {
      rotaId: cartao.rotaId, sentido: cartao.sentido, status: cartao.status, origemEscola: cartao.origemEscola ?? null,
      passagemCasaMin: cartao.passagemCasaMin, horarioEscolaMin: cartao.horarioEscolaMin, versao: cartao.versao ?? null,
      temposEstimados: !!cartao.temposEstimados, condicao: cartao.motivo,
    } : null,
  };
}

/** Linhas legíveis (pt-BR) do contexto — para a família conferir antes de enviar. */
export function linhasDoContexto(c: ContextoInteresse): string[] {
  const linhas = c.trechos.map((t) => (t.sentido === 'ida'
    ? `Ida: ${t.horarioMin != null ? `chegar à escola até ${hhmm(t.horarioMin)}` : 'sem horário informado'}.`
    : `Volta: ${t.horarioMin != null ? `liberado na escola a partir de ${hhmm(t.horarioMin)}` : 'sem horário informado'}.`));
  if (c.rota) {
    const r = c.rota;
    const casa = r.passagemCasaMin != null ? hhmm(r.passagemCasaMin) : null;
    const escola = r.horarioEscolaMin != null ? hhmm(r.horarioEscolaMin) : null;
    if (casa && escola) {
      linhas.push(r.sentido === 'ida'
        ? `Cálculo desta rota: passa em casa por volta de ${casa} e chega à escola por volta de ${escola}${r.temposEstimados ? ' (aproximado, sem consulta às ruas)' : ''}.`
        : `Cálculo desta rota: sai da escola por volta de ${escola} e deixa em casa por volta de ${casa}${r.temposEstimados ? ' (aproximado, sem consulta às ruas)' : ''}.`);
    }
    linhas.push(r.status === 'compativel' ? 'Situação: compatível pelo cálculo — a vaga depende da confirmação do motorista.' : 'Situação: sob confirmação do motorista.');
    if (r.origemEscola === 'aceita') linhas.push('A rota ainda não passa pela escola: o motorista informou que aceita incluí-la.');
  }
  return linhas;
}

/**
 * Resumo curto do contexto, em texto, para quando o banco ainda não tem o campo
 * próprio (migração 0017 pendente): vai junto do campo de região do pedido,
 * para o contexto não se perder. Ex.: "[ida até 06h50 · rota 1a2b… v:abc]".
 */
export function resumoDoContexto(c: ContextoInteresse): string {
  const partes = c.trechos.map((t) => (t.sentido === 'ida'
    ? `ida${t.horarioMin != null ? ` até ${hhmm(t.horarioMin)}` : ''}`
    : `volta${t.horarioMin != null ? ` a partir de ${hhmm(t.horarioMin)}` : ''}`));
  if (c.rota) partes.push(`rota ${c.rota.rotaId}${c.rota.versao ? ` v:${c.rota.versao}` : ''} ${c.rota.status}`);
  return `[${partes.join(' · ')}]`.slice(0, 160);
}
