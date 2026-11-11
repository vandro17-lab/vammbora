import type { CriteriosBusca, ModalidadeTrajeto } from '@/types';
import { listarRotas, listarVeiculos } from '@/data/motorista-store';
import { criarMatrizDemo } from '@/lib/encaixe';
import {
  buscarEmRotasReais,
  rotaElegivelParaBusca,
  type EntradaBuscaReal,
  type OrigemEscola,
  type PendenciaAvaliacao,
  type StatusBuscaReal,
} from '@/lib/busca-rotas-reais';
import { horaParaMinutoDoDia, horarioDoSentido } from '@/lib/searchParams';

/**
 * Cliente da BUSCA REAL. Produz os dados de cartão (`CartaoRotaRealDados`) a
 * partir de duas fontes equivalentes:
 *  - PROD: a função server-side `/api/buscar-rotas` (service role, sem PII);
 *  - DEMO: as rotas do próprio navegador (localStorage), rodando o MESMO núcleo.
 * O cliente NUNCA lê rotas reais direto do banco (RLS/PII).
 *
 * Cada SENTIDO (ida, volta) é uma consulta independente, com o SEU horário da
 * família: a falha de um não apaga o resultado do outro, e uma ida válida
 * nunca é apresentada como pacote de ida e volta.
 */

/** Dados mínimos, SEM PII, para renderizar o cartão de uma rota real. */
export interface CartaoRotaRealDados {
  rotaId: string;
  rotaNome: string;
  /** Rota de DEMONSTRAÇÃO (§6.1): o frontend mantém a identificação visível. */
  demo?: boolean;
  /** Mensalidade por ALUNO desta van (valor fixo por aluno, não por trecho). */
  precoMensal?: number | null;
  /** Tipo de preço: 'fixo' | 'dinamico' | 'a_combinar'. */
  precoTipo?: string | null;
  vanLugares: number | null;
  /** Lugares livres NO TRECHO calculado para a família (antes de incluí-la).
   *  `null` = não calculado. Nunca é o pico global da rota. */
  vagas: number | null;
  /** A rota já visita a escola pedida. */
  atendeEscola: boolean;
  /** Visita a escola, aceita incluí-la ou cadastro antigo avaliado por proximidade. */
  origemEscola?: OrigemEscola;
  sentido: 'ida' | 'volta';
  status: StatusBuscaReal;
  /** Só com status 'indeterminado': faltam dados no cadastro x avaliação não concluída. */
  pendencia?: PendenciaAvaliacao | null;
  /** Ida: hora que passa na CASA (coleta). Volta: hora que deixa em CASA. */
  passagemCasaMin: number | null;
  /** Ida: chegada à ESCOLA. Volta: saída da ESCOLA. */
  horarioEscolaMin: number | null;
  minutosABordo: number | null;
  /** Tempos de trajeto estimados (sem consulta viária): nunca "compatível". */
  temposEstimados?: boolean;
  motivo: string;
}

export type EstadoBuscaReal = 'nao_configurado' | 'ok' | 'erro';
export type Sentido = 'ida' | 'volta';
/** Posição na fila de avaliação do servidor (devolvida por ele; o cliente só reenvia). */
export interface ContinuacaoBusca { inicio: number; repetir: string[] }

export const sentidosDe = (m: ModalidadeTrajeto): Sentido[] => (m === 'ambos' ? ['ida', 'volta'] : [m]);
export const mostravel = (s: StatusBuscaReal) => s === 'compativel' || s === 'sob_confirmacao';

/** O que aconteceu com UM sentido da busca — separa as quatro situações que a
 *  tela precisa distinguir. */
