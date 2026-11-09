import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useVitrine } from '@/data/VitrineProvider';
import { OpeningScene } from '@/components/brand/OpeningScene';
import './startup.css';

const SESSION_KEY = 'vambora:opening:v1';
const MIN_DURATION = 2200;
/** A partir de quando um toque/clique/espaço pode pular a abertura (evita dispensar por engano no 1º instante). */
const DISMISS_GRACE = 700;

function primeiraEntrada(pathname: string) {
  if (pathname.startsWith('/admin')) return false;
  try { return sessionStorage.getItem(SESSION_KEY) !== 'seen'; }
  catch { return true; }
}

/** A abertura acompanha o carregamento, sem repetir na navegação da sessão. */
export function StartupExperience({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { carregando } = useVitrine();
  const reduzir = useReducedMotion();
  const [aberto, setAberto] = useState(() => primeiraEntrada(pathname));
  const [demorando, setDemorando] = useState(false);
  const [podeDispensar, setPodeDispensar] = useState(false);
  const conteudo = useRef<HTMLDivElement>(null);
  const dialogo = useRef<HTMLDivElement>(null);
  const focoAnterior = useRef<HTMLElement | null>(null);

  const fechar = useCallback(() => {
    try { sessionStorage.setItem(SESSION_KEY, 'seen'); } catch { /* Armazenamento privado pode estar bloqueado. */ }
    setAberto(false);
  }, []);

  // A abertura NÃO se fecha sozinha: aguarda o usuário apertar espaço (ou tocar)
  // para transicionar à tela principal. Os timers só controlam o texto de status
  // e liberam o gesto de dispensar após um pequeno intervalo de segurança.
  useEffect(() => {
    if (!aberto) return;
    const aviso = window.setTimeout(() => setDemorando(true), MIN_DURATION);
    const liberar = window.setTimeout(() => setPodeDispensar(true), reduzir ? 0 : DISMISS_GRACE);
    return () => { clearTimeout(aviso); clearTimeout(liberar); };
  }, [aberto, reduzir]);

  useEffect(() => {
    if (!aberto) return;
    focoAnterior.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (conteudo.current) conteudo.current.inert = true;
    dialogo.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = anterior;
      if (conteudo.current) conteudo.current.inert = false;
    };
  }, [aberto]);

  return <>
    <div ref={conteudo}>{children}</div>
    <AnimatePresence onExitComplete={() => {
      if (focoAnterior.current?.isConnected && focoAnterior.current !== document.body) focoAnterior.current.focus({ preventScroll: true });
      else document.getElementById('conteudo')?.focus({ preventScroll: true });
    }}>
      {aberto && <motion.div
        ref={dialogo} tabIndex={-1}
        key="vambora-opening" className="startup" role="dialog" aria-modal="true" aria-label="Boas-vindas ao Vambora"
        style={{ cursor: podeDispensar ? 'pointer' : 'default' }}
        initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduzir ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
        onPointerDown={() => { if (podeDispensar) fechar(); }}
        onKeyDown={e => {
          if (e.key === 'Escape') { fechar(); return; }
          // Espaço (ou Enter) leva à tela principal — é o gesto para "começar".
          if ((e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') && podeDispensar) { e.preventDefault(); fechar(); return; }
          if (e.key === 'Tab') { e.preventDefault(); dialogo.current?.focus(); }
        }}
      >
        <OpeningScene
          status={demorando && carregando ? 'Preparando suas opções…' : undefined}
          skip={<span className="startup-skip" aria-hidden="true" data-visivel={podeDispensar || undefined}>Aperte espaço para continuar</span>}
        />
      </motion.div>}
    </AnimatePresence>
  </>;
}
