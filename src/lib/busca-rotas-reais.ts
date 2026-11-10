import type { Rota, Veiculo } from '@/types/motorista';
import {
  simularEncaixeProgressivo,
  limitePadraoDoTurno,
  type AlunoNovo,
  type CodigoMotivo,
} from '@/lib/rota-para-encaixe';
import { criarMatrizDemo, haversineMetros, type MatrizViaria } from '@/lib/encaixe';
import { vagasParaNovos } from '@/lib/ocupacao-rota';

/** Distância máxima (m) de uma parada da rota à escola pedida para a rota ser
 *  CANDIDATA quando não atende a escola (Tier B). Pré-filtro barato: o motor
 *  ainda PRECISA provar que o encaixe cabe. */
export const PROX_ESCOLA_M = 3000;

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
  /** Id do destino/escola do catálogo. */
  destinoId: string | null;
  /** Coordenadas da escola do catálogo. Permitem AVALIAR rotas que passam perto
   *  da escola mesmo sem a terem cadastrada (Tier B — inserção da escola nova). */
  escolaPonto?: { lat: number; lng: number } | null;
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
  /** Vagas livres da rota (capacidade − pico de ocupação). */
  vagas: number;
  /** A rota já atende a escola pedida (Tier A) ou foi avaliada por proximidade (Tier B). */
  atendeEscola: boolean;
  /** Alteração na rota (min) que o encaixe causaria; menor = melhor. */
  desvioMin: number | null;
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
  /** Como o encaixe pode ser efetivado (quando calculado). */
  classe?: 'imediato' | 'pre_autorizado' | 'aprovacao_motorista';
  /** Minutos que a van precisaria sair antes do habitual. */
  antecipacaoMin?: number;
}

/** Elegibilidade NO NÍVEL DA ROTA: real (não-demo), concluída e com casa +
 *  escola. NÃO exige publicação manual nem confirmação prévia do motorista:
 *  qualquer rota concluída já é avaliada e apresentada (decisão de produto). */
export function rotaElegivelParaBusca(
  rota: Pick<Rota, 'status' | 'paradas'> & { isDemo?: boolean },
): boolean {
  if (rota.isDemo) return false;
  if (rota.status !== 'concluida') return false;
  const temEscola = rota.paradas.some((p) => p.tipo === 'escola');
  const temCasa = rota.paradas.some((p) => p.tipo === 'casa');
  return temEscola && temCasa;
}

/** A rota passa SUFICIENTEMENTE PERTO da escola pedida (pré-filtro do Tier B)?
 *  Alguma parada a no máximo PROX_ESCOLA_M da escola. Não garante encaixe —
 *  o motor ainda precisa provar que cabe. */
