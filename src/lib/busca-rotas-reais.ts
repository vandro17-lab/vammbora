import type { Rota, Veiculo } from '@/types/motorista';
import {
  simularEncaixeRota,
  limitePadraoDoTurno,
  type AlunoNovo,
  type CodigoMotivo,
} from '@/lib/rota-para-encaixe';
import { criarMatrizDemo, type MatrizViaria } from '@/lib/encaixe';

/**
 * BUSCA PÚBLICA SOBRE ROTAS REAIS (adaptador, não um motor novo).
 * ---------------------------------------------------------------------------
 * A família informa origem CONFIRMADA, escola (destino) e sentido. Para cada
 * rota real ELEGÍVEL, tratamos a família como um "novo aluno" e rodamos o MESMO
 * `simularEncaixeRota` já usado pelo simulador do motorista — que por sua vez usa
 * o motor `encaixe-geografico` (capacidade por trecho, ida/volta, tolerância,
 * limites de escola). Nada é reimplementado aqui.
 *
 * SEGURANÇA/PII: a entrada pode conter coordenadas privadas (casas de alunos já
 * cadastrados), por isso esta avaliação deve rodar no SERVIDOR quando a fonte for
 * o Supabase. A SAÍDA desta função é SEM PII: nenhum nome de aluno, nenhum
 * endereço residencial de terceiros — apenas o veredito e horários estimados.
 *
 * HONESTIDADE DE HORÁRIO (§5.4): usamos âncora de horário de escola REAL quando
 * existir (limite da rota ou horário habitual da parada da escola). Só caímos no
 * padrão do turno como ÚLTIMO recurso, e nesse caso o resultado nunca é
 * apresentado como confirmado — vira "sob confirmação".
 */

export type StatusBuscaReal =
  | 'compativel' // encaixe calculado com horários estimados
  | 'sob_confirmacao' // indícios úteis, mas falta validar uma condição (ex.: avulso, âncora de horário fraca)
  | 'indeterminado' // não dá para calcular com segurança (faltou dado/viário/horário)
  | 'incompativel'; // rota não atende (capacidade, atraso, escola fora do itinerário...)

export interface PedidoFamilia {
  /** Coordenada CONFIRMADA da origem (sem ela não se classifica compatibilidade). */
  origem: { lat: number; lng: number } | null;
  /** Id do destino/escola do catálogo (deve existir no itinerário da rota). */
  destinoId: string | null;
  sentido: 'ida' | 'volta';
  turno?: string | null;
  contratacao?: 'mensal' | 'avulso' | null;
  /** Override opcional do horário-limite de escola (minuto do dia). */
  horarioEscolaMin?: number | null;
}

export type FonteHorario = 'rota' | 'turno' | 'nenhuma';

export interface ResultadoRotaReal {
  rotaId: string;
  sentido: 'ida' | 'volta';
  status: StatusBuscaReal;
  /** Ida: hora que a van passaria na CASA (coleta). Volta: hora que deixaria em CASA (entrega). */
  passagemCasaMin: number | null;
  /** Ida: chegada à ESCOLA. Volta: saída da ESCOLA. */
  horarioEscolaMin: number | null;
  /** Minutos a bordo estimados (quando calculável). */
  minutosABordo: number | null;
  /** De onde veio a âncora de horário: rota (real) > turno (fraca) > nenhuma. */
  fonteHorario: FonteHorario;
  /** Mensagem amigável (pt-BR), sem jargão técnico. */
  motivo: string;
  codigos: CodigoMotivo[];
}

/** Elegibilidade NO NÍVEL DA ROTA: real, concluída, PUBLICADA pelo motorista
 *  (ação explícita — "concluída" não implica "publicada") e com casa + escola. */
export function rotaElegivelParaBusca(
  rota: Pick<Rota, 'status' | 'paradas' | 'isPublished'> & { isDemo?: boolean },
): boolean {
  if (rota.isDemo) return false;
  if (rota.status !== 'concluida') return false;
  if (!rota.isPublished) return false; // só aparece quando o motorista publica
  const temEscola = rota.paradas.some((p) => p.tipo === 'escola');
  const temCasa = rota.paradas.some((p) => p.tipo === 'casa');
  return temEscola && temCasa;
}

/**
 * A rota ATENDE a escola pedida? (tem uma parada de escola com esse destino).
 * É o 1º filtro da busca: "todos os motoristas que passam por aquela escola".
 */
export function rotaAtendeDestino(rota: Pick<Rota, 'paradas'>, destinoId: string | null): boolean {
  if (!destinoId) return true; // sem destino escolhido, não filtra por escola
  return rota.paradas.some((p) => p.tipo === 'escola' && p.destinoId === destinoId);
}

