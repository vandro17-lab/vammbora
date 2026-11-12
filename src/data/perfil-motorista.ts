import { supabase, USE_SUPABASE, DEMO_MOTORISTA } from '@/lib/supabase';
import { normalizarWhatsapp, type RascunhoPerfil, type SituacaoPublicacao } from '@/lib/perfil-motorista';
import { listarRotas, listarVeiculos } from '@/data/motorista-store';

/**
 * Acesso ao PERFIL PROFISSIONAL do motorista logado.
 *
 * - Banco real: RPCs da migração 20261112220000 (`meu_perfil_motorista`,
 *   `salvar_perfil_motorista`, `publicar_perfil_motorista`). O servidor só lê
 *   e grava o perfil DA PRÓPRIA conta; nunca recebe um id de motorista do app.
 * - Sem Supabase ou no modo demonstração explícito: guarda no navegador.
 */
const USAR_BANCO = USE_SUPABASE && !DEMO_MOTORISTA;
const K_LOCAL = 'vambora.demo.perfil';

export interface PerfilMotorista extends SituacaoPublicacao {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  cidadeId: string;
  /** Número usado no botão "Conversar no WhatsApp" (null = não aceita). Privado. */
  whatsappContato: string | null;
  /** true = guardado só neste navegador (sem servidor). */
  local: boolean;
}

interface LinhaPerfil {
  id: string; slug: string; nome: string; descricao: string | null; cidade_id: string;
  whatsapp_contato: string | null; anuncio_ativo: boolean; suspenso: boolean;
  rota_concluida_com_van?: boolean; visivel?: boolean;
}

export function mapPerfil(l: LinhaPerfil): PerfilMotorista {
  return {
    id: l.id, slug: l.slug, nome: l.nome, descricao: l.descricao ?? null, cidadeId: l.cidade_id,
    whatsappContato: l.whatsapp_contato ?? null,
    temPerfil: true, anuncioAtivo: !!l.anuncio_ativo, suspenso: !!l.suspenso,
    rotaConcluidaComVan: !!l.rota_concluida_com_van, visivel: !!l.visivel, local: false,
  };
}

/** Erro do servidor → mensagem compreensível, sem esconder o motivo real. */
export function erroDoPerfil(e: { code?: string; message?: string }): Error {
  const real = e.message || 'erro desconhecido';
  if (e.code === 'PGRST202' || e.code === '42883') {
    return new Error('O cadastro do perfil profissional ainda não foi liberado no servidor. Tente de novo mais tarde.');
  }
  if (e.code === '42501') return new Error('Sua sessão expirou. Entre de novo na sua conta.');
  if (e.code === '22023' || e.code === 'P0002') return new Error(real); // mensagens já em português
  if (e.code === '23505') return new Error('Você já tem um perfil profissional. Abra Meu perfil para editar.');
  if (/fetch|network/i.test(real)) return new Error('Sem conexão com o servidor. Verifique a internet e tente de novo.');
  return new Error(real);
}

/* ------------------------------ modo local ------------------------------ */
function lerLocal(): PerfilMotorista | null {
  try {
    const raw = localStorage.getItem(K_LOCAL);
    return raw ? (JSON.parse(raw) as PerfilMotorista) : null;
  } catch { return null; }
}
function gravarLocal(p: PerfilMotorista): void {
  try { localStorage.setItem(K_LOCAL, JSON.stringify(p)); } catch { /* armazenamento indisponível */ }
}
async function rotaConcluidaComVanLocal(): Promise<boolean> {
  const [rotas, vans] = await Promise.all([listarRotas(), listarVeiculos()]);
  const ids = new Set(vans.map((v) => v.id));
  return rotas.some((r) => r.status === 'concluida' && !!r.veiculoId && ids.has(r.veiculoId));
}

/* ------------------------------- leituras ------------------------------- */
export async function obterMeuPerfil(): Promise<PerfilMotorista | null> {
  if (USAR_BANCO && supabase) {
    const { data, error } = await supabase.rpc('meu_perfil_motorista');
    if (error) throw erroDoPerfil(error);
    return data ? mapPerfil(data as LinhaPerfil) : null;
  }
  const p = lerLocal();
  if (!p) return null;
  const rota = await rotaConcluidaComVanLocal();
  // Sem servidor não existe vitrine pública: nunca "visível".
  return { ...p, rotaConcluidaComVan: rota, visivel: false, local: true };
}

/* ------------------------------- escritas ------------------------------- */
export async function salvarMeuPerfil(r: RascunhoPerfil): Promise<PerfilMotorista> {
  const whatsapp = r.aceitaWhatsapp ? normalizarWhatsapp(r.whatsapp) : null;
  if (r.aceitaWhatsapp && !whatsapp) throw new Error('Confira o WhatsApp: DDD e número de celular, como (18) 99999-0000.');
  const descricao = r.apresentacao.trim() || null;
  if (USAR_BANCO && supabase) {
    const { data, error } = await supabase.rpc('salvar_perfil_motorista', {
      p_nome: r.nome.trim(), p_descricao: descricao, p_city_id: r.cidadeId, p_whatsapp_contato: whatsapp,
    });
    if (error) throw erroDoPerfil(error);
    if (!data) throw new Error('O servidor não confirmou a gravação do perfil. Tente de novo.');
    // A situação (rota concluída, visibilidade) é relida do servidor.
    return (await obterMeuPerfil()) ?? mapPerfil(data as LinhaPerfil);
  }
  const atual = lerLocal();
  const novo: PerfilMotorista = {
    id: atual?.id ?? 'local', slug: atual?.slug ?? 'perfil-local',
    nome: r.nome.trim(), descricao, cidadeId: r.cidadeId, whatsappContato: whatsapp,
    temPerfil: true, anuncioAtivo: atual?.anuncioAtivo ?? false, suspenso: false,
    rotaConcluidaComVan: false, visivel: false, local: true,
  };
  gravarLocal(novo);
  return (await obterMeuPerfil()) ?? novo;
}

export async function publicarMeuPerfil(ativo: boolean): Promise<void> {
  if (USAR_BANCO && supabase) {
    const { error } = await supabase.rpc('publicar_perfil_motorista', { p_ativo: ativo });
    if (error) throw erroDoPerfil(error);
    return;
  }
  const atual = lerLocal();
  if (!atual) throw new Error('Crie seu perfil profissional antes de publicar.');
  gravarLocal({ ...atual, anuncioAtivo: ativo });
}
