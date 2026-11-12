/**
 * RETORNO DO LOGIN (Google ou link de e-mail) — regras puras e testáveis.
 *
 * O Supabase (fluxo implícito) devolve o resultado NA URL: sucesso como
 * `#access_token=…`, falha como `#error=…&error_description=…` (ou na query,
 * `?error=…`). Esse trecho NÃO é uma âncora da página e nunca pode ser usado
 * como seletor. Aqui ele é reconhecido, traduzido para uma mensagem simples e
 * retirado da URL.
 */

export interface RetornoAuth {
  /** 'sessao': voltou com a sessão; 'erro': o provedor ou o Supabase recusou. */
  tipo: 'sessao' | 'erro';
  codigo?: string;
  descricao?: string;
}

function parametros(trecho: string): URLSearchParams {
  return new URLSearchParams(trecho.replace(/^[#?]/, ''));
}

/** O `#…` é retorno de login (e não uma âncora da página)? */
export function hashDeAutenticacao(hash: string): boolean {
  if (!hash || hash === '#') return false;
  const p = parametros(hash);
  return p.has('access_token') || p.has('error') || p.has('error_description') || p.has('refresh_token');
}

/** Lê o retorno do login na URL; null quando a URL não é um retorno. */
export function lerRetornoAuth(href: string): RetornoAuth | null {
  let url: URL;
  try { url = new URL(href); } catch { return null; }
  const h = parametros(url.hash);
  const q = url.searchParams;
  const erro = h.get('error') ?? q.get('error');
  if (erro || h.get('error_description') || q.get('error_description')) {
    return {
      tipo: 'erro',
      codigo: (h.get('error_code') ?? q.get('error_code') ?? erro ?? undefined) || undefined,
      descricao: (h.get('error_description') ?? q.get('error_description') ?? undefined) || undefined,
    };
  }
  if (h.has('access_token')) return { tipo: 'sessao' };
  return null;
}

/** Mensagem compreensível para a pessoa (sem detalhes técnicos). */
export function mensagemErroLogin(r: RetornoAuth): string {
  const c = `${r.codigo ?? ''} ${r.descricao ?? ''}`.toLowerCase();
  if (/access_denied|cancel|denied/.test(c)) return 'O login com o Google foi cancelado. Você pode tentar de novo quando quiser.';
  if (/expired|otp_expired|invalid.*(link|token)|flow_state/.test(c)) return 'O link de acesso expirou ou já foi usado. Peça um novo e tente de novo.';
  if (/redirect|url/.test(c)) return 'O endereço de retorno do login não está autorizado. Avise o suporte do VanBora.';
  if (/database|saving new user|server_error|unexpected/.test(c)) return 'Não conseguimos concluir seu cadastro agora. Tente de novo em alguns minutos.';
  if (/email.*not.*confirm/.test(c)) return 'Confirme seu e-mail pelo link que enviamos e depois entre de novo.';
  return 'Não foi possível entrar. Tente de novo em instantes.';
}

/** A mesma URL sem os parâmetros de ERRO do login (os de sessão ficam para o Supabase). */
export function urlSemErroDeAuth(href: string): string {
  let url: URL;
  try { url = new URL(href); } catch { return href; }
  const limpar = (p: URLSearchParams) => {
    for (const k of ['error', 'error_code', 'error_description']) p.delete(k);
    return p;
  };
  url.search = limpar(url.searchParams).toString();
  url.hash = limpar(parametros(url.hash)).toString();
  return url.toString();
}
