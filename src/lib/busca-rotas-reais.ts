import type { Rota, Veiculo } from '@/types/motorista';
import {
  simularEncaixeProgressivo,
  limitePadraoDoTurno,
  coletarPontos,
  type AlunoNovo,
  type CodigoMotivo,
  type ResultadoSimulacao,
} from '@/lib/rota-para-encaixe';
import type { PontoGeo } from '@/engine/encaixe-geografico';
import { minutoDoDia } from '@/lib/cadastro-rota';
import { haversineMetros, type MatrizViaria } from '@/lib/encaixe';
import { capacidadeAlunos } from '@/lib/ocupacao-rota';
import { horarioDaEscola } from '@/lib/cadastro-rota';

/** Distância máxima (m, em LINHA RETA) de uma parada/trecho da rota à escola
 *  pedida para um CADASTRO ANTIGO (que nunca informou as escolas que aceita)
 *  entrar como candidato. É só um recorte aproximado para priorizar — linha
 *  reta não é percurso pelas ruas e nunca prova viabilidade. NÃO se aplica a
 *  rotas que já visitam a escola nem às que a aceitam explicitamente. */
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
  | 'indeterminado' // não dá para afirmar nada — ver `pendencia` (dado faltando x avaliação não concluída)
  | 'incompativel'; // COMPROVADO com dados completos (capacidade no trecho, horário, escola não aceita...)

/**
 * Por que um resultado ficou sem veredito (só quando `status === 'indeterminado'`):
 *  - dados_insuficientes .. falta algo no CADASTRO da rota (van, coordenada,
 *    horário, rota-base inconsistente). Tentar de novo não resolve.
 *  - avaliacao_incompleta . o cálculo pelas ruas não foi feito/concluído
 *    (consulta viária ausente ou falhou, trecho sem resposta, rota extensa,
 *    busca interrompida). NÃO é incompatibilidade; continuar/tentar resolve.
 */
export type PendenciaAvaliacao = 'dados_insuficientes' | 'avaliacao_incompleta';

/** Como a rota se relaciona com a escola pedida. */
export type OrigemEscola =
  | 'visita' // a escola já é parada da rota
  | 'aceita' // o motorista informou que aceita incluí-la nesta rota
  | 'proximidade'; // cadastro antigo (lista nunca revisada): recorte aproximado

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
  /** Horário informado pela FAMÍLIA (minuto do dia), DO SENTIDO deste pedido.
   *  Ida: prazo — até que horas o aluno precisa chegar à escola. Volta: a
   *  partir de que horas ele está liberado. É exigência do novo aluno; não
   *  altera os compromissos dos atuais nem o horário da escola na rota. */
  horarioFamiliaMin?: number | null;
  /** Ida: abertura do portão da escola, quando informada no pedido (simulador). */
  aberturaEscolaMin?: number | null;
}

export type FonteHorario = 'rota' | 'familia' | 'turno' | 'nenhuma';

