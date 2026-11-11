import type { Turno } from '@/types';
import type { EscolaDisponivel, ParadaRota, PassageiroRota, Rota, SentidoRota } from '@/types/motorista';
import { PARADA_ESCOLA_MIN } from '@/lib/tempos-parada';

/**
 * REGRAS DO CADASTRO DE ROTAS (puras, sem rede) — busca e encaixe, etapa 1.
 *
 * Princípio: `null`/ausente = NÃO INFORMADO; zero = informado como zero. Nada
 * aqui inventa horário, flexibilidade ou autorização para cadastro antigo: o
 * que falta aparece em `pendenciasDeRevisao`.
 */

export const DIAS_SEMANA = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const;
export const DIA_LABEL: Record<string, string> = { seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex', sab: 'Sáb', dom: 'Dom' };

/* ------------------------- números informados ------------------------- */

/** Texto de um campo numérico -> inteiro ≥ 0. Vazio = `null` (não informado); "0" = 0. */
export function inteiroInformado(texto: string, max = 999): number | null {
  const t = texto.trim();
  if (!/^\d+$/.test(t)) return null;
  return Math.min(max, Number(t));
}

/** Minuto do dia válido (0..1439) ou `null`. */
export const minutoDoDia = (v: number | null | undefined): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1439 ? Math.round(v) : null;

/** Duração em minutos com fração (0..max), 2 casas — ou `null`. Zero é zero. */
export function duracaoMin(v: number | null | undefined, max = 60): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return null;
  return Math.round(Math.min(max, v) * 100) / 100;
}

/** Minutos (com fração) -> partes inteiras para os campos "min" e "seg". */
export function partesDaDuracao(min: number | null | undefined): { min: string; seg: string } {
  if (typeof min !== 'number' || !Number.isFinite(min) || min < 0) return { min: '', seg: '' };
  const total = Math.round(min * 60);
  return { min: String(Math.floor(total / 60)), seg: String(total % 60) };
}

/** Campos "min" e "seg" -> minutos com fração. Os DOIS vazios = `null`
 *  (não informado); "0" e "0" = 0 (informado). */
export function duracaoDasPartes(min: string, seg: string, maxMin = 60): number | null {
  const m = inteiroInformado(min), s = inteiroInformado(seg);
  if (m == null && s == null) return null;
  return duracaoMin((m ?? 0) + Math.min(59, s ?? 0) / 60, maxMin);
}

/** "30 s", "1 min", "1 min 30 s"; `null` -> "não informado". */
export function textoDuracao(min: number | null | undefined): string {
  if (typeof min !== 'number' || !Number.isFinite(min) || min < 0) return 'não informado';
  const total = Math.round(min * 60), m = Math.floor(total / 60), s = total % 60;
  if (m === 0) return `${s} s`;
  return s === 0 ? `${m} min` : `${m} min ${s} s`;
}

