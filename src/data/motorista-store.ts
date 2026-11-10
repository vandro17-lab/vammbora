import type { Rota, Veiculo, OrigemAtendimento } from '@/types/motorista';
import { supabase, USE_SUPABASE, DEMO_MOTORISTA } from '@/lib/supabase';

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

export const novoId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);

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
function erroDoBanco(e: { message?: string; code?: string }): Error {
  const real = e.message || 'erro desconhecido';
  const amigavel =
    e.code === '42501' ? 'Sem permissão para gravar esta van. Saia e entre de novo na sua conta.'
    : e.code === '23503' ? 'Seu cadastro de motorista ainda não está completo no servidor. Saia e entre de novo.'
    : e.code === '23514' ? 'Algum dado da van é inválido.'
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
    // Lê rotas + paradas + passageiros do dono (RLS cuida do escopo).
    const { data, error } = await supabase
      .from('routes')
      .select(
        'id,name,direction,turno,days,vehicle_id,monitor,monitor_ocupa_lugar,reserved_seats,last_dropoff_min,early_leave_limit_min,status,is_published,updated_at,' +
          'route_stops(id,ordem,type,label,lat,lng,confirmed,destination_id,leg_time_min,habitual_arrival_min),' +
          'route_passengers(id,identificacao,board_stop_id,alight_stop_id,destination_id,' +
          'horario_habitual_min,ajuste_antes_min,ajuste_depois_min,atendimento_min,atendimento_origem)',
      )
      // Esconde rotas de demonstração do painel do motorista real (RLS já limita ao dono).
      .eq('is_demo', false)
      .order('updated_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapRotaDoBanco);
  }
  return lsGet<Rota[]>(K_ROTAS, []);
}

export async function obterRota(id: string): Promise<Rota | null> {
  const todas = await listarRotas();
  return todas.find((r) => r.id === id) ?? null;
}

export async function salvarRota(rota: Rota): Promise<Rota> {
  const atualizada = { ...rota, atualizadoEm: new Date().toISOString() };
  if (USAR_BANCO_MOTORISTA && supabase) {
    // Salvamento transacional via RPC (criada na migração de rotas).
    const { data, error } = await supabase.rpc('salvar_rota_completa', {
      p_rota: rotaParaBanco(atualizada),
    });
    if (error) throw new Error(error.message);
    return { ...atualizada, id: (data as string) ?? atualizada.id };
  }
  const lista = lsGet<Rota[]>(K_ROTAS, []);
  const id = atualizada.id || novoId();
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
    if (error) throw new Error(error.message);
    return;
  }
  const lista = lsGet<Rota[]>(K_ROTAS, []).filter((r) => r.id !== id);
  lsSet(K_ROTAS, lista);
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
}
interface LinhaPax {
  id: string; identificacao: string; board_stop_id: string | null;
  alight_stop_id: string | null; destination_id: string | null;
  horario_habitual_min?: number | null; ajuste_antes_min?: number | null;
  ajuste_depois_min?: number | null; atendimento_min?: number | null;
  atendimento_origem?: string | null;
}
interface LinhaRota {
  id: string; name: string | null; direction: string; turno: string | null; days: string[] | null;
  vehicle_id: string | null; monitor: boolean; monitor_ocupa_lugar: boolean; reserved_seats: number;
  last_dropoff_min: number | null; early_leave_limit_min: number | null; status: string; updated_at: string;
  is_published?: boolean | null;
  route_stops: LinhaStop[]; route_passengers: LinhaPax[];
}

export function mapRotaDoBanco(r: unknown): Rota {
  const x = r as LinhaRota;
  return {
    id: x.id,
    nome: x.name ?? '',
    sentido: (x.direction as Rota['sentido']) ?? 'ida',
    turno: (x.turno as Rota['turno']) ?? null,
    dias: x.days ?? [],
    veiculoId: x.vehicle_id,
    monitor: x.monitor,
    monitorOcupaLugar: x.monitor_ocupa_lugar,
    lugaresReservados: x.reserved_seats,
    ultimoDesembarqueMin: x.last_dropoff_min,
    limiteAntecipacaoMin: x.early_leave_limit_min,
    status: (x.status as Rota['status']) ?? 'rascunho',
    isPublished: !!x.is_published,
    atualizadoEm: x.updated_at,
    paradas: (x.route_stops ?? [])
      .map((s) => ({
        id: s.id, ordem: s.ordem, tipo: s.type as 'saida' | 'casa' | 'escola',
        rotulo: s.label ?? '', lat: s.lat ?? undefined, lng: s.lng ?? undefined,
        confirmado: s.confirmed, destinoId: s.destination_id, tempoAteProximaMin: s.leg_time_min, horarioChegadaMin: s.habitual_arrival_min ?? null,
      }))
      .sort((a, b) => a.ordem - b.ordem),
    passageiros: (x.route_passengers ?? []).map((p) => ({
      id: p.id, identificacao: p.identificacao,
      embarqueParadaId: p.board_stop_id, desembarqueParadaId: p.alight_stop_id,
      destinoId: p.destination_id,
      horarioHabitualMin: p.horario_habitual_min ?? null,
      ajusteAntesMin: p.ajuste_antes_min ?? null,
      ajusteDepoisMin: p.ajuste_depois_min ?? null,
      atendimentoMin: p.atendimento_min ?? null,
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
    status: r.status,
    stops: r.paradas.map((p) => ({
      id: p.id, ordem: p.ordem, type: p.tipo, label: p.rotulo,
      lat: p.lat ?? null, lng: p.lng ?? null, confirmed: p.confirmado,
      destination_id: p.destinoId ?? null, leg_time_min: p.tempoAteProximaMin ?? null, habitual_arrival_min: p.horarioChegadaMin ?? null,
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
  };
}