export interface ResultadoRotaReal {
  rotaId: string;
  sentido: 'ida' | 'volta';
  status: StatusBuscaReal;
  /** Lugares livres NO TRECHO que o novo aluno ocuparia (antes de incluí-lo).
   *  `null` enquanto o encaixe não foi calculado — nunca o pico global da
   *  rota, que diria "zero vagas" onde há lugar depois de um desembarque. */
  vagas: number | null;
  /** A rota já visita a escola pedida. */
  atendeEscola: boolean;
  /** Visita, aceita explicitamente ou recorte aproximado de cadastro antigo. */
  origemEscola: OrigemEscola;
  /** Só com `status === 'indeterminado'`: o que faltou (ver `PendenciaAvaliacao`). */
  pendencia?: PendenciaAvaliacao;
  /** Versão (opaca) da rota + van avaliadas — ver `versaoDaAvaliacao`. */
  versao?: string;
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
  /** true = tempos de percurso ESTIMADOS por distância (sem consulta viária).
   *  Nesse caso o resultado NUNCA é "compatível": no máximo "sob confirmação". */
  temposEstimados: boolean;
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
  const pontos = [...rota.paradas].sort((a, b) => a.ordem - b.ordem)
    .filter((p) => p.lat != null && p.lng != null && Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .map((p) => ({ lat: p.lat as number, lng: p.lng as number }));
  if (pontos.some((p) => haversineMetros(p, escolaPonto) <= PROX_ESCOLA_M)) return true;
  // Corredor: a escola pode estar no CAMINHO entre duas paradas distantes
  // (trecho longo sem parada perto dela). Mede a distância ao segmento.
  for (let i = 0; i + 1 < pontos.length; i++) {
    if (distanciaAoSegmentoM(escolaPonto, pontos[i], pontos[i + 1]) <= PROX_ESCOLA_M) return true;
  }
  return false;
}

/** Distância (m) de um ponto ao segmento a→b, em projeção local (válida para trechos urbanos). */
export function distanciaAoSegmentoM(p: { lat: number; lng: number }, a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const k = Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
  const ax = a.lng * k, ay = a.lat, bx = b.lng * k, by = b.lat, px = p.lng * k, py = p.lat;
  const dx = bx - ax, dy = by - ay;
  const comp2 = dx * dx + dy * dy;
  const t = comp2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / comp2)) : 0;
  const proj = { lat: ay + dy * t, lng: (ax + dx * t) / k };
  return haversineMetros(p, proj);
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
 * Âncora de horário: o horário DA ESCOLA nesta rota. É a base do cálculo
 * (planejamento de trás pra frente), por isso a escolha é estrita:
 *   1) horário informado explicitamente no pedido (override do servidor);
 *   2) horário declarado da PRÓPRIA parada da escola (dado real);
 *   3) último desembarque da rota — SÓ quando a escola é a última da rota
 *      (senão esse horário é de OUTRA escola e induziria a erro);
 *   4) escola ACEITA e ainda não visitada: o limite/liberação que o motorista
 *      informou na lista de aceitas; sem ele, o horário da FAMÍLIA (é a única
 *      exigência conhecida para a parada nova — e não mexe na rota atual);
 *   5) padrão do turno (só na IDA) — fraco, resultado nunca confirmado;
 *   6) nenhum — não dá para estimar com segurança.
 * O horário da família NUNCA vira o horário de uma escola que a rota já
 * visita: lá ele entra à parte, como prazo/liberação só do novo aluno.
 */
export function ancoraHorarioEscola(rota: Rota, pedido: PedidoFamilia): { min: number | null; fonte: FonteHorario } {
  if (pedido.horarioEscolaMin != null && Number.isFinite(pedido.horarioEscolaMin)) {
    return { min: pedido.horarioEscolaMin, fonte: 'rota' };
  }
  const esc = escolaEscolhida(rota, pedido.destinoId);
  const declarado = esc ? horarioDaEscola(esc.alvo, rota.sentido) : null;
  if (declarado != null) return { min: declarado, fonte: 'rota' };
  if (esc && esc.ehUltimaEscola && rota.ultimoDesembarqueMin != null && Number.isFinite(rota.ultimoDesembarqueMin)) {
    return { min: rota.ultimoDesembarqueMin, fonte: 'rota' };
  }
  if (!esc) {
    const aceita = (rota.escolasDisponiveis ?? []).find((e) => e.destinoId === pedido.destinoId);
    const daLista = minutoDoDia(rota.sentido === 'ida' ? aceita?.limiteChegadaMin : aceita?.liberacaoMin);
    if (daLista != null) return { min: daLista, fonte: 'rota' };
    const familia = minutoDoDia(pedido.horarioFamiliaMin);
    if (familia != null) return { min: familia, fonte: 'familia' };
  }
  // O padrão do turno é um horário de CHEGADA à escola: só serve à ida. Na volta
  // não há padrão para "quando os alunos são liberados" — sem a liberação
  // informada, não se calcula (não se usa 7h00 como saída do meio-dia).
  const padrao = rota.sentido === 'ida' ? limitePadraoDoTurno(pedido.turno ?? rota.turno ?? null) : null;
  if (padrao != null) return { min: padrao, fonte: 'turno' };
  return { min: null, fonte: 'nenhuma' };
}