/** Minuto do dia -> "HH:MM" (valor de <input type="time">); `null` -> "". */
export const horaDoCampo = (min: number | null | undefined): string =>
  min == null ? '' : `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** "HH:MM" -> minuto do dia; vazio/inválido -> `null`. */
export function minutosDoCampo(hora: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hora);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/* ------------------------- período escolar x sentido ------------------------- */

/**
 * Sugere o PERÍODO ESCOLAR a partir de um horário, levando em conta o sentido —
 * porque período e sentido são coisas diferentes: uma VOLTA ao meio-dia é do
 * período da MANHÃ; uma IDA ao meio-dia é do período da TARDE.
 *  - ida: `horarioMin` = chegada à escola;
 *  - volta: `horarioMin` = liberação/saída da escola.
 * Faixa ambígua ou horário ausente -> `null` (sem sugestão; o motorista escolhe).
 * É só sugestão: nunca substitui a confirmação do motorista.
 */
export function sugerirPeriodo(sentido: SentidoRota, horarioMin: number | null | undefined): Turno | null {
  const h = minutoDoDia(horarioMin);
  if (h == null) return null;
  const entre = (de: number, ate: number) => h >= de * 60 && h <= ate * 60;
  if (sentido === 'ida') {
    if (entre(5.5, 9.5)) return 'manha';
    if (entre(11.5, 14.5)) return 'tarde';
    if (entre(17.5, 20)) return 'noite';
    return null;
  }
  if (entre(10, 13.75)) return 'manha';
  if (entre(15, 19.5)) return 'tarde';
  if (h >= 20.5 * 60 || h <= 60) return 'noite';
  return null;
}

const emOrdem = (r: Pick<Rota, 'paradas'>) => [...r.paradas].sort((a, b) => a.ordem - b.ordem);

/**
 * Horário da visita a UMA escola, conforme o sentido: limite de chegada (ida)
 * ou liberação (volta). Cadastro antigo só tinha o horário habitual da parada,
 * que já era usado com esse papel — por isso ele segue valendo como recurso.
 */
export function horarioDaEscola(parada: ParadaRota, sentido: SentidoRota): number | null {
  const proprio = sentido === 'ida' ? parada.limiteChegadaMin : parada.liberacaoMin;
  return minutoDoDia(proprio) ?? minutoDoDia(parada.horarioChegadaMin);
}

/** Tempo parado numa visita à escola: o do grupo, se informado; senão o padrão. */
export const atendimentoGrupo = (parada: Pick<ParadaRota, 'atendimentoGrupoMin'>): number =>
  duracaoMin(parada.atendimentoGrupoMin) ?? PARADA_ESCOLA_MIN;

/** Horário que serve de base para SUGERIR o período desta rota (ou `null`). */
export function horarioReferenciaDoPeriodo(rota: Rota): number | null {
  const escolas = emOrdem(rota).filter((p) => p.tipo === 'escola');
  if (rota.sentido === 'ida') {
    for (const e of [...escolas].reverse()) { const h = horarioDaEscola(e, 'ida'); if (h != null) return h; }
    return minutoDoDia(rota.ultimoDesembarqueMin);
  }
  for (const e of escolas) { const h = horarioDaEscola(e, 'volta'); if (h != null) return h; }
  return minutoDoDia(rota.saidaHabitualMin);
}

/* ------------------------- escolas: no percurso x disponíveis ------------------------- */

/** IDs (catálogo) das escolas JÁ PRESENTES no percurso — as paradas de escola. */
export function escolasNoPercurso(rota: Pick<Rota, 'paradas'>): string[] {
  return [...new Set(emOrdem(rota).filter((p) => p.tipo === 'escola' && p.destinoId).map((p) => p.destinoId as string))];
}

/** Dias em que a escola disponível vale: os dela, limitados aos dias da rota. */
export function diasDaDisponibilidade(rota: Pick<Rota, 'dias'>, escola: Pick<EscolaDisponivel, 'dias'>): string[] {
  return escola.dias == null ? [...rota.dias] : rota.dias.filter((d) => escola.dias!.includes(d));
}

/**
 * Lista de escolas disponíveis coerente: só escolas com ID de catálogo, sem
 * repetição e sem as que já são parada (essas já estão "no percurso").
 * Não cria parada, não mexe em horários nem na ordem do percurso.
 */
export function normalizarEscolasDisponiveis(rota: Rota): EscolaDisponivel[] {
  const noPercurso = new Set(escolasNoPercurso(rota));
  const vistos = new Set<string>();
  const out: EscolaDisponivel[] = [];
  for (const e of rota.escolasDisponiveis ?? []) {
    if (!e.destinoId || noPercurso.has(e.destinoId) || vistos.has(e.destinoId)) continue;
    vistos.add(e.destinoId);
    const dias = Array.isArray(e.dias) ? DIAS_SEMANA.filter((d) => e.dias!.includes(d)) : null;
    const temPortao = typeof e.portaoLat === 'number' && typeof e.portaoLng === 'number' && Number.isFinite(e.portaoLat) && Number.isFinite(e.portaoLng);
    out.push({
      ...e, dias,
      portaoLat: temPortao ? e.portaoLat : null, portaoLng: temPortao ? e.portaoLng : null,
      limiteChegadaMin: minutoDoDia(e.limiteChegadaMin), liberacaoMin: minutoDoDia(e.liberacaoMin),
      aberturaMin: minutoDoDia(e.aberturaMin),
      atendimentoGrupoMin: duracaoMin(e.atendimentoGrupoMin),
    });
  }
  return out;
}

/* ------------------------- o que precisa de revisão ------------------------- */

export interface PendenciaRevisao {
  alvo: 'rota' | 'escola' | 'aluno';
  /** Id da parada/aluno/escola disponível, quando o alvo não é a rota. */
  id?: string;
  /** Nome amigável do alvo. */
  titulo: string;
  /** O que falta informar, em linguagem simples. */
  faltas: string[];
}

/**
 * O que ainda NÃO foi informado nesta rota. Usado para sinalizar cadastros
 * antigos (e novos incompletos) sem preencher nada por conta própria.
 * `nomeDaEscola` traduz o ID do catálogo no nome para exibição.
 */
export function pendenciasDeRevisao(rota: Rota, nomeDaEscola: (destinoId: string) => string | undefined = () => undefined): PendenciaRevisao[] {
  const out: PendenciaRevisao[] = [];
  const paradas = emOrdem(rota);
  const ida = rota.sentido === 'ida';

  const daRota: string[] = [];
  const saida = paradas.find((p) => p.tipo === 'saida');
  if (!saida) daRota.push('endereço de saída da van');
  else if (typeof saida.lat !== 'number' || typeof saida.lng !== 'number') daRota.push('ponto no mapa do endereço de saída');
  if (rota.saidaHabitualMin == null) daRota.push('horário habitual de saída');
  if (rota.limiteAntecipacaoMin == null) daRota.push('quanto você autoriza antecipar a saída (0 se não autoriza)');
  if (!rota.turno) daRota.push('período escolar');
  else if (!rota.periodoConfirmado) daRota.push('confirmação do período escolar');
  if (rota.dias.length === 0) daRota.push('dias da rota');
  if (rota.ultimoDesembarqueMin == null) daRota.push(ida ? 'limite do ponto final (deixar o último aluno até)' : 'limite do ponto final (última entrega até)');
  if (!rota.disponibilidadeRevisada) daRota.push('escolas que você aceita incluir nesta rota (ou confirmar que nenhuma)');
  if (daRota.length) out.push({ alvo: 'rota', titulo: 'Rota', faltas: daRota });

  for (const p of paradas.filter((x) => x.tipo === 'escola')) {
    const faltas: string[] = [];
    if (!p.destinoId) faltas.push('escolher a escola no catálogo');
    if (ida && p.limiteChegadaMin == null) faltas.push('limite de chegada');
    if (!ida && p.liberacaoMin == null) faltas.push('horário de liberação');
    if (p.atendimentoGrupoMin == null) faltas.push('tempo de atendimento do grupo');
    if (faltas.length) out.push({ alvo: 'escola', id: p.id, titulo: (p.destinoId && nomeDaEscola(p.destinoId)) || p.destinoNome || p.rotulo || 'Escola', faltas });
  }

  const porId = new Map(paradas.map((p) => [p.id, p]));
  for (const x of rota.passageiros) {
    const faltas: string[] = [];
    const casa = porId.get((ida ? x.embarqueParadaId : x.desembarqueParadaId) ?? '');
    if (!casa || casa.tipo !== 'casa') faltas.push('endereço');
    else if (typeof casa.lat !== 'number' || typeof casa.lng !== 'number') faltas.push('ponto no mapa do endereço');
    if (!escolaDoAluno(rota, x)) faltas.push('escola');
    if (x.horarioHabitualMin == null) faltas.push('horário habitual');
    if (x.ajusteAntesMin == null) faltas.push('flexibilidade para antes (0 se não tem)');
    if (x.ajusteDepoisMin == null) faltas.push('flexibilidade para depois (0 se não tem)');
    if (x.atendimentoMin == null) faltas.push('tempo de atendimento');
    if (faltas.length) out.push({ alvo: 'aluno', id: x.id, titulo: x.identificacao || 'Aluno', faltas });
  }

  for (const e of rota.escolasDisponiveis ?? []) {
    if (e.dias != null && diasDaDisponibilidade(rota, e).length === 0) {
      out.push({ alvo: 'escola', id: e.id, titulo: nomeDaEscola(e.destinoId) || e.destinoNome || 'Escola disponível', faltas: ['os dias aceitos não coincidem com os dias da rota'] });
    }
  }
  return out;
}

/** Total de itens faltando (para o selo "precisa de revisão"). */
export const totalDePendencias = (ps: PendenciaRevisao[]): number => ps.reduce((n, p) => n + p.faltas.length, 0);

/** ID (catálogo) da escola do aluno: o da parada de escola dele; senão o gravado. */
export function escolaDoAluno(rota: Pick<Rota, 'paradas' | 'sentido'>, aluno: PassageiroRota): string | null {
  const idParada = rota.sentido === 'ida' ? aluno.desembarqueParadaId : aluno.embarqueParadaId;
  const parada = rota.paradas.find((p) => p.id === idParada);
  return (parada?.tipo === 'escola' ? parada.destinoId : null) ?? aluno.destinoId ?? null;
}

/* ------------------------- duplicar ------------------------- */

/**
 * Cópia INDEPENDENTE de uma rota: novos ids (rota, paradas, alunos, escolas
 * disponíveis) com os vínculos reapontados e TODOS os dados preservados —
 * endereços, portões, IDs de escola, horários, flexibilidades (zero continua
 * zero, ausente continua ausente), disponibilidade e período. Nasce como
 * rascunho não publicado.
 */
export function copiarRota(rota: Rota, novoId: () => string): Rota {
  const idDe = new Map(rota.paradas.map((p) => [p.id, novoId()]));
  const nome = rota.nome.trim();
  return {
    ...rota,
    id: '', nome: nome ? `${nome} (cópia)` : 'Rota (cópia)', status: 'rascunho', isPublished: false,
    dias: [...rota.dias],
    paradas: rota.paradas.map((p) => ({ ...p, id: idDe.get(p.id)! })),
    passageiros: rota.passageiros.map((x) => ({
      ...x, id: novoId(),
      embarqueParadaId: x.embarqueParadaId ? idDe.get(x.embarqueParadaId) ?? null : null,
      desembarqueParadaId: x.desembarqueParadaId ? idDe.get(x.desembarqueParadaId) ?? null : null,
    })),
    escolasDisponiveis: (rota.escolasDisponiveis ?? []).map((e) => ({ ...e, id: novoId(), dias: e.dias ? [...e.dias] : null })),
    atualizadoEm: new Date().toISOString(),
  };
}
