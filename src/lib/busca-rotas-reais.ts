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

/** Elegibilidade NO NÍVEL DA ROTA (o nível do motorista — anúncio ativo — é
 *  checado onde os anúncios são conhecidos). Rota real e concluída, não demo. */
export function rotaElegivelParaBusca(rota: Pick<Rota, 'status' | 'paradas'> & { isDemo?: boolean }): boolean {
  if (rota.isDemo) return false;
  if (rota.status !== 'concluida') return false;
  // precisa de ao menos uma escola e uma casa no itinerário
  const temEscola = rota.paradas.some((p) => p.tipo === 'escola');
  const temCasa = rota.paradas.some((p) => p.tipo === 'casa');
  return temEscola && temCasa;
}

/** Âncora de horário de escola para o destino escolhido, preferindo dados REAIS. */
function ancoraHorarioEscola(rota: Rota, pedido: PedidoFamilia): { min: number | null; fonte: FonteHorario } {
  if (pedido.horarioEscolaMin != null && Number.isFinite(pedido.horarioEscolaMin)) {
    return { min: pedido.horarioEscolaMin, fonte: 'rota' };
  }
  // Horário habitual de chegada da parada da escola escolhida (dado real da rota).
  const escolaStop = rota.paradas.find((p) => p.tipo === 'escola' && p.destinoId === pedido.destinoId);
  if (escolaStop && escolaStop.horarioChegadaMin != null && Number.isFinite(escolaStop.horarioChegadaMin)) {
    return { min: escolaStop.horarioChegadaMin, fonte: 'rota' };
  }
  // Limite final da rota (último desembarque), também real.
  if (rota.ultimoDesembarqueMin != null && Number.isFinite(rota.ultimoDesembarqueMin)) {
    return { min: rota.ultimoDesembarqueMin, fonte: 'rota' };
  }
  // Último recurso: padrão do turno — resultado NUNCA confirmado.
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
  // Só avalia rotas do MESMO sentido pedido (ida e volta são independentes).
  const doSentido = entradas.filter((e) => e.rota.sentido === pedido.sentido);
  const resultados = doSentido
    .map((e) => avaliarRotaReal(e.rota, e.veiculo, pedido, matriz))
    .sort((a, b) => {
      if (pesoStatus(a.status) !== pesoStatus(b.status)) return pesoStatus(a.status) - pesoStatus(b.status);
      const pa = a.passagemCasaMin ?? Number.POSITIVE_INFINITY;
      const pb = b.passagemCasaMin ?? Number.POSITIVE_INFINITY;
      return pa - pb;
    });
  return { resultados, totalRotasAvaliadas: doSentido.length };
}