/** Falta algo no cadastro da rota: repetir a busca não muda o resultado. */
const DADOS_INSUFICIENTES: CodigoMotivo[] = ['localizacao', 'rota_base', 'dados', 'van', 'sem_horarios'];
/** O cálculo não foi feito/concluído: não é incompatibilidade. */
const AVALIACAO_INCOMPLETA: CodigoMotivo[] = ['trecho', 'busca_incompleta', 'sem_consulta_viaria'];
/** Recusas/pendências que NÃO dependem de tempos de trajeto (valem mesmo sem consulta viária). */
const SEM_VIARIO: CodigoMotivo[] = ['escola_itinerario', 'escola_nao_aceita', 'aluno_duplicado', 'localizacao', 'van', 'sem_horarios'];

function statusDeCodigos(codigos: CodigoMotivo[]): { status: StatusBuscaReal; pendencia?: PendenciaAvaliacao } {
  // Avaliação não concluída prevalece: nada foi provado contra a rota.
  if (codigos.some((c) => AVALIACAO_INCOMPLETA.includes(c))) return { status: 'indeterminado', pendencia: 'avaliacao_incompleta' };
  if (codigos.some((c) => DADOS_INSUFICIENTES.includes(c))) return { status: 'indeterminado', pendencia: 'dados_insuficientes' };
  return { status: 'incompativel' };
}

const MOTIVO_OK = 'Encaixa nesta rota. Horário estimado pela rota — sujeito à confirmação do motorista.';
const MOTIVO_OK_FRACO = 'Parece compatível, mas o horário desta rota ainda não foi informado — fica sob confirmação.';
const MOTIVO_DEPENDE_MOTORISTA = 'Cabe na rota, mas o motorista precisaria ajustar a saída ou a ordem das paradas — fica sob confirmação dele.';
const MOTIVO_TEMPO_ESTIMADO = 'Parece compatível, mas os tempos de trajeto foram estimados pela distância (sem consulta às ruas) — fica sob confirmação do motorista.';
const MOTIVO_AVULSO = 'Encaixe calculado; como é avulso, confirme a data direto com o motorista.';
const MOTIVO_SEM_ORIGEM = 'Confirme um endereço de origem válido no mapa para calcularmos a compatibilidade.';
const MOTIVO_SEM_DESTINO = 'Escolha a escola de destino para avaliarmos esta rota.';
const MOTIVO_SEM_HORARIO = 'Esta rota ainda não tem horário suficiente para estimar — horário sob confirmação.';
const MOTIVO_SEM_AVALIACAO_REAL = 'Esta rota ainda não foi calculada com os trajetos reais das ruas — isso não significa que não cabe.';
const MOTIVO_ESCOLA_ACEITA = 'O motorista aceita incluir esta escola: casa e escola foram calculadas juntas na rota.';
const MOTIVO_SEM_LUGAR = 'Esta van não tem lugar disponível para alunos.';

/** Matriz sem dado viário real (tempos estimados pelas coordenadas)? */
export const matrizEhEstimativa = (matriz: MatrizViaria): boolean => matriz.origem === 'demonstracao';

/** Novo aluno (família) no formato do adaptador. Ids fixos: é com eles que a
 *  matriz do simulador (indexada por id) e a da busca (por coordenada) casam. */
