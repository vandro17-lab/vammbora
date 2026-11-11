import { resumoDoContexto, type ContextoInteresse } from '@/lib/contexto-interesse';
import type {
  Destino,
  Motorista,
  Turno,
  TipoDestino,
  TipoPreco,
} from '@/types';
import { supabase, USE_SUPABASE } from '@/lib/supabase';
import { DESTINOS } from '@/data/destinos';
import { MOTORISTAS, MOTORISTAS_POR_SLUG } from '@/data/motoristas';

/**
 * Camada única de acesso a dados.
 *
 * Quando o Supabase NÃO está configurado (padrão da demo), devolve os dados de
 * exemplo locais. Quando ESTÁ configurado, lê do Supabase (vitrine pública via
 * view `public_listings`, sem telefone) e escreve via RPCs seguras.
 *
 * As telas podem migrar para estas funções sem saber qual fonte está ativa.
 */

/* ---------------------- Tipos de linha do banco ---------------------- */
interface LinhaListing {
  id: string;
  slug: string;
  name: string;
  photo_url: string | null;
  van_photo_url: string | null;
  description: string | null;
  city_id: string;
  neighborhoods: string[];
  turnos: Turno[];
  capacity_total: number;
  seats_available: number;
  feature_ac: boolean;
  feature_monitor: boolean;
  feature_seatbelt: boolean;
  feature_accessible: boolean;
  price_type: TipoPreco;
  price_month: number | string | null;
  price_daily: number | string | null;
  rating_avg: number | string;
  rating_count: number;
  boarding_time: string | null;
  tolerance_before_min: number;
  tolerance_after_min: number;
  doc_verified: boolean;
  is_demo: boolean;
  destination_ids: string[];
}

interface LinhaDestino {
  id: string;
  type: TipoDestino;
  name: string;
  neighborhood: string | null;
  city_id: string;
  inep_code: string | null;
  turnos: Turno[];
  source: string;
  lat: number | null;
  lng: number | null;
}

/* ---------------------- Mapeadores (banco -> domínio) ---------------------- */
const num = (v: number | string | null | undefined): number | undefined =>
  v === null || v === undefined ? undefined : Number(v);

function mapMotorista(r: LinhaListing): Motorista {
  return {
    id: r.id,
    slug: r.slug,
    nome: r.name,
    fotoUrl: r.photo_url ?? '',
    vanFotoUrl: r.van_photo_url ?? '',
    descricao: r.description ?? '',
    cidadeId: r.city_id,
    bairrosAtendidos: r.neighborhoods ?? [],
    destinosIds: r.destination_ids ?? [],
    turnos: r.turnos ?? [],
    capacidadeTotal: r.capacity_total,
    vagasDisponiveis: r.seats_available,
    recursos: {
      arCondicionado: r.feature_ac,
      monitor: r.feature_monitor,
      cintoTresPontos: r.feature_seatbelt,
      acessibilidade: r.feature_accessible,
    },
    preco: { tipo: r.price_type, mensal: num(r.price_month), avulso: num(r.price_daily) },
    avaliacao: { media: Number(r.rating_avg), quantidade: r.rating_count },
    janela: {
      horario: r.boarding_time ?? '',
      toleranciaAntesMin: r.tolerance_before_min,
      toleranciaDepoisMin: r.tolerance_after_min,
    },
    documentacaoVerificada: r.doc_verified,
    // A view pública NÃO expõe telefone. Ele é obtido por RPC ao solicitar contato.
    whatsapp: '',
    demo: r.is_demo,
  };
}

function mapDestino(r: LinhaDestino): Destino {
  return {
    id: r.id,
    tipo: r.type,
    nome: r.name,
    bairro: r.neighborhood ?? '',
    cidadeId: r.city_id,
    codigoInep: r.inep_code,
    turnos: r.turnos ?? [],
    fonte: r.source,
    lat: r.lat ?? 0,
    lng: r.lng ?? 0,
  };
}

/* ---------------------------- Leituras ----------------------------
 * HONESTIDADE: com o Supabase ATIVO, uma falha de consulta LANÇA erro — nunca
 * substitui silenciosamente por dados de demonstração. Só o modo demo (sem
 * Supabase) devolve os dados de exemplo locais. Quem chama decide como mostrar
 * (carregando / vazio / erro-com-tentar-de-novo / demonstração).
 */
export const MODO_DEMO = !USE_SUPABASE;

export async function listarDestinos(): Promise<Destino[]> {
  if (!USE_SUPABASE || !supabase) return DESTINOS;
  const { data, error } = await supabase
    .from('destinations')
    .select('*')
    .eq('is_published', true)
    .order('name');
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapDestino(r as LinhaDestino));
}

export async function listarMotoristas(): Promise<Motorista[]> {
  if (!USE_SUPABASE || !supabase) return MOTORISTAS;
  const { data, error } = await supabase.from('public_listings').select('*');
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapMotorista(r as unknown as LinhaListing));
}

export async function obterMotoristaPorSlug(slug: string): Promise<Motorista | null> {
  if (!USE_SUPABASE || !supabase) return MOTORISTAS_POR_SLUG[slug] ?? null;
  const { data, error } = await supabase
    .from('public_listings')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapMotorista(data as unknown as LinhaListing) : null;
}

