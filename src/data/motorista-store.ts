import type { Rota, Veiculo, OrigemAtendimento, EscolaDisponivel } from '@/types/motorista';
import { supabase, USE_SUPABASE, DEMO_MOTORISTA } from '@/lib/supabase';
import { copiarRota, duracaoMin, normalizarEscolasDisponiveis } from '@/lib/cadastro-rota';

/**
 * Padrão: banco real (Supabase) sempre que ele estiver configurado. O
 * localStorage só é usado sem Supabase ou quando o modo demonstração do
 * motorista foi ligado EXPLICITAMENTE (VITE_DEMO_MOTORISTA="true").
 */
const USAR_BANCO_MOTORISTA = USE_SUPABASE && !DEMO_MOTORISTA;

/**
 * Armazenamento do motorista (veículos e rotas).
 * - Modo demonstração (sem Supabase): guarda no navegador (localStorage), para o
 *   painel e o construtor de rotas funcionarem de verdade sem backend.
 * - Com Supabase: grava nas tabelas reais (RLS garante que é só do dono).
 *
 * As gravações de rota são "tudo ou nada" no modo demo (um objeto por rota).
 * No Supabase, a rota + paradas + passageiros são salvas via RPC transacional
 * (ver observação em salvarRota).
 */

/** Sempre um UUID v4: o banco só aceita UUID como id de rota, parada e aluno.
 *  (`crypto.randomUUID` não existe em contexto não seguro/navegador antigo.) */