export function alunoDoPedido(pedido: PedidoFamilia): AlunoNovo | null {
  if (!pedido.origem || !Number.isFinite(pedido.origem.lat) || !Number.isFinite(pedido.origem.lng) || !pedido.destinoId) return null;
  return {
    alunoId: 'familia',
    nome: 'Família',
    casa: { id: 'familia-casa', nome: 'Origem da família', lat: pedido.origem.lat, lng: pedido.origem.lng },
    escolaId: pedido.destinoId,
    // Coords da escola do catálogo: permitem INSERIR a escola quando ela ainda
    // não é parada (aceita pelo motorista ou cadastro antigo).
    ...(pedido.escolaPonto && Number.isFinite(pedido.escolaPonto.lat) && Number.isFinite(pedido.escolaPonto.lng)
      ? { escolaPonto: { id: pedido.destinoId, nome: 'Escola', lat: pedido.escolaPonto.lat, lng: pedido.escolaPonto.lng } }
      : {}),
  };
}

/** Pontos que a matriz viária precisa cobrir para avaliar este pedido nesta
 *  rota: paradas da rota + casa da família + escola nova (se ainda não é parada). */
export function pontosDoPedido(rota: Rota, pedido: PedidoFamilia): { pontos: PontoGeo[]; faltamCoordenadas: string[] } {
  const aluno = alunoDoPedido(pedido);
  if (!aluno) return { pontos: [], faltamCoordenadas: [] };
  return coletarPontos(rota, aluno);
}

/** Como a rota se relaciona com a escola pedida (null = não é candidata). */
export function origemDaEscola(rota: Rota, pedido: Pick<PedidoFamilia, 'destinoId' | 'escolaPonto'>): OrigemEscola | null {
  if (rotaAtendeDestino(rota, pedido.destinoId)) return 'visita';
  // Autorização explícita: vale por si — nenhum raio aproximado a elimina.
  if ((rota.escolasDisponiveis ?? []).some((x) => x.destinoId === pedido.destinoId)) return 'aceita';
  // Lista revisada sem a escola = o motorista não aceita.
  if (rota.disponibilidadeRevisada) return null;
  // Cadastro antigo: recorte aproximado (só prioriza; incluir depende de aprovação).
  return rotaPassaPertoDaEscola(rota, pedido.escolaPonto) ? 'proximidade' : null;
}

export interface AvaliacaoDetalhada {
  /** Resultado SEM dados de terceiros — é o que a família vê. */
  publico: ResultadoRotaReal;
  /** Detalhe do motor (trechos, alterações dos alunos atuais). PRIVADO: só o
   *  motorista dono da rota pode ver. `null` quando nem chegou ao motor. */
  simulacao: ResultadoSimulacao | null;
  /** Horário da escola usado como base e de onde veio. */
  ancora: { min: number | null; fonte: FonteHorario };
}

/**
 * Avalia UMA rota contra um pedido. É a ÚNICA regra operacional: a busca das
 * famílias (servidor) e o simulador do motorista chamam esta função — mesmo
 * pedido, rota, regras e matriz dão o mesmo resultado nas duas telas.
 *
 * `matriz` é OBRIGATÓRIA e deve vir de um provedor viário real. Com a matriz
 * de estimativa (`criarMatrizDemo`, origem 'demonstracao'): encaixe positivo é,
 * no máximo, "sob confirmação"; recusa que dependa de tempo de trajeto fica
 * como AVALIAÇÃO INCOMPLETA — estimativa nunca prova viabilidade nem
 * incompatibilidade.
 */