/** Localiza a parada da escola escolhida e diz se é a ÚLTIMA escola da rota. */
function escolaEscolhida(rota: Rota, destinoId: string | null) {
  if (!destinoId) return null;
  const escolas = rota.paradas.filter((p) => p.tipo === 'escola');
  const alvo = escolas.find((p) => p.destinoId === destinoId);
  if (!alvo) return null;
  const ultimaOrdem = escolas.reduce((m, p) => Math.max(m, p.ordem), Number.NEGATIVE_INFINITY);
  return { alvo, ehUltimaEscola: alvo.ordem === ultimaOrdem };
}

/**
 * Âncora de horário: o horário que o MOTORISTA declarou para chegar NAQUELA
 * escola. É a base de todo o cálculo (planejamento de trás pra frente), por isso
 * a escolha é estrita, para dar menos erro:
 *   1) horário informado explicitamente no pedido (override do servidor);
 *   2) horário de chegada da PRÓPRIA parada da escola escolhida (dado real);
 *   3) último desembarque da rota — SÓ quando a escola escolhida é a última da
 *      rota (senão esse horário é de OUTRA escola e induziria a erro);
 *   4) padrão do turno — fraco, resultado nunca confirmado;
 *   5) nenhum — não dá para estimar com segurança.
 */
function ancoraHorarioEscola(rota: Rota, pedido: PedidoFamilia): { min: number | null; fonte: FonteHorario } {
  if (pedido.horarioEscolaMin != null && Number.isFinite(pedido.horarioEscolaMin)) {
    return { min: pedido.horarioEscolaMin, fonte: 'rota' };
  }
  const esc = escolaEscolhida(rota, pedido.destinoId);
  // 2) Horário habitual de chegada da parada da escola escolhida (dado real).
  if (esc && esc.alvo.horarioChegadaMin != null && Number.isFinite(esc.alvo.horarioChegadaMin)) {
    return { min: esc.alvo.horarioChegadaMin, fonte: 'rota' };
  }
  // 3) Último desembarque só vale para a ÚLTIMA escola da rota.
  if (esc && esc.ehUltimaEscola && rota.ultimoDesembarqueMin != null && Number.isFinite(rota.ultimoDesembarqueMin)) {
    return { min: rota.ultimoDesembarqueMin, fonte: 'rota' };
  }
  // 4) Último recurso: padrão do turno — resultado NUNCA confirmado.
  const padrao = limitePadraoDoTurno(pedido.turno ?? rota.turno ?? null);
  if (padrao != null) return { min: padrao, fonte: 'turno' };
  return { min: null, fonte: 'nenhuma' };
}

const INDETERMINADOS: CodigoMotivo[] = ['localizacao', 'trecho', 'rota_base', 'dados'];

function statusDeCodigos(codigos: CodigoMotivo[]): StatusBuscaReal {
  // Qualquer motivo "de dados" => indeterminado; caso contrário, incompatível de fato.
  return codigos.some((c) => INDETERMINADOS.includes(c)) ? 'indeterminado' : 'incompativel';
}

const MOTIVO_OK = 'Encaixa nesta rota. Horário estimado pela rota — sujeito à confirmação do motorista.';
const MOTIVO_OK_FRACO = 'Parece compatível, mas o horário desta rota ainda não foi informado — fica sob confirmação.';
const MOTIVO_AVULSO = 'Encaixe calculado; como é avulso, confirme a data direto com o motorista.';
const MOTIVO_SEM_ORIGEM = 'Confirme um endereço de origem válido no mapa para calcularmos a compatibilidade.';
const MOTIVO_SEM_DESTINO = 'Escolha a escola de destino para avaliarmos esta rota.';
const MOTIVO_SEM_HORARIO = 'Esta rota ainda não tem horário suficiente para estimar — horário sob confirmação.';

/**
 * Avalia UMA rota real contra o pedido da família. `matriz` deve vir de um
 * provedor viário real no servidor; nos testes/demonstração usa a matriz
 * determinística por coordenadas (origem 'demonstracao').
 */