export function rotaPassaPertoDaEscola(rota: Rota, escolaPonto?: { lat: number; lng: number } | null): boolean {
  if (!escolaPonto || !Number.isFinite(escolaPonto.lat) || !Number.isFinite(escolaPonto.lng)) return false;
  return rota.paradas.some(
    (p) => p.lat != null && p.lng != null && Number.isFinite(p.lat) && Number.isFinite(p.lng)
      && haversineMetros({ lat: p.lat, lng: p.lng }, escolaPonto) <= PROX_ESCOLA_M,
  );
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
const MOTIVO_DEPENDE_MOTORISTA = 'Cabe na rota, mas o motorista precisaria ajustar a saída ou a ordem das paradas — fica sob confirmação dele.';
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
  const vagas = vagasParaNovos(rota, veiculo);
  const atendeEscola = rotaAtendeDestino(rota, pedido.destinoId);
  const vazio = (status: StatusBuscaReal, motivo: string, codigos: CodigoMotivo[] = []): ResultadoRotaReal => ({
    rotaId: rota.id,
    sentido: rota.sentido,
    status,
    vagas,
    atendeEscola,
    desvioMin: null,
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
  // 1º FILTRO: sem vaga, não aparece como disponível.
  if (vagas < 1) {
    return vazio('incompativel', 'Esta van está sem vagas para novos passageiros.', ['capacidade']);
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
    // Coords da escola do catálogo: permitem INSERIR a escola quando a rota só
    // passa perto (Tier B). Em Tier A a escola já está no itinerário.
    ...(pedido.escolaPonto && Number.isFinite(pedido.escolaPonto.lat) && Number.isFinite(pedido.escolaPonto.lng)
      ? { escolaPonto: { id: pedido.destinoId, nome: 'Escola', lat: pedido.escolaPonto.lat, lng: pedido.escolaPonto.lng } }
      : {}),
  };

  const sim = simularEncaixeProgressivo(rota, veiculo, aluno, matriz, { horarioEscolaMin: horarioEscola });

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
  // Horário fraco quando veio do turno (Tier B ou escola sem horário declarado).
  const horarioFraco = fonte === 'turno';
  // Encaixe que exige sair mais cedo do que o motorista autorizou (ou mudar a
  // ordem das paradas) é possível, mas NÃO é vaga garantida: depende dele.
  const dependeMotorista = sim.classe === 'aprovacao_motorista';
  const status: StatusBuscaReal = avulso || horarioFraco || dependeMotorista ? 'sob_confirmacao' : 'compativel';
  const motivo = avulso ? MOTIVO_AVULSO : horarioFraco ? MOTIVO_OK_FRACO : dependeMotorista ? MOTIVO_DEPENDE_MOTORISTA : MOTIVO_OK;

  return {
    rotaId: rota.id,
    sentido: rota.sentido,
    status,
    vagas,
    atendeEscola,
    desvioMin: op.desvioMin,
    passagemCasaMin,
    horarioEscolaMin: horarioEscolaResMin,
    minutosABordo: op.minutosABordo,
    fonteHorario: fonte,
    motivo,
    codigos: [],
    classe: sim.classe,
    antecipacaoMin: sim.antecipacaoMin ?? 0,
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
 * Avalia o pedido da família contra uma lista de rotas reais JÁ ELEGÍVEIS.
 * Recortes, nesta ordem:
 *   1) mesmo sentido;
 *   2) COM VAGA (capacidade − pico de ocupação ≥ 1) — motoristas sem vaga não
 *      entram;
 *   3) que já ATENDEM a escola (Tier A) OU passam PERTO dela (Tier B).
 * Para cada candidata o motor PROVA o encaixe (nunca "compatível" só por vaga ou
 * proximidade). Ordena: compatíveis antes de "sob confirmação"; Tier A antes de
 * Tier B; menor alteração de rota; coleta mais cedo. Saída sem PII.
 */
export function buscarEmRotasReais(
  entradas: EntradaBuscaReal[],
  pedido: PedidoFamilia,
  matriz: MatrizViaria = criarMatrizDemo(),
): ResultadoBuscaReal {
  const candidatas = entradas.filter((e) => {
    if (e.rota.sentido !== pedido.sentido) return false;
    if (vagasParaNovos(e.rota, e.veiculo) < 1) return false; // 1º filtro: vaga
    return rotaAtendeDestino(e.rota, pedido.destinoId) || rotaPassaPertoDaEscola(e.rota, pedido.escolaPonto);
  });
  const resultados = candidatas
    .map((e) => avaliarRotaReal(e.rota, e.veiculo, pedido, matriz))
    .sort((a, b) => {
      // §6.3 — ordenação pela MELHOR EXPERIÊNCIA DO NOVO ALUNO, nesta ordem:
      // 1) status (compatível antes de "sob confirmação");
      // 2) MENOR TEMPO A BORDO do novo aluno (experiência de deslocamento do
      //    aluno) — NÃO confundir com o desvio do motorista;
      // 3) MENOR DESVIO/impacto necessário para o encaixe (desempate);
      // 4) rota que já ATENDE a escola (Tier A) antes de proximidade (Tier B);
      // 5) coleta mais cedo em casa.
      if (pesoStatus(a.status) !== pesoStatus(b.status)) return pesoStatus(a.status) - pesoStatus(b.status);
      const ba = a.minutosABordo ?? Number.POSITIVE_INFINITY;
      const bb = b.minutosABordo ?? Number.POSITIVE_INFINITY;
      if (ba !== bb) return ba - bb; // 2) menor permanência do aluno na van
      const da = a.desvioMin ?? Number.POSITIVE_INFINITY;
      const db = b.desvioMin ?? Number.POSITIVE_INFINITY;
      if (da !== db) return da - db; // 3) menor desvio/impacto (desempate)
      if (a.atendeEscola !== b.atendeEscola) return a.atendeEscola ? -1 : 1; // 4) Tier A antes de Tier B
      const pa = a.passagemCasaMin ?? Number.POSITIVE_INFINITY;
      const pb = b.passagemCasaMin ?? Number.POSITIVE_INFINITY;
      return pa - pb; // 5) coleta mais cedo
    });
  return { resultados, totalRotasAvaliadas: candidatas.length };
}