export function avaliarRotaDetalhada(
  rota: Rota,
  veiculo: Veiculo | null,
  pedido: PedidoFamilia,
  matriz: MatrizViaria,
): AvaliacaoDetalhada {
  const temposEstimados = matrizEhEstimativa(matriz);
  const atendeEscola = rotaAtendeDestino(rota, pedido.destinoId);
  const origemEscola: OrigemEscola = origemDaEscola(rota, pedido) ?? (atendeEscola ? 'visita' : 'proximidade');
  let ancora: AvaliacaoDetalhada['ancora'] = { min: null, fonte: 'nenhuma' };
  const vazio = (status: StatusBuscaReal, motivo: string, codigos: CodigoMotivo[] = [], pendencia?: PendenciaAvaliacao, simulacao: ResultadoSimulacao | null = null): AvaliacaoDetalhada => ({
    publico: {
      rotaId: rota.id,
      sentido: rota.sentido,
      status,
      vagas: null,
      atendeEscola,
      origemEscola,
      ...(status === 'indeterminado' ? { pendencia: pendencia ?? 'dados_insuficientes' } : {}),
      desvioMin: null,
      passagemCasaMin: null,
      horarioEscolaMin: null,
      minutosABordo: null,
      fonteHorario: ancora.fonte,
      motivo,
      codigos,
      temposEstimados,
    },
    simulacao,
    ancora,
  });

  // O sentido pedido precisa bater com o da rota (ida e volta são rotas independentes).
  if (rota.sentido !== pedido.sentido) {
    return vazio('incompativel', 'Esta rota é do outro sentido (ida/volta).');
  }
  // Lugares: a van precisa existir e ter lugar para aluno. Vaga por TRECHO é
  // decidida pelo motor (quem embarca depois de um desembarque pode caber
  // mesmo com o pico lotado) — por isso NÃO há veto por "pico" aqui.
  if (!veiculo) {
    return vazio('indeterminado', 'A van desta rota não está cadastrada — não dá para avaliar os lugares.', ['van']);
  }
  if (capacidadeAlunos(rota, veiculo) < 1) {
    return vazio('incompativel', MOTIVO_SEM_LUGAR, ['capacidade']);
  }
  const aluno = alunoDoPedido(pedido);
  if (!pedido.origem || !Number.isFinite(pedido.origem.lat) || !Number.isFinite(pedido.origem.lng)) {
    return vazio('indeterminado', MOTIVO_SEM_ORIGEM, ['localizacao']);
  }
  if (!pedido.destinoId || !aluno) {
    return vazio('indeterminado', MOTIVO_SEM_DESTINO, ['dados']);
  }

  ancora = ancoraHorarioEscola(rota, pedido);
  const horarioEscola = ancora.min;
  const fonte = ancora.fonte;
  if (horarioEscola == null) {
    return vazio('indeterminado', MOTIVO_SEM_HORARIO, ['dados']);
  }

  const horarioFamilia = minutoDoDia(pedido.horarioFamiliaMin);
  const sim = simularEncaixeProgressivo(rota, veiculo, aluno, matriz, {
    horarioEscolaMin: horarioEscola, horarioAlunoMin: horarioFamilia, aberturaEscolaMin: minutoDoDia(pedido.aberturaEscolaMin),
  });

  if (!sim.elegivel || !sim.opcao) {
    // Recusa que depende de tempo de trajeto, calculada com ESTIMATIVA, não é
    // prova de nada: fica como avaliação incompleta (nunca "incompatível").
    if (temposEstimados && !sim.codigos.some((c) => SEM_VIARIO.includes(c))) {
      return vazio('indeterminado', MOTIVO_SEM_AVALIACAO_REAL, ['sem_consulta_viaria', ...sim.codigos], 'avaliacao_incompleta', sim);
    }
    const { status, pendencia } = statusDeCodigos(sim.codigos);
    return vazio(status, sim.motivos[0] ?? 'Não foi possível encaixar nesta rota.', sim.codigos, pendencia, sim);
  }

  // Encaixe calculado. Mapeia horários conforme o sentido.
  const op = sim.opcao;
  // op.horarioBuscaMin = embarque do novo aluno; op.horarioEntregaMin = desembarque.
  // Ida: embarque = casa (coleta), entrega = escola. Volta: embarque = escola, entrega = casa.
  const passagemCasaMin = rota.sentido === 'ida' ? op.horarioBuscaMin : op.horarioEntregaMin;
  const horarioEscolaResMin = rota.sentido === 'ida' ? op.horarioEntregaMin : op.horarioBuscaMin;

  const avulso = pedido.contratacao === 'avulso';
  // Horário fraco quando veio só do padrão do turno (nem a rota nem a família informaram).
  const horarioFraco = fonte === 'turno';
  // Encaixe que exige sair mais cedo do que o motorista autorizou (ou mudar a
  // ordem das paradas) é possível, mas NÃO é vaga garantida: depende dele.
  const dependeMotorista = sim.classe === 'aprovacao_motorista';
  // Tempos estimados (sem consulta viária) nunca confirmam o encaixe.
  const status: StatusBuscaReal = avulso || horarioFraco || dependeMotorista || temposEstimados ? 'sob_confirmacao' : 'compativel';
  const motivo = avulso ? MOTIVO_AVULSO : horarioFraco ? MOTIVO_OK_FRACO : dependeMotorista ? MOTIVO_DEPENDE_MOTORISTA
    : temposEstimados ? MOTIVO_TEMPO_ESTIMADO : sim.escolaInserida ? MOTIVO_ESCOLA_ACEITA : MOTIVO_OK;

  return {
    publico: {
      rotaId: rota.id,
      sentido: rota.sentido,
      status,
      vagas: sim.vagasNoTrecho ?? null,
      atendeEscola,
      origemEscola,
      desvioMin: op.desvioMin,
      passagemCasaMin,
      horarioEscolaMin: horarioEscolaResMin,
      minutosABordo: op.minutosABordo,
      fonteHorario: fonte,
      motivo,
      codigos: [],
      classe: sim.classe,
      antecipacaoMin: sim.antecipacaoMin ?? 0,
      temposEstimados,
    },
    simulacao: sim,
    ancora,
  };
}

