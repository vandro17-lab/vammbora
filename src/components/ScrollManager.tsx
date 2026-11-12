import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { hashDeAutenticacao } from '@/lib/retorno-auth';

/**
 * Âncora da página a partir do hash. O retorno do login (`#access_token=…`,
 * `#error=…`) NÃO é âncora: usá-lo como seletor lançava erro e derrubava o app
 * inteiro (tela branca depois do login com o Google).
 */
export function elementoDaAncora(hash: string): Element | null {
  if (!hash || hashDeAutenticacao(hash)) return null;
  let id = hash.slice(1);
  try { id = decodeURIComponent(id); } catch { return null; }
  return id ? document.getElementById(id) : null;
}

/** Rola para o topo em troca de rota, ou para a âncora quando houver hash. */
export function ScrollManager() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    const el = elementoDaAncora(hash);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    window.scrollTo({ top: 0 });
  }, [pathname, hash]);

  return null;
}