export interface SituacaoSentido {
  sentido: Sentido;
  /** 'erro' = a consulta DESTE sentido falhou (o outro sentido continua valendo). */
  estado: EstadoBuscaReal;
  /** Rotas deste sentido que visitam/aceitam a escola. 0 = AUSÊNCIA DE OFERTA. */
  candidatas: number;
  /** Cartões exibíveis (compatível / sob confirmação). */
  encontradas: number;
  /** INCOMPATIBILIDADE comprovada com trajetos reais. */
  incompativeis: number;
  /** DADOS INSUFICIENTES no cadastro da rota (repetir não resolve). */
  dadosInsuficientes: number;
  /** AVALIAÇÃO INCOMPLETA: tentadas sem veredito + ainda na fila (`aguardando`). */
  avaliacaoIncompleta: number;
  aguardando: number;
  /** Há mais a calcular: pedir o próximo lote com `continuarBuscaReal`. */
  continuacao: ContinuacaoBusca | null;
  /** O ambiente não tem provedor viário (continuar não adianta). */
  semProvedor: boolean;
}

export interface RespostaBuscaReal {
  /** 'ok' se ao menos um sentido respondeu; 'erro' só quando TODOS falharam. */
  estado: EstadoBuscaReal;
  /** Só compatível / sob confirmação (nunca um falso encaixe). */
  resultados: CartaoRotaRealDados[];
  /** Rotas candidatas sem veredito (dados insuficientes + avaliação incompleta). Não é "sem vaga". */
  inconclusivas: number;
  /** Situação de cada sentido pedido. */
  sentidos: SituacaoSentido[];
  /** Todos os resultados recebidos (inclusive os não exibíveis) — base da continuação. */
  todos: CartaoRotaRealDados[];
}

interface RespostaServidor {
  resultados?: CartaoRotaRealDados[]; totalRotasAvaliadas?: number; inconclusivas?: number;
  aguardando?: number; continuacao?: ContinuacaoBusca | null; semProvedor?: boolean;
}
interface RespostaSentido { estado: EstadoBuscaReal; dados: RespostaServidor | null }

const chave = (r: Pick<CartaoRotaRealDados, 'rotaId' | 'sentido'>) => `${r.sentido}:${r.rotaId}`;

function situacaoDe(sentido: Sentido, estado: EstadoBuscaReal, lista: CartaoRotaRealDados[], d: RespostaServidor | null): SituacaoSentido {
  const aguardando = Math.max(0, d?.aguardando ?? 0);
  const indeterminadas = lista.filter((x) => x.status === 'indeterminado');
  // Servidor antigo (sem `pendencia`): trata como avaliação incompleta — nunca como "não cabe".
  const dados = indeterminadas.filter((x) => x.pendencia === 'dados_insuficientes').length;
  return {
    sentido, estado,
    candidatas: Math.max(d?.totalRotasAvaliadas ?? 0, lista.length + aguardando),
    encontradas: lista.filter((x) => mostravel(x.status)).length,
    incompativeis: lista.filter((x) => x.status === 'incompativel').length,
    dadosInsuficientes: dados,
    avaliacaoIncompleta: indeterminadas.length - dados + aguardando,
    aguardando,
    continuacao: d?.continuacao && (aguardando > 0 || (d.continuacao.repetir?.length ?? 0) > 0) ? d.continuacao : null,
    semProvedor: !!d?.semProvedor,
  };
}

function montar(sentidos: SituacaoSentido[], todos: CartaoRotaRealDados[]): RespostaBuscaReal {
  const estado: EstadoBuscaReal = sentidos.some((s) => s.estado === 'ok') ? 'ok'
    : sentidos.some((s) => s.estado === 'nao_configurado') ? 'nao_configurado' : sentidos.length ? 'erro' : 'ok';
  return {
    estado, sentidos, todos,
    resultados: todos.filter((x) => mostravel(x.status)),
    inconclusivas: sentidos.reduce((n, s) => n + s.dadosInsuficientes + s.avaliacaoIncompleta, 0),
  };
}