/** Resultado público (sem dados de terceiros) de `avaliarRotaDetalhada`. */
export function avaliarRotaReal(rota: Rota, veiculo: Veiculo | null, pedido: PedidoFamilia, matriz: MatrizViaria): ResultadoRotaReal {
  return avaliarRotaDetalhada(rota, veiculo, pedido, matriz).publico;
}

/** O resultado ainda depende de consultar os trajetos reais para valer?
 *  (Calculado por estimativa: positivo "sob confirmação" ou recusa não provada.) */
export const dependeDeConsultaViaria = (r: ResultadoRotaReal): boolean =>
  r.temposEstimados && (r.status === 'compativel' || r.status === 'sob_confirmacao' || r.codigos.includes('sem_consulta_viaria'));

/** Peso de ordenação: compatível primeiro, depois sob confirmação, etc. */
function pesoStatus(s: StatusBuscaReal): number {
  return s === 'compativel' ? 0 : s === 'sob_confirmacao' ? 1 : s === 'indeterminado' ? 2 : 3;
}

export interface EntradaBuscaReal {
  rota: Rota;
  veiculo: Veiculo | null;
}

/**
 * VERSÃO do que foi avaliado: muda quando muda QUALQUER coisa que altera o
 * encaixe — passageiros, paradas, escolas (visitadas ou aceitas), horários,
 * antecipação, veículo, lugares, reservas ou monitor. É um resumo opaco (não
 * revela dado nenhum): serve só para saber que uma avaliação antiga não vale
 * mais e precisa ser refeita.
 */
export function versaoDaAvaliacao(rota: Rota, veiculo: Veiculo | null): string {
  const n = (v: number | null | undefined) => (v == null ? '' : String(v));
  const partes = [
    rota.id, rota.sentido, rota.turno ?? '', rota.status, rota.veiculoId ?? '', veiculo ? String(veiculo.lugaresPassageiro) : 'sem-van',
    rota.monitor ? 1 : 0, rota.monitorOcupaLugar ? 1 : 0, rota.lugaresReservados,
    n(rota.saidaHabitualMin), n(rota.limiteAntecipacaoMin), n(rota.ultimoDesembarqueMin), rota.disponibilidadeRevisada ? 1 : 0,
    ...[...rota.paradas].sort((a, b) => a.ordem - b.ordem).map((p) =>
      [p.id, p.tipo, n(p.lat), n(p.lng), p.destinoId ?? '', n(p.horarioChegadaMin), n(p.limiteChegadaMin), n(p.aberturaMin), n(p.liberacaoMin), n(p.atendimentoGrupoMin)].join(',')),
    ...[...rota.passageiros].sort((a, b) => (a.id < b.id ? -1 : 1)).map((x) =>
      [x.id, x.embarqueParadaId ?? '', x.desembarqueParadaId ?? '', n(x.horarioHabitualMin), n(x.ajusteAntesMin), n(x.ajusteDepoisMin), n(x.atendimentoMin)].join(',')),
    ...[...(rota.escolasDisponiveis ?? [])].sort((a, b) => (a.destinoId < b.destinoId ? -1 : 1)).map((e) =>
      [e.destinoId, n(e.portaoLat), n(e.portaoLng), n(e.limiteChegadaMin), n(e.aberturaMin), n(e.liberacaoMin), n(e.atendimentoGrupoMin)].join(',')),
  ];
  return resumo(partes.join('|'));
}

