import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { buscaOverlay } from '@/lib/busca-overlay';
import { URL_BUSCA } from '@/lib/animacoes';

/**
 * Tela de BUSCA INTELIGENTE: reproduz a animação original
 * (/animacoes/vanbora-animacao.html, versão A, na velocidade e no loop dela)
 * enquanto a consulta real acontece. Montada uma única vez no App; quem abre e
 * fecha é o estado `buscaOverlay`.
 *
 * Com "reduzir movimento" ativo no dispositivo, a animação não é carregada:
 * fica só o aviso estático.
 */
export function SearchLoadingScreen() {
  const { aberta } = useSyncExternalStore(buscaOverlay.assinar, buscaOverlay.obter, buscaOverlay.obter);
  const reduzir = useReducedMotion();
  const { pathname } = useLocation();

  // Saiu da página de resultados com a tela aberta (ex.: botão Voltar): a busca
  // deixa de interessar — cancela e fecha, para a tela nunca ficar presa.
  const esteveNosResultados = useRef(false);
  useEffect(() => {
    if (!aberta) { esteveNosResultados.current = false; return; }
    if (pathname === '/resultados') esteveNosResultados.current = true;
    else if (esteveNosResultados.current) buscaOverlay.cancelar();
  }, [aberta, pathname]);

  useEffect(() => {
    if (!aberta) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = anterior; };
  }, [aberta]);

  return createPortal(
    <AnimatePresence>
      {aberta && (
        <motion.div
          key="busca-inteligente"
          data-testid="busca-overlay"
          className="fixed inset-0 z-[100] overflow-hidden bg-black text-white"
          role="dialog" aria-modal="true" aria-label="Buscando vans para o seu trajeto"
          initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduzir ? 0 : 0.3 }}
        >
          {!reduzir && (
            <iframe
              src={URL_BUSCA} title="" aria-hidden="true" tabIndex={-1}
              className="pointer-events-none absolute inset-0 h-full w-full border-0"
            />
          )}
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 bg-gradient-to-t from-black via-black/80 to-transparent px-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-16 text-center">
            <p role="status" aria-live="polite" className="text-sm font-medium tracking-wide text-white/90">
              Buscando vans compatíveis com o seu trajeto…
            </p>
            <button
              type="button" onClick={() => buscaOverlay.cancelar()}
              className="rounded-full px-5 py-2.5 text-sm font-semibold text-white/85 ring-1 ring-white/35 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Cancelar busca
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