async function consultarSentido(
  criterios: CriteriosBusca, escolaPonto: { lat: number; lng: number } | null | undefined, sentido: Sentido,
  continuacao: ContinuacaoBusca | null, signal?: AbortSignal,
): Promise<RespostaSentido> {
  try {
    const r = await fetch('/api/buscar-rotas', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origem: { lat: criterios.origemLat, lng: criterios.origemLng },
        destinoId: criterios.destinoId,
        escolaPonto: escolaPonto ?? null,
        sentido,
        turno: criterios.turno,
        contratacao: criterios.contratacao,
        // Horário DESTE sentido — ida: precisa chegar até; volta: liberado a partir de.
        horarioMin: horaParaMinutoDoDia(horarioDoSentido(criterios, sentido)),
        ...(continuacao ? { continuacao } : {}),
      }),
    });
    if (r.status === 503) return { estado: 'nao_configurado', dados: null };
    if (!r.ok) return { estado: 'erro', dados: null };
    return { estado: 'ok', dados: (await r.json()) as RespostaServidor };
  } catch {
    return { estado: 'erro', dados: null };
  }
}

/** PROD: consulta a função server-side, um sentido por vez. Só mostra
 *  compatível/sob confirmação; o resto vira contagem por situação. */
export async function buscarRotasReais(
  criterios: CriteriosBusca,
  escolaPonto?: { lat: number; lng: number } | null,
  signal?: AbortSignal,
): Promise<RespostaBuscaReal> {
  if (!Number.isFinite(criterios.origemLat) || !Number.isFinite(criterios.origemLng) || !criterios.destinoId) {
    return montar([], []);
  }
  const sentidos: SituacaoSentido[] = [];
  const todos: CartaoRotaRealDados[] = [];
  for (const sentido of sentidosDe(criterios.modalidade)) {
    const { estado, dados } = await consultarSentido(criterios, escolaPonto, sentido, null, signal);
    const lista = dados?.resultados ?? [];
    todos.push(...lista);
    sentidos.push(situacaoDe(sentido, estado, lista, dados));
    // Servidor sem a busca configurada: o outro sentido responderia o mesmo.
    if (estado === 'nao_configurado') break;
  }
  return montar(sentidos, todos);
}

/** Há algo a continuar/repetir nesta resposta? */
export const podeContinuar = (r: RespostaBuscaReal): boolean => r.sentidos.some((s) => s.continuacao !== null || s.estado === 'erro');

/**
 * CONTINUA a avaliação: pede ao servidor o próximo lote dos sentidos que ainda
 * têm rotas sem cálculo e refaz a consulta dos sentidos que falharam.
 * Os resultados já obtidos são PRESERVADOS: um resultado válido só é
 * substituído por outro resultado conclusivo da mesma rota.
 */
export async function continuarBuscaReal(
  criterios: CriteriosBusca,
  escolaPonto: { lat: number; lng: number } | null | undefined,
  anterior: RespostaBuscaReal,
  signal?: AbortSignal,
): Promise<RespostaBuscaReal> {
  const porChave = new Map(anterior.todos.map((x) => [chave(x), x]));
  const sentidos: SituacaoSentido[] = [];
  for (const s of anterior.sentidos) {
    if (s.estado === 'ok' && !s.continuacao) { sentidos.push(s); continue; }
    const { estado, dados } = await consultarSentido(criterios, escolaPonto, s.sentido, s.estado === 'ok' ? s.continuacao : null, signal);
    if (estado !== 'ok' || !dados) {
      // Falhou de novo: mantém o que já havia (inclusive a continuação).
      sentidos.push(s.estado === 'ok' ? s : { ...s, estado });
      continue;
    }
    for (const novo of dados.resultados ?? []) {
      const antigo = porChave.get(chave(novo));
      if (antigo && mostravel(antigo.status) && !mostravel(novo.status) && novo.status !== 'incompativel') continue; // preserva o válido
      porChave.set(chave(novo), novo);
    }
    const lista = [...porChave.values()].filter((x) => x.sentido === s.sentido);
    sentidos.push(situacaoDe(s.sentido, 'ok', lista, { ...dados, totalRotasAvaliadas: Math.max(dados.totalRotasAvaliadas ?? 0, s.candidatas) }));
  }
  return montar(sentidos, [...porChave.values()]);
}