/** Resumo curto e determinístico de um texto (FNV-1a de 64 bits em duas metades). Não é criptografia. */
export function resumo(texto: string): string {
  let a = 0x811c9dc5, b = 0x01000193;
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x85ebca6b) ^ (a >>> 13);
  }
  return (a >>> 0).toString(36) + (b >>> 0).toString(36);
}

export interface ResultadoBuscaReal {
  resultados: ResultadoRotaReal[];
  totalRotasAvaliadas: number;
  resumo: ResumoBusca;
  /** Candidatas cuja avaliação ficou INCONCLUSIVA (falta de dado, van, trecho,
   *  busca não concluída). Não são "sem vaga": a interface deve dizer isso. */
  inconclusivas: number;
}

/** Turnos incompatíveis na IDA: ambos informados, diferentes e nenhum integral.
 *  (Na volta o turno cadastrado é ambíguo — a volta da manhã acontece ao
 *  meio-dia —, então lá quem decide é o horário da escola, não o rótulo.) */
function turnoIncompativel(rota: Rota, pedido: PedidoFamilia): boolean {
  if (pedido.sentido !== 'ida' || !pedido.turno || !rota.turno) return false;
  if (pedido.turno === 'integral' || rota.turno === 'integral') return false;
  return pedido.turno !== rota.turno;
}

/**
 * Recorte das CANDIDATAS, nesta ordem: mesmo sentido; turno compatível; van
 * com lugar para aluno; que já ATENDEM a escola (Tier A) OU passam PERTO dela
 * (Tier B). Não prova encaixe — só evita avaliar à toa. Rota sem van cadastrada
 * continua candidata (sai como inconclusiva, não some em silêncio); vaga por
 * trecho é decidida pelo motor, nunca pelo pico de ocupação.
 */
export function candidatasParaBusca(entradas: EntradaBuscaReal[], pedido: PedidoFamilia): EntradaBuscaReal[] {
  return entradas.filter((e) => {
    if (e.rota.sentido !== pedido.sentido) return false;
    if (turnoIncompativel(e.rota, pedido)) return false;
    if (e.veiculo && capacidadeAlunos(e.rota, e.veiculo) < 1) return false; // van sem lugar para aluno
    // Já visita a escola, ou a aceita explicitamente (autorização que nenhum
    // raio aproximado elimina), ou — só em cadastro antigo — passa perto dela.
    return origemDaEscola(e.rota, pedido) !== null;
  });
}

/**
 * §6.3 — ordenação pela MELHOR EXPERIÊNCIA DO NOVO ALUNO, nesta ordem:
 * 1) status (compatível antes de "sob confirmação");
 * 2) MENOR TEMPO A BORDO do novo aluno (experiência de deslocamento do
 *    aluno) — NÃO confundir com o desvio do motorista;
 * 3) MENOR DESVIO/impacto necessário para o encaixe (desempate);
 * 4) rota que já ATENDE a escola (Tier A) antes de proximidade (Tier B);
 * 5) coleta mais cedo em casa.
 */
export function compararResultados(a: ResultadoRotaReal, b: ResultadoRotaReal): number {
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
}