/* ---------------------------- Escritas (RPCs seguras) ---------------------------- */
export interface InteressePayload {
  cidadeId: string;
  nome: string;
  whatsapp: string;
  consentimento: boolean;
  regiao?: string;
  destinoId?: string | null;
  turno?: Turno | null;
  /** O que foi buscado e, se houver, a rota e as condições do encaixe (sem
   *  endereço da família e sem dado de terceiros). */
  contexto?: ContextoInteresse | null;
}

export async function registrarInteresse(
  p: InteressePayload,
): Promise<{ ok: boolean; id?: string; erro?: string; demo?: boolean; contexto?: 'completo' | 'resumido' | 'nenhum' }> {
  if (!USE_SUPABASE || !supabase) {
    // Modo demo: NÃO há servidor; o envio é apenas simulado (não gravado).
    return { ok: true, demo: true };
  }
  const contexto = p.contexto ?? null;
  if (contexto) {
    // Com a migração 0017: o contexto vai no campo próprio (e a rota fica ligada ao pedido).
    const v2 = await supabase.rpc('registrar_interesse_v2', {
      p_city_id: p.cidadeId, p_contact_name: p.nome, p_contact_whatsapp: p.whatsapp, p_consent: p.consentimento,
      p_region: p.regiao ?? null, p_destination_id: p.destinoId ?? null, p_turno: p.turno ?? null, p_context: contexto,
    });
    if (!v2.error) return { ok: true, id: v2.data as string, contexto: 'completo' };
    // Função ainda não existe no banco: cai no formato anterior, levando um
    // RESUMO do contexto junto da região (para o sentido e o horário não se perderem).
    if (!['PGRST202', '42883'].includes(String(v2.error.code))) return { ok: false, erro: v2.error.message };
  }
  const regiao = contexto ? `${p.regiao ? p.regiao + ' ' : ''}${resumoDoContexto(contexto)}` : p.regiao ?? null;
  const { data, error } = await supabase.rpc('registrar_interesse', {
    p_city_id: p.cidadeId,
    p_contact_name: p.nome,
    p_contact_whatsapp: p.whatsapp,
    p_consent: p.consentimento,
    p_region: regiao,
    p_destination_id: p.destinoId ?? null,
    p_turno: p.turno ?? null,
  });
  if (error) return { ok: false, erro: error.message };
  return { ok: true, id: data as string, contexto: contexto ? 'resumido' : 'nenhum' };
}

export interface ContatoPayload {
  destinoId?: string | null;
  turno?: Turno | null;
  contratacao?: string | null;
  regiao?: string | null;
}

/** Registra o lead e devolve o WhatsApp do motorista. Em modo demo usa o telefone local. */
export async function solicitarContatoWhatsapp(
  slug: string,
  consentimento: boolean,
  extra: ContatoPayload = {},
): Promise<string | null> {
  if (!USE_SUPABASE || !supabase) {
    return MOTORISTAS_POR_SLUG[slug]?.whatsapp ?? null;
  }
  const { data, error } = await supabase.rpc('solicitar_contato_whatsapp', {
    p_slug: slug,
    p_consent: consentimento,
    p_destination_id: extra.destinoId ?? null,
    p_turno: extra.turno ?? null,
    p_contratacao: extra.contratacao ?? null,
    p_region: extra.regiao ?? null,
  });
  if (error || !data) return null;
  return data as string;
}

/* ============================ ÁREA ADMIN ============================ */
/* Requerem Supabase configurado + usuário com papel admin (RLS cuida disso). */

export interface MotoristaAdmin {
  id: string;
  slug: string;
  name: string;
  city_id: string;
  seats_available: number;
  capacity_total: number;
  is_published: boolean;
  is_suspended: boolean;
  doc_verified: boolean;
  is_demo: boolean;
  rating_avg: number;
  whatsapp: string | null;
}

export interface InteressadoAdmin {
  id: string;
  contact_name: string;
  contact_whatsapp: string;
  region: string | null;
  turno: Turno | null;
  destination_id: string | null;
  created_at: string;
}

export async function adminListarMotoristas(): Promise<MotoristaAdmin[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('drivers')
    .select(
      'id,slug,name,city_id,seats_available,capacity_total,is_published,is_suspended,doc_verified,is_demo,rating_avg,whatsapp',
    )
    .order('name');
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as MotoristaAdmin[];
}

export async function adminAtualizarMotorista(
  id: string,
  patch: Partial<Pick<MotoristaAdmin, 'is_published' | 'is_suspended' | 'seats_available'>>,
): Promise<{ ok: boolean; erro?: string }> {
  if (!supabase) return { ok: false, erro: 'Banco não configurado.' };
  const { error } = await supabase.from('drivers').update(patch).eq('id', id);
  return error ? { ok: false, erro: error.message } : { ok: true };
}

export async function adminListarInteressados(): Promise<InteressadoAdmin[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('waitlist_requests')
    .select('id,contact_name,contact_whatsapp,region,turno,destination_id,created_at')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as InteressadoAdmin[];
}
