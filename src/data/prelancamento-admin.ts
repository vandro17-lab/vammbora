/**
 * PRÉ-LANÇAMENTO — acesso ADMINISTRATIVO aos interessados (prelaunch_leads).
 *
 * Usa a sessão do administrador logado: o banco só devolve linhas quando
 * `public.is_admin()` é verdadeiro (RLS). Visitantes e usuários comuns recebem
 * lista vazia/erro de permissão — a proteção está no banco, não nesta tela.
 */
import { supabase } from '@/lib/supabase';
import type { Periodo, TipoInteresse, TipoTransporte } from '@/lib/interesse';

export type SituacaoInteressado = 'novo' | 'contatado' | 'convertido' | 'descartado';
export const SITUACOES: { valor: SituacaoInteressado; rotulo: string }[] = [
  { valor: 'novo', rotulo: 'Novo' },
  { valor: 'contatado', rotulo: 'Contatado' },
  { valor: 'convertido', rotulo: 'Convertido' },
  { valor: 'descartado', rotulo: 'Descartado' },
];
export const ROTULO_PERFIL: Record<TipoInteresse, string> = { motorista: 'Motorista', familia: 'Família' };
export const ROTULO_PERIODO: Record<Periodo, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };
export const ROTULO_TRANSPORTE: Record<TipoTransporte, string> = { ida: 'Ida', volta: 'Volta', ida_volta: 'Ida e volta' };

export interface InteressadoLancamento {
  id: string;
  lead_type: TipoInteresse;
  full_name: string;
  whatsapp_e164: string;
  email: string | null;
  street_address: string | null;
  address_number: string | null;
  neighborhood: string | null;
  address_complement: string | null;
  city: string | null;
  state: string | null;
  school_name: string | null;
  school_shift: Periodo | null;
  transport_direction: TipoTransporte | null;
  consent_at: string;
  privacy_policy_version: string;
  source: string;
  status: SituacaoInteressado;
  resubmitted_at: string | null;
  created_at: string;
}

const COLUNAS =
  'id,lead_type,full_name,whatsapp_e164,email,street_address,address_number,neighborhood,address_complement,city,state,school_name,school_shift,transport_direction,consent_at,privacy_policy_version,source,status,resubmitted_at,created_at';

export async function adminListarInteressadosLancamento(): Promise<InteressadoLancamento[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('prelaunch_leads').select(COLUNAS).order('created_at', { ascending: false }).limit(5000);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as InteressadoLancamento[];
}

export async function adminAtualizarSituacao(id: string, status: SituacaoInteressado): Promise<{ ok: boolean; erro?: string }> {
  if (!supabase) return { ok: false, erro: 'Banco não configurado.' };
  const { data, error } = await supabase.from('prelaunch_leads').update({ status }).eq('id', id).select('id');
  if (error) return { ok: false, erro: error.message };
  if (!data || data.length === 0) return { ok: false, erro: 'Sem permissão ou registro inexistente.' };
  return { ok: true };
}

/** Exclusão definitiva (pedido do titular — LGPD). */
export async function adminExcluirInteressado(id: string): Promise<{ ok: boolean; erro?: string }> {
  if (!supabase) return { ok: false, erro: 'Banco não configurado.' };
  const { data, error } = await supabase.from('prelaunch_leads').delete().eq('id', id).select('id');
  if (error) return { ok: false, erro: error.message };
  if (!data || data.length === 0) return { ok: false, erro: 'Sem permissão ou registro inexistente.' };
  return { ok: true };
}

/* ------------------------------- CSV ------------------------------- */

/** "+5518999998888" -> "(18) 99999-8888" */
export function formatarWhatsApp(e164: string): string {
  const d = e164.replace(/\D/g, '').replace(/^55/, '');
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : e164;
}

/**
 * Célula segura para planilhas: aspas escapadas e, em texto digitado pelo
 * público, neutraliza início de fórmula (=, +, -, @, tab) — evita "CSV injection".
 */
export function celulaCsv(valor: string | null | undefined, textoLivre = true): string {
  let v = valor ?? '';
  if (textoLivre && /^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return `"${v.replace(/"/g, '""')}"`;
}

export function gerarCsvInteressados(linhas: InteressadoLancamento[]): string {
  const cab = ['Perfil', 'Nome', 'WhatsApp', 'E-mail', 'Rua', 'Número', 'Bairro', 'Complemento', 'Cidade', 'UF', 'Escola', 'Período', 'Transporte', 'Situação', 'Inscrição', 'Reenviado em', 'Consentimento em', 'Versão da política', 'Origem'];
  const data = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '');
  const corpo = linhas.map((l) => [
    celulaCsv(ROTULO_PERFIL[l.lead_type], false),
    celulaCsv(l.full_name),
    celulaCsv(l.whatsapp_e164.replace(/^\+/, ''), false), // dígitos com DDI (pronto para wa.me)
    celulaCsv(l.email),
    celulaCsv(l.street_address), celulaCsv(l.address_number), celulaCsv(l.neighborhood), celulaCsv(l.address_complement),
    celulaCsv(l.city), celulaCsv(l.state),
    celulaCsv(l.school_name),
    celulaCsv(l.school_shift ? ROTULO_PERIODO[l.school_shift] : '', false),
    celulaCsv(l.transport_direction ? ROTULO_TRANSPORTE[l.transport_direction] : '', false),
    celulaCsv(SITUACOES.find((s) => s.valor === l.status)?.rotulo ?? l.status, false),
    celulaCsv(data(l.created_at), false), celulaCsv(data(l.resubmitted_at), false), celulaCsv(data(l.consent_at), false),
    celulaCsv(l.privacy_policy_version), celulaCsv(l.source),
  ].join(';'));
  // BOM + ";" : abre corretamente no Excel em português.
  return `﻿${[cab.map((c) => celulaCsv(c, false)).join(';'), ...corpo].join('\r\n')}\r\n`;
}