/* ===================== Modo demonstração (localStorage) =====================
 * Sem backend, as rotas reais vivem no navegador do próprio usuário. Rodamos o
 * MESMO núcleo (buscarEmRotasReais) sobre as rotas ELEGÍVEIS (concluídas),
 * provando o fluxo ponta a ponta sem infra. Os tempos são ESTIMADOS: o núcleo
 * limita tudo a "sob confirmação" e o cartão avisa que não houve consulta às ruas. */
export async function buscarRotasReaisDemo(
  criterios: CriteriosBusca,
  escolaPonto?: { lat: number; lng: number } | null,
): Promise<CartaoRotaRealDados[]> {
  return (await buscarRotasReaisDemoCompleta(criterios, escolaPonto)).resultados;
}

export async function buscarRotasReaisDemoCompleta(
  criterios: CriteriosBusca,
  escolaPonto?: { lat: number; lng: number } | null,
): Promise<RespostaBuscaReal> {
  if (!Number.isFinite(criterios.origemLat) || !Number.isFinite(criterios.origemLng) || !criterios.destinoId) return montar([], []);
  const [rotas, veiculos] = await Promise.all([listarRotas(), listarVeiculos()]);
  const veicPorId = new Map(veiculos.map((v) => [v.id, v]));
  const rotaPorId = new Map(rotas.map((r) => [r.id, r]));
  const entradas: EntradaBuscaReal[] = rotas
    .filter((r) => rotaElegivelParaBusca(r))
    .map((r) => ({ rota: r, veiculo: r.veiculoId ? veicPorId.get(r.veiculoId) ?? null : null }));

  const todos: CartaoRotaRealDados[] = [];
  const sentidos: SituacaoSentido[] = [];
  for (const sentido of sentidosDe(criterios.modalidade)) {
    const { resultados, totalRotasAvaliadas } = buscarEmRotasReais(entradas, {
      origem: { lat: criterios.origemLat!, lng: criterios.origemLng! },
      destinoId: criterios.destinoId,
      escolaPonto: escolaPonto ?? null,
      sentido,
      turno: criterios.turno,
      contratacao: criterios.contratacao,
      horarioFamiliaMin: horaParaMinutoDoDia(horarioDoSentido(criterios, sentido)),
    // Demonstração local: tempos ESTIMADOS — o núcleo limita a "sob confirmação".
    }, criarMatrizDemo());
    const lista: CartaoRotaRealDados[] = resultados.map((r) => {
      const rota = rotaPorId.get(r.rotaId);
      const van = rota?.veiculoId ? veicPorId.get(rota.veiculoId) : undefined;
      return {
        rotaId: r.rotaId,
        rotaNome: rota?.nome || 'Rota',
        vanLugares: van?.lugaresPassageiro ?? null,
        vagas: r.vagas,
        atendeEscola: r.atendeEscola,
        origemEscola: r.origemEscola,
        sentido: r.sentido,
        status: r.status,
        pendencia: r.pendencia ?? null,
        passagemCasaMin: r.passagemCasaMin,
        horarioEscolaMin: r.horarioEscolaMin,
        minutosABordo: r.minutosABordo,
        temposEstimados: r.temposEstimados,
        motivo: r.motivo,
      };
    });
    todos.push(...lista);
    // Sem provedor viário no navegador: o que não coube pela estimativa fica "incompleto".
    sentidos.push({ ...situacaoDe(sentido, 'ok', lista, { totalRotasAvaliadas }), semProvedor: true });
  }
  return montar(sentidos, todos);
}