export function avaliarRotaReal(
  rota: Rota,
  veiculo: Veiculo | null,
  pedido: PedidoFamilia,
  matriz: MatrizViaria = criarMatrizDemo(),
): ResultadoRotaReal {
  const vazio = (status: StatusBuscaReal, motivo: string, codigos: CodigoMotivo[] = []): ResultadoRotaReal => ({
    rotaId: rota.id,
    sentido: rota.sentido,
    status,
    passagemCasaMin: null,
    horarioEscolaMin: null,
    minutosABordo: null,
    fonteHorario: 'nenhuma',
    motivo,
    codigos,
  });

  // O sentido pedido precisa bater com o da rota (ida e volta são rotas independentes).
  if (rota.sentido !== pedido.sentido) {
    return vazio('incompativel', 'Esta rota é do outro sentido (ida/volta).');
  }
  if (!pedido.origem || !Number.isFinite(pedido.origem.lat) || !Number.isFinite(pedido.origem.lng)) {
    return vazio('indeterminado', MOTIVO_SEM_ORIGEM, ['localizacao']);
  }
  if (!pedido.destinoId) {
    return vazio('indeterminado', MOTIVO_SEM_DESTINO, ['dados']);
  }

  const { min: horarioEscola, fonte } = ancoraHorarioEscola(rota, pedido);
  if (horarioEscola == null) {
    return vazio('indeterminado', MOTIVO_SEM_HORARIO, ['dados']);
  }

  const aluno: AlunoNovo = {
    alunoId: 'familia',
    nome: 'Família',
    casa: { id: 'familia-casa', nome: 'Origem da família', lat: pedido.origem.lat, lng: pedido.origem.lng },
    escolaId: pedido.destinoId,
  };

  const sim = simularEncaixeRota(rota, veiculo, aluno, matriz, { horarioEscolaMin: horarioEscola });

  if (!sim.elegivel || !sim.opcao) {
    return {
      ...vazio(statusDeCodigos(sim.codigos), sim.motivos[0] ?? 'Não foi possível encaixar nesta rota.', sim.codigos),
    };
  }

  // Encaixe calculado. Mapeia horários conforme o sentido.
  const op = sim.opcao;
  // op.horarioBuscaMin = embarque do novo aluno; op.horarioEntregaMin = desembarque.
  // Ida: embarque = casa (coleta), entrega = escola. Volta: embarque = escola, entrega = casa.
  const passagemCasaMin = rota.sentido === 'ida' ? op.horarioBuscaMin : op.horarioEntregaMin;
  const horarioEscolaResMin = rota.sentido === 'ida' ? op.horarioEntregaMin : op.horarioBuscaMin;

  const avulso = pedido.contratacao === 'avulso';
  const horarioFraco = fonte === 'turno';
  const status: StatusBuscaReal = avulso || horarioFraco ? 'sob_confirmacao' : 'compativel';
  const motivo = avulso ? MOTIVO_AVULSO : horarioFraco ? MOTIVO_OK_FRACO : MOTIVO_OK;

  return {
    rotaId: rota.id,
    sentido: rota.sentido,
    status,
    passagemCasaMin,
    horarioEscolaMin: horarioEscolaResMin,
    minutosABordo: op.minutosABordo,
    fonteHorario: fonte,
    motivo,
    codigos: [],
  };
}

/** Peso de ordenação: compatível primeiro, depois sob confirmação, etc. */
function pesoStatus(s: StatusBuscaReal): number {
  return s === 'compativel' ? 0 : s === 'sob_confirmacao' ? 1 : s === 'indeterminado' ? 2 : 3;
}

export interface EntradaBuscaReal {
  rota: Rota;
  veiculo: Veiculo | null;
}

export interface ResultadoBuscaReal {
  resultados: ResultadoRotaReal[];
  totalRotasAvaliadas: number;
}

/**
 * Avalia o pedido da família contra uma lista de rotas reais JÁ ELEGÍVEIS
 * (status/anúncio filtrados na origem). Devolve apenas resultados sem PII,
 * ordenados por compatibilidade e menor passagem na casa.
 */
export function buscarEmRotasReais(
  entradas: EntradaBuscaReal[],
  pedido: PedidoFamilia,
  matriz: MatrizViaria = criarMatrizDemo(),
): ResultadoBuscaReal {
  // 1º recorte (o que o usuário descreveu): só as rotas do MESMO sentido pedido
  // (ida/volta são independentes) QUE JÁ PASSAM pela escola escolhida. Para cada
  // uma testamos o encaixe a partir do horário que o motorista declarou ali.
  const candidatas = entradas.filter(
    (e) => e.rota.sentido === pedido.sentido && rotaAtendeDestino(e.rota, pedido.destinoId),
  );
  const resultados = candidatas
    .map((e) => avaliarRotaReal(e.rota, e.veiculo, pedido, matriz))
    .sort((a, b) => {
      if (pesoStatus(a.status) !== pesoStatus(b.status)) return pesoStatus(a.status) - pesoStatus(b.status);
      const pa = a.passagemCasaMin ?? Number.POSITIVE_INFINITY;
      const pb = b.passagemCasaMin ?? Number.POSITIVE_INFINITY;
      return pa - pb;
    });
  return { resultados, totalRotasAvaliadas: candidatas.length };
}