export const novoId = (): string => {
  const c = (globalThis as { crypto?: Partial<Crypto> }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  const b = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

/* --------------------------- localStorage (demo) --------------------------- */
const K_VEIC = 'vambora.demo.veiculos';
const K_ROTAS = 'vambora.demo.rotas';

function lsGet<T>(k: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function lsSet<T>(k: string, v: T): void {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* ignora cota/indisponível */
  }
}

/* ------------------------------- VEÍCULOS -------------------------------- */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COLUNAS_VEICULO = 'id,model,year,plate,seats_passenger,feature_ac,feature_accessible,feature_seatbelt,photo_urls';

interface LinhaVeiculo {
  id: string; model: string | null; year: number | null; plate: string | null; seats_passenger: number | null;
  feature_ac: boolean | null; feature_accessible: boolean | null; feature_seatbelt: boolean | null; photo_urls: string[] | null;
}

/** Linha do banco -> Veiculo do app. */
export function mapVeiculoDoBanco(r: LinhaVeiculo): Veiculo {
  return {
    id: r.id,
    modelo: r.model ?? '',
    ano: r.year ?? undefined,
    placa: r.plate ?? undefined,
    lugaresPassageiro: r.seats_passenger ?? 0,
    arCondicionado: !!r.feature_ac,
    acessivel: !!r.feature_accessible,
    cintos: !!r.feature_seatbelt,
    fotos: r.photo_urls ?? [],
  };
}

/** Veiculo do app -> colunas do banco (sem `id`; campos vazios viram NULL). */
export function veiculoParaBanco(v: Veiculo, ownerId: string) {
  const ano = typeof v.ano === 'number' && Number.isInteger(v.ano) && v.ano > 0 ? v.ano : null;
  return {
    owner_id: ownerId,
    model: v.modelo.trim(),
    year: ano,
    plate: v.placa?.trim() ? v.placa.trim().toUpperCase() : null,
    seats_passenger: v.lugaresPassageiro,
    feature_ac: !!v.arCondicionado,
    feature_accessible: !!v.acessivel,
    feature_seatbelt: !!v.cintos,
    photo_urls: v.fotos ?? [],
  };
}

/** Confere os campos antes de gravar. Devolve a mensagem do 1º problema, ou null. */
export function validarVeiculo(v: Veiculo): string | null {
  if (!v.modelo?.trim()) return 'Informe o modelo da van.';
  if (!Number.isInteger(v.lugaresPassageiro) || v.lugaresPassageiro < 1) return 'Informe quantos lugares para alunos a van tem (pelo menos 1).';
  if (v.lugaresPassageiro > 60) return 'Número de lugares acima do possível para uma van escolar.';
  if (v.ano != null && v.ano !== 0 && (!Number.isInteger(v.ano) || v.ano < 1980 || v.ano > new Date().getFullYear() + 1)) return 'Confira o ano da van.';
  return null;
}

/** Erro do banco -> mensagem compreensível, SEM esconder o motivo real. */
function erroDoBanco(e: { message?: string; code?: string }, oque: 'van' | 'rota' = 'van'): Error {
  const real = e.message || 'erro desconhecido';
  const amigavel =
    e.code === '42501' ? `Sem permissão para gravar esta ${oque}. Saia e entre de novo na sua conta.`
    : /autenticado/i.test(real) ? 'Sua sessão expirou. Entre de novo na sua conta.'
    : e.code === '23503' && /destination/i.test(real) ? 'Uma das escolas escolhidas não existe mais no cadastro. Remova a parada da escola e escolha de novo.'
    : e.code === '23503' && /vehicle/i.test(real) ? 'A van desta rota não existe mais. Escolha uma van cadastrada.'
    : e.code === '23503' ? 'Seu cadastro de motorista ainda não está completo no servidor. Saia e entre de novo.'
    : e.code === '23514' ? `Algum dado da ${oque} é inválido.`
    : e.code === '22P02' ? `Algum identificador da ${oque} é inválido.`
    : /fetch|network/i.test(real) ? 'Sem conexão com o servidor. Verifique a internet e tente de novo.'
    : null;
  return new Error(amigavel ? `${amigavel} (${real})` : real);
}

/** Id do usuário logado (sessão local; a RLS valida no servidor). */
async function usuarioLogadoId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

export async function listarVeiculos(): Promise<Veiculo[]> {
  if (USAR_BANCO_MOTORISTA && supabase) {
    const ownerId = await usuarioLogadoId();
    if (!ownerId) return []; // sem sessão não há "minhas vans"
    const { data, error } = await supabase
      .from('vehicles')
      .select(COLUNAS_VEICULO)
      // SÓ as vans do próprio motorista: a RLS também libera tudo para admin e
      // as vans de demonstração para leitura — sem este filtro elas apareceriam
      // (e poderiam ser editadas) como se fossem do usuário.
      .eq('owner_id', ownerId)
      .eq('is_demo', false)
      .order('created_at');
    if (error) throw erroDoBanco(error);
    return ((data ?? []) as unknown as LinhaVeiculo[]).map(mapVeiculoDoBanco);
  }
  return lsGet<Veiculo[]>(K_VEIC, []);
}

export async function salvarVeiculo(v: Veiculo): Promise<Veiculo> {
  const invalido = validarVeiculo(v);
  if (invalido) throw new Error(invalido);
  if (USAR_BANCO_MOTORISTA && supabase) {
    // owner_id é obrigatório (NOT NULL) e usado pela RLS: preenche com o usuário logado.
    const ownerId = await usuarioLogadoId();
    if (!ownerId) throw new Error('Faça login para salvar a van.');
    const payload = veiculoParaBanco(v, ownerId);
    // EDIÇÃO: atualiza a van existente DESTE motorista (nunca cria outra nem
    // assume a van de outra pessoa).
    if (UUID_RE.test(v.id)) {
      const { data, error } = await supabase
        .from('vehicles').update(payload).eq('id', v.id).eq('owner_id', ownerId).select(COLUNAS_VEICULO).maybeSingle();
      if (error) throw erroDoBanco(error);
      if (data) return mapVeiculoDoBanco(data as unknown as LinhaVeiculo);
    }
    // NOVA (ou id local/demonstrativo que não existe no banco): o Postgres gera o UUID.
    const { data, error } = await supabase.from('vehicles').insert(payload).select(COLUNAS_VEICULO).single();
    if (error) throw erroDoBanco(error);
    if (!data) throw new Error('O servidor não confirmou a gravação da van. Tente de novo.');
    return mapVeiculoDoBanco(data as unknown as LinhaVeiculo);
  }
  const lista = lsGet<Veiculo[]>(K_VEIC, []);
  const id = v.id || novoId();
  const novo = { ...v, id };
  const i = lista.findIndex((x) => x.id === id);
  if (i >= 0) lista[i] = novo;
  else lista.push(novo);
  lsSet(K_VEIC, lista);
  return novo;
}

/* -------------------------------- ROTAS ---------------------------------- */
export async function listarRotas(): Promise<Rota[]> {
  if (USAR_BANCO_MOTORISTA && supabase) {
    // Lê rotas + paradas + passageiros SÓ do motorista logado (a RLS também
    // libera rotas de demonstração e, para admin, as de todos).
    const ownerId = await usuarioLogadoId();
    if (!ownerId) return [];
    const ler = (colunas: string) => supabase!
      .from('routes').select(colunas)
      .eq('owner_id', ownerId)
      .eq('is_demo', false)
      .order('updated_at', { ascending: false });
    const faltaColuna = (e: unknown) => !!e && ['42703', '42P01', 'PGRST200', 'PGRST204'].includes(String((e as { code?: string }).code));
    // Abertura da escola (migração 0016): lida quando existir; sem ela, fica "não informada".
    let { data, error } = await ler(SELECT_ROTA_COM_ABERTURA);
    if (faltaColuna(error)) ({ data, error } = await ler(SELECT_ROTA));
    // Banco ainda sem a migração da etapa 1 (coluna/tabela nova inexistente):
    // lê só o que já existia. Os campos novos ficam "não informados".
    if (faltaColuna(error)) {
      console.warn('[rotas] banco sem a migração da etapa 1 — lendo o cadastro no formato anterior.');
      ({ data, error } = await ler(SELECT_ROTA_LEGADO));
    }
    if (error) throw erroDoBanco(error, 'rota');
    return (data ?? []).map(mapRotaDoBanco);
  }
  return lsGet<Rota[]>(K_ROTAS, []);
}

export async function obterRota(id: string): Promise<Rota | null> {
  const todas = await listarRotas();
  return todas.find((r) => r.id === id) ?? null;
}

const SELECT_ROTA_LEGADO =
  'id,name,direction,turno,days,vehicle_id,monitor,monitor_ocupa_lugar,reserved_seats,last_dropoff_min,early_leave_limit_min,status,is_published,updated_at,' +
  'route_stops(id,ordem,type,label,lat,lng,confirmed,destination_id,leg_time_min,habitual_arrival_min),' +
  'route_passengers(id,identificacao,board_stop_id,alight_stop_id,destination_id,' +
  'horario_habitual_min,ajuste_antes_min,ajuste_depois_min,atendimento_min,atendimento_origem)';
/** Etapa 1 da busca/encaixe: saída habitual, período confirmado, visita à
 *  escola (limite, liberação, tempo do grupo, portão) e escolas disponíveis. */
const SELECT_ROTA =
  'id,name,direction,turno,turno_confirmed,days,vehicle_id,monitor,monitor_ocupa_lugar,reserved_seats,last_dropoff_min,early_leave_limit_min,habitual_departure_min,availability_reviewed,status,is_published,updated_at,' +
  'route_stops(id,ordem,type,label,lat,lng,confirmed,destination_id,leg_time_min,habitual_arrival_min,arrival_deadline_min,release_time_min,group_service_min,gate_custom),' +
  'route_passengers(id,identificacao,board_stop_id,alight_stop_id,destination_id,' +
  'horario_habitual_min,ajuste_antes_min,ajuste_depois_min,atendimento_min,atendimento_origem),' +
  'route_school_availability(id,destination_id,days,gate_lat,gate_lng,arrival_deadline_min,release_time_min,group_service_min)';

/** + abertura do portão da escola (migração 0016). */
const SELECT_ROTA_COM_ABERTURA = SELECT_ROTA
  .replace('group_service_min,gate_custom)', 'group_service_min,gate_custom,opening_time_min)')
  .replace('release_time_min,group_service_min)', 'release_time_min,group_service_min,opening_time_min)');

const minutoDoDia = (v: number | null | undefined): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1439 ? Math.round(v) : null;
/** Inteiro de minutos 0..max; qualquer outra coisa = não informado. ZERO É ZERO. */
const minutosInteiros = (v: number | null | undefined, max: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(max, Math.round(v)) : null;

/**
 * Deixa a rota no formato que o banco aceita, SEM perder paradas nem alunos:
 *  - ids de parada/aluno que não são UUID (rotas antigas do navegador ou do
 *    cenário de exemplo) ganham um UUID, e os vínculos embarque/desembarque
 *    são reapontados para o novo id;
 *  - paradas são renumeradas 0..n-1 na ordem atual;
 *  - coordenadas e horários inválidos viram "não informado" (zero continua zero);
 *  - dados de visita à escola só existem em parada de escola;
 *  - escolas disponíveis: só do catálogo, sem repetir e sem as que já são parada.
 * A RPC apaga e recria paradas e alunos a cada salvamento — por isso a rota
 * enviada precisa estar sempre COMPLETA e coerente.
 */
export function normalizarRotaParaSalvar(rota: Rota): Rota {
  const idParada = new Map<string, string>();
  const paradas = [...rota.paradas].sort((a, b) => a.ordem - b.ordem).map((p, i) => {
    const id = UUID_RE.test(p.id) && ![...idParada.values()].includes(p.id) ? p.id : novoId();
    idParada.set(p.id, id);
    const temPonto = typeof p.lat === 'number' && typeof p.lng === 'number' && Number.isFinite(p.lat) && Number.isFinite(p.lng);
    return {
      ...p, id, ordem: i, rotulo: (p.rotulo ?? '').trim(),
      lat: temPonto ? p.lat : undefined, lng: temPonto ? p.lng : undefined,
      horarioChegadaMin: minutoDoDia(p.horarioChegadaMin),
      tempoAteProximaMin: typeof p.tempoAteProximaMin === 'number' && p.tempoAteProximaMin >= 0 ? Math.round(p.tempoAteProximaMin) : null,
      portaoEspecifico: p.tipo === 'escola' && temPonto && !!p.portaoEspecifico,
      limiteChegadaMin: p.tipo === 'escola' ? minutoDoDia(p.limiteChegadaMin) : null,
      aberturaMin: p.tipo === 'escola' ? minutoDoDia(p.aberturaMin) : null,
      liberacaoMin: p.tipo === 'escola' ? minutoDoDia(p.liberacaoMin) : null,
      atendimentoGrupoMin: p.tipo === 'escola' ? duracaoMin(p.atendimentoGrupoMin) : null,
    };
  });
  const vistos = new Set<string>();
  const passageiros = rota.passageiros.map((x) => {
    const id = UUID_RE.test(x.id) && !vistos.has(x.id) ? x.id : novoId();
    vistos.add(id);
    return {
      ...x, id, identificacao: (x.identificacao ?? '').trim(),
      embarqueParadaId: x.embarqueParadaId ? idParada.get(x.embarqueParadaId) ?? null : null,
      desembarqueParadaId: x.desembarqueParadaId ? idParada.get(x.desembarqueParadaId) ?? null : null,
      horarioHabitualMin: minutoDoDia(x.horarioHabitualMin),
      ajusteAntesMin: minutosInteiros(x.ajusteAntesMin, 120),
      ajusteDepoisMin: minutosInteiros(x.ajusteDepoisMin, 120),
      atendimentoMin: duracaoMin(x.atendimentoMin),
    };
  });
  const idsEscola = new Set<string>();
  const escolasDisponiveis: EscolaDisponivel[] = normalizarEscolasDisponiveis({ ...rota, paradas }).map((e) => {
    const id = UUID_RE.test(e.id) && !idsEscola.has(e.id) ? e.id : novoId();
    idsEscola.add(id);
    return { ...e, id };
  });
  return {
    ...rota, id: UUID_RE.test(rota.id) ? rota.id : '', paradas, passageiros, escolasDisponiveis,
    saidaHabitualMin: minutoDoDia(rota.saidaHabitualMin),
    periodoConfirmado: !!rota.turno && !!rota.periodoConfirmado,
    disponibilidadeRevisada: !!rota.disponibilidadeRevisada,
    ultimoDesembarqueMin: minutoDoDia(rota.ultimoDesembarqueMin),
    limiteAntecipacaoMin: typeof rota.limiteAntecipacaoMin === 'number' && rota.limiteAntecipacaoMin >= 0 ? Math.round(rota.limiteAntecipacaoMin) : null,
    lugaresReservados: Math.max(0, Math.round(rota.lugaresReservados || 0)),
  };
}

/** Problema que impediria a gravação, em linguagem simples; null = pode salvar. */
export function validarRotaParaSalvar(rota: Rota): string | null {
  if (rota.sentido !== 'ida' && rota.sentido !== 'volta') return 'Escolha se a rota é de ida ou de volta.';
  if (rota.veiculoId && !UUID_RE.test(rota.veiculoId)) return 'Escolha uma van cadastrada na sua conta (a van de exemplo não pode ser usada).';
  if (rota.status === 'concluida' && !rota.veiculoId) return 'Escolha a van desta rota.';
  // Toda escola vem do catálogo (o mesmo das famílias) e mantém o ID da unidade.
  if (rota.status === 'concluida' && rota.paradas.some((p) => p.tipo === 'escola' && !p.destinoId)) return 'Há uma parada de escola sem escola escolhida. Escolha a escola na lista do catálogo.';
  if ((rota.escolasDisponiveis ?? []).some((e) => !e.destinoId)) return 'Há uma escola disponível sem escola escolhida no catálogo.';
  const semEmbarque = rota.passageiros.find((x) => !x.embarqueParadaId);
  if (semEmbarque) return `O aluno "${semEmbarque.identificacao || 'sem nome'}" está sem parada de embarque.`;
  if (rota.passageiros.some((x) => !x.identificacao)) return 'Há um aluno sem identificação.';
  return null;
}

export async function salvarRota(rota: Rota): Promise<Rota> {
  const atualizada = { ...normalizarRotaParaSalvar(rota), atualizadoEm: new Date().toISOString() };
  if (USAR_BANCO_MOTORISTA && supabase) {
    const ownerId = await usuarioLogadoId();
    if (!ownerId) throw new Error('Faça login para salvar a rota.');
    const invalida = validarRotaParaSalvar(atualizada);
    if (invalida) throw new Error(invalida);
    // Rota com id que ainda não existe no banco (criada antes no navegador): a
    // RPC só ATUALIZA ids existentes — então entra como rota nova.
    if (atualizada.id) {
      const { data: existe, error: errE } = await supabase.from('routes').select('id').eq('id', atualizada.id).eq('owner_id', ownerId).maybeSingle();
      if (errE) throw erroDoBanco(errE, 'rota');
      if (!existe) atualizada.id = '';
    }
    // Salvamento transacional via RPC: rota + paradas + alunos, tudo ou nada.
    const { data, error } = await supabase.rpc('salvar_rota_completa', {
      p_rota: rotaParaBanco(atualizada),
    });
    if (error) throw erroDoBanco(error, 'rota');
    if (!data) throw new Error('O servidor não confirmou a gravação da rota. Tente de novo.');
    return { ...atualizada, id: data as string };
  }
  const lista = lsGet<Rota[]>(K_ROTAS, []);
  const id = rota.id || novoId(); // modo local: mantém o id que a rota já tinha
  const nova = { ...atualizada, id };
  const i = lista.findIndex((x) => x.id === id);
  if (i >= 0) lista[i] = nova;
  else lista.push(nova);
  lsSet(K_ROTAS, lista);
  return nova;
}

export async function excluirRota(id: string): Promise<void> {
  if (USAR_BANCO_MOTORISTA && supabase) {
    const { error } = await supabase.from('routes').delete().eq('id', id);
    if (error) throw erroDoBanco(error, 'rota');
    return;
  }
  const lista = lsGet<Rota[]>(K_ROTAS, []).filter((r) => r.id !== id);
  lsSet(K_ROTAS, lista);
}

/** Cópia independente de uma rota (ainda não salva): novos ids, mesmos dados. */
export function copiaDaRota(rota: Rota): Rota {
  return copiarRota(rota, novoId);
}

/** Duplica uma rota salva e grava a cópia como rascunho não publicado. */
export async function duplicarRota(id: string): Promise<Rota> {
  const original = await obterRota(id);
  if (!original) throw new Error('Rota não encontrada na sua conta.');
  return salvarRota(copiaDaRota(original));
}

/**
 * LISTA GERAL de escolas do motorista (perfil). Serve só para FACILITAR o
 * preenchimento das escolas disponíveis de uma rota: nada daqui autoriza rota
 * nenhuma sozinho — a escola só vale na rota em que o motorista a incluir.
 * Sem banco, sem cadastro ou em caso de erro: lista vazia (é só uma ajuda).
 */
export async function listarEscolasGeraisDoMotorista(): Promise<string[]> {
  if (!(USAR_BANCO_MOTORISTA && supabase)) return [];
  try {
    const ownerId = await usuarioLogadoId();
    if (!ownerId) return [];
    const { data, error } = await supabase.from('drivers').select('driver_destinations(destination_id)').eq('owner_id', ownerId).eq('is_demo', false);
    if (error) return [];
    const linhas = (data ?? []) as unknown as { driver_destinations: { destination_id: string }[] | null }[];
    return [...new Set(linhas.flatMap((d) => (d.driver_destinations ?? []).map((x) => x.destination_id)))];
  } catch {
    return [];
  }
}

/**
 * Publica/despublica uma rota na busca pública (ação explícita do motorista).
 * Atualização direta (RLS: o dono pode alterar sua própria rota) — NÃO passa
 * pelo RPC de salvamento, para não depender dele. No modo demo, grava local.
 */
export async function publicarRota(id: string, publicar: boolean): Promise<void> {
  if (USAR_BANCO_MOTORISTA && supabase) {
    const { error } = await supabase.from('routes').update({ is_published: publicar }).eq('id', id);
    if (error) throw new Error(error.message);
    return;
  }
  const lista = lsGet<Rota[]>(K_ROTAS, []).map((r) => (r.id === id ? { ...r, isPublished: publicar } : r));
  lsSet(K_ROTAS, lista);
}

/* ------------------------- mapeadores Supabase --------------------------- */
interface LinhaStop {
  id: string; ordem: number; type: string; label: string | null;
  lat: number | null; lng: number | null; confirmed: boolean; destination_id: string | null; leg_time_min: number | null; habitual_arrival_min?: number | null;
  arrival_deadline_min?: number | null; release_time_min?: number | null; group_service_min?: number | string | null; gate_custom?: boolean | null;
  opening_time_min?: number | null;
}
interface LinhaEscolaDisponivel {
  id: string; destination_id: string; days: string[] | null; gate_lat: number | null; gate_lng: number | null;
  arrival_deadline_min: number | null; release_time_min: number | null; group_service_min: number | string | null;
  opening_time_min?: number | null;
}
/** numeric do Postgres pode chegar como texto: vira número; NULL continua NULL. */
const numeroOuNulo = (v: number | string | null | undefined): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
interface LinhaPax {
  id: string; identificacao: string; board_stop_id: string | null;
  alight_stop_id: string | null; destination_id: string | null;
  horario_habitual_min?: number | null; ajuste_antes_min?: number | null;
  ajuste_depois_min?: number | null; atendimento_min?: number | string | null;
  atendimento_origem?: string | null;
}
interface LinhaRota {
  id: string; name: string | null; direction: string; turno: string | null; days: string[] | null;
  vehicle_id: string | null; monitor: boolean; monitor_ocupa_lugar: boolean; reserved_seats: number;
  last_dropoff_min: number | null; early_leave_limit_min: number | null; status: string; updated_at: string;
  is_published?: boolean | null;
  habitual_departure_min?: number | null; turno_confirmed?: boolean | null; availability_reviewed?: boolean | null;
  route_stops: LinhaStop[]; route_passengers: LinhaPax[]; route_school_availability?: LinhaEscolaDisponivel[] | null;
}

export function mapRotaDoBanco(r: unknown): Rota {
  const x = r as LinhaRota;
  return {
    id: x.id,
    nome: x.name ?? '',
    sentido: (x.direction as Rota['sentido']) ?? 'ida',
    turno: (x.turno as Rota['turno']) ?? null,
    periodoConfirmado: !!x.turno_confirmed,
    dias: x.days ?? [],
    veiculoId: x.vehicle_id,
    monitor: x.monitor,
    monitorOcupaLugar: x.monitor_ocupa_lugar,
    lugaresReservados: x.reserved_seats,
    ultimoDesembarqueMin: x.last_dropoff_min,
    saidaHabitualMin: x.habitual_departure_min ?? null,
    limiteAntecipacaoMin: x.early_leave_limit_min,
    disponibilidadeRevisada: !!x.availability_reviewed,
    escolasDisponiveis: (x.route_school_availability ?? []).map((e) => ({
      id: e.id, destinoId: e.destination_id, dias: e.days ?? null,
      portaoLat: e.gate_lat ?? null, portaoLng: e.gate_lng ?? null,
      limiteChegadaMin: e.arrival_deadline_min ?? null, liberacaoMin: e.release_time_min ?? null,
      atendimentoGrupoMin: numeroOuNulo(e.group_service_min), aberturaMin: e.opening_time_min ?? null,
    })),
    status: (x.status as Rota['status']) ?? 'rascunho',
    isPublished: !!x.is_published,
    atualizadoEm: x.updated_at,
    paradas: (x.route_stops ?? [])
      .map((s) => ({
        id: s.id, ordem: s.ordem, tipo: s.type as 'saida' | 'casa' | 'escola',
        rotulo: s.label ?? '', lat: s.lat ?? undefined, lng: s.lng ?? undefined,
        confirmado: s.confirmed, destinoId: s.destination_id, tempoAteProximaMin: s.leg_time_min, horarioChegadaMin: s.habitual_arrival_min ?? null,
        portaoEspecifico: !!s.gate_custom, limiteChegadaMin: s.arrival_deadline_min ?? null,
        liberacaoMin: s.release_time_min ?? null, atendimentoGrupoMin: numeroOuNulo(s.group_service_min),
        aberturaMin: s.opening_time_min ?? null,
      }))
      .sort((a, b) => a.ordem - b.ordem),
    passageiros: (x.route_passengers ?? []).map((p) => ({
      id: p.id, identificacao: p.identificacao,
      embarqueParadaId: p.board_stop_id, desembarqueParadaId: p.alight_stop_id,
      destinoId: p.destination_id,
      horarioHabitualMin: p.horario_habitual_min ?? null,
      ajusteAntesMin: p.ajuste_antes_min ?? null,
      ajusteDepoisMin: p.ajuste_depois_min ?? null,
      atendimentoMin: numeroOuNulo(p.atendimento_min),
      atendimentoOrigem: (p.atendimento_origem as OrigemAtendimento | null) ?? null,
    })),
  };
}

export function rotaParaBanco(r: Rota): unknown {
  return {
    id: r.id || null,
    name: r.nome,
    direction: r.sentido,
    turno: r.turno,
    days: r.dias,
    vehicle_id: r.veiculoId,
    monitor: r.monitor,
    monitor_ocupa_lugar: r.monitorOcupaLugar,
    reserved_seats: r.lugaresReservados,
    last_dropoff_min: r.ultimoDesembarqueMin,
    early_leave_limit_min: r.limiteAntecipacaoMin,
    habitual_departure_min: r.saidaHabitualMin ?? null,
    turno_confirmed: !!r.periodoConfirmado,
    availability_reviewed: !!r.disponibilidadeRevisada,
    status: r.status,
    stops: r.paradas.map((p) => ({
      id: p.id, ordem: p.ordem, type: p.tipo, label: p.rotulo,
      lat: p.lat ?? null, lng: p.lng ?? null, confirmed: p.confirmado,
      destination_id: p.destinoId ?? null, leg_time_min: p.tempoAteProximaMin ?? null, habitual_arrival_min: p.horarioChegadaMin ?? null,
      arrival_deadline_min: p.limiteChegadaMin ?? null, release_time_min: p.liberacaoMin ?? null,
      group_service_min: p.atendimentoGrupoMin ?? null, gate_custom: !!p.portaoEspecifico,
      // Só vai no payload quando informada: sem a migração 0016 a RPC a ignora,
      // e com ela "chave ausente" preserva o valor já gravado.
      ...(p.aberturaMin != null ? { opening_time_min: p.aberturaMin } : {}),
    })),
    passengers: r.passageiros.map((p) => ({
      id: p.id, identificacao: p.identificacao,
      board_stop_id: p.embarqueParadaId, alight_stop_id: p.desembarqueParadaId,
      destination_id: p.destinoId ?? null,
      horario_habitual_min: p.horarioHabitualMin ?? null,
      ajuste_antes_min: p.ajusteAntesMin ?? null,
      ajuste_depois_min: p.ajusteDepoisMin ?? null,
      atendimento_min: p.atendimentoMin ?? null,
      atendimento_origem: p.atendimentoOrigem ?? null,
    })),
    // Escolas que o motorista aceita incluir NESTA rota (não são paradas).
    school_availability: (r.escolasDisponiveis ?? []).map((e) => ({
      id: e.id, destination_id: e.destinoId, days: e.dias ?? null,
      gate_lat: e.portaoLat ?? null, gate_lng: e.portaoLng ?? null,
      arrival_deadline_min: e.limiteChegadaMin ?? null, release_time_min: e.liberacaoMin ?? null,
      group_service_min: e.atendimentoGrupoMin ?? null, opening_time_min: e.aberturaMin ?? null,
    })),
  };
}
