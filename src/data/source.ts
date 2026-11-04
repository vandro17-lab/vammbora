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

/* ---------------------------- Leituras ---------------------------- */
export async function listarDestinos(): Promise<Destino[]> {
  if (!USE_SUPABASE || !supabase) return DESTINOS;
  const { data, error } = await supabase
    .from('destinations')
    .select('*')
    .eq('is_published', true)
    .order('name');
  if (error || !data) return DESTINOS;
  return (data as LinhaDestino[]).map(mapDestino);
}

export async function listarMotoristas(): Promise<Motorista[]> {
  if (!USE_SUPABASE || !supabase) return MOTORISTAS;
  const { data, error } = await supabase.from('public_listings').select('*');
  if (error || !data) return MOTORISTAS;
  return (data as LinhaListing[]).map(mapMotorista);
}

export async function obterMotoristaPorSlug(slug: string): Promise<Motorista | null> {
  if (!USE_SUPABASE || !supabase) return MOTORISTAS_POR_SLUG[slug] ?? null;
  const { data, error } = await supabase
    .from('public_listings')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error || !data) return null;
  return mapMotorista(data as unknown as LinhaListing);
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
}

export async function registrarInteresse(
  p: InteressePayload,
): Promise<{ ok: boolean; id?: string; erro?: string }> {
  if (!USE_SUPABASE || !supabase) {
    // Modo demo: não há servidor; apenas confirma localmente.
    return { ok: true };
  }
  const { data, error } = await supabase.rpc('registrar_interesse', {
    p_city_id: p.cidadeId,
    p_contact_name: p.nome,
    p_contact_whatsapp: p.whatsapp,
    p_consent: p.consentimento,
    p_region: p.regiao ?? null,
    p_destination_id: p.destinoId ?? null,
    p_turno: p.turno ?? null,
  });
  if (error) return { ok: false, erro: error.message };
  return { ok: true, id: data as string };
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