/**
 * Avalia o pedido da família contra uma lista de rotas reais JÁ ELEGÍVEIS.
 * Para cada candidata (ver `candidatasParaBusca`) o motor PROVA o encaixe
 * (nunca "compatível" só por vaga ou proximidade) usando a `matriz` informada
 * — obrigatória; com matriz de estimativa o teto é "sob confirmação".
 * Saída ordenada (ver `compararResultados`) e sem PII.
 */
export function buscarEmRotasReais(
  entradas: EntradaBuscaReal[],
  pedido: PedidoFamilia,
  matriz: MatrizViaria,
): ResultadoBuscaReal {
  const candidatas = candidatasParaBusca(entradas, pedido);
  const resultados = candidatas
    .map((e) => avaliarRotaSegura(e.rota, e.veiculo, pedido, matriz))
    .sort(compararResultados);
  return { resultados, totalRotasAvaliadas: candidatas.length, inconclusivas: contarInconclusivas(resultados), resumo: resumirResultados(resultados, candidatas.length) };
}

export const contarInconclusivas = (r: ResultadoRotaReal[]): number => r.filter((x) => x.status === 'indeterminado').length;

/** Avalia uma rota sem deixar a falha dela derrubar as demais: um erro
 *  inesperado vira "avaliação incompleta" SÓ desta rota. */
export function avaliarRotaSegura(rota: Rota, veiculo: Veiculo | null, pedido: PedidoFamilia, matriz: MatrizViaria): ResultadoRotaReal {
  try {
    return avaliarRotaReal(rota, veiculo, pedido, matriz);
  } catch {
    return resultadoPendente(rota, pedido, 'A avaliação desta rota falhou e não foi concluída — isso não significa que não cabe.', 'busca_incompleta', matrizEhEstimativa(matriz));
  }
}

/** Resultado "avaliação incompleta" de uma rota que não chegou a ser calculada. */
export function resultadoPendente(rota: Rota, pedido: PedidoFamilia, motivo: string, codigo: CodigoMotivo, temposEstimados = false): ResultadoRotaReal {
  const atendeEscola = rotaAtendeDestino(rota, pedido.destinoId);
  return {
    rotaId: rota.id, sentido: rota.sentido, status: 'indeterminado', pendencia: 'avaliacao_incompleta', vagas: null,
    atendeEscola, origemEscola: origemDaEscola(rota, pedido) ?? (atendeEscola ? 'visita' : 'proximidade'),
    desvioMin: null, passagemCasaMin: null, horarioEscolaMin: null, minutosABordo: null,
    fonteHorario: 'nenhuma', motivo, codigos: [codigo], temposEstimados,
  };
}

/** Contagem por categoria — é o que separa "não há oferta", "não cabe",
 *  "faltam dados" e "ainda não calculado" para quem exibe. */
export interface ResumoBusca {
  /** Rotas do sentido que visitam/aceitam a escola (0 = AUSÊNCIA DE OFERTA). */
  candidatas: number;
  compativeis: number;
  sobConfirmacao: number;
  /** Comprovadamente não cabem (dados completos, tempos reais). */
  incompativeis: number;
  dadosInsuficientes: number;
  avaliacaoIncompleta: number;
}

export function resumirResultados(resultados: ResultadoRotaReal[], candidatas = resultados.length): ResumoBusca {
  const n = (f: (r: ResultadoRotaReal) => boolean) => resultados.filter(f).length;
  return {
    candidatas,
    compativeis: n((r) => r.status === 'compativel'),
    sobConfirmacao: n((r) => r.status === 'sob_confirmacao'),
    incompativeis: n((r) => r.status === 'incompativel'),
    dadosInsuficientes: n((r) => r.status === 'indeterminado' && r.pendencia !== 'avaliacao_incompleta'),
    avaliacaoIncompleta: n((r) => r.status === 'indeterminado' && r.pendencia === 'avaliacao_incompleta'),
  };
}
