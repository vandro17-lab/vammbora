import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import {
  URL_ABERTURA, ABERTURA_EXIBIDA_S, ABERTURA_ESPERA_MAX_MS,
  tempoOriginalDaAbertura, opacidadeFundoAbertura,
} from '@/lib/animacoes';

const SESSION_KEY = 'vambora:opening:v1';
/** A partir daqui um toque (ou Espaço) pula a abertura. */
const DISMISS_GRACE = 900;

/** API que o arquivo original da abertura expõe na própria janela. */
interface JanelaAbertura extends Window { __ready?: boolean; renderAt?: (segundos: number) => void }

function primeiraEntrada(pathname: string) {
  if (pathname.startsWith('/admin')) return false;
  // Formulários de interesse e política: acesso direto, sem abertura animada.
  if (pathname.startsWith('/interesse') || pathname === '/privacidade') return false;
  try { return sessionStorage.getItem(SESSION_KEY) !== 'seen'; }
  catch { return true; }
}

/**
 * Abertura da marca: reproduz o arquivo ORIGINAL
 * (/animacoes/vanbora-abertura.html) uma única vez por sessão.
 *
 * O arquivo desenha qualquer instante por `renderAt(segundos)`; aqui só
 * conduzimos o relógio, comprimindo os 4,2 s originais em ~2,5 s (sem cortar o
 * logo nem o encerramento). A interface carrega normalmente por baixo — login
 * e dados não esperam a abertura — e, se a animação não ficar pronta a tempo
 * (ou o dispositivo pedir menos movimento), o app segue direto.
 */
export function StartupExperience({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const reduzir = useReducedMotion();
  const [aberto, setAberto] = useState(() => primeiraEntrada(pathname));
  const [podeDispensar, setPodeDispensar] = useState(false);
  // O arquivo, conduzido de fora, desenha a 1 px por px CSS; ampliamos o quadro
  // e reduzimos por escala para manter a nitidez em telas de alta densidade.
  const [dpr] = useState(() => (typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 3)));
  const conteudo = useRef<HTMLDivElement>(null);
  const dialogo = useRef<HTMLDivElement>(null);
  const fundo = useRef<HTMLDivElement>(null);
  const quadro = useRef<HTMLIFrameElement>(null);
  const focoAnterior = useRef<HTMLElement | null>(null);

  const fechar = useCallback(() => {
    try { sessionStorage.setItem(SESSION_KEY, 'seen'); } catch { /* Armazenamento privado pode estar bloqueado. */ }
    setAberto(false);
  }, []);

  // Relógio da abertura.
  useEffect(() => {
    if (!aberto) return;
    if (reduzir) { fechar(); return; }
    let vivo = true, raf = 0, inicio: number | null = null;
    const desistir = window.setTimeout(() => { if (inicio === null) fechar(); }, ABERTURA_ESPERA_MAX_MS);
    const liberar = window.setTimeout(() => setPodeDispensar(true), DISMISS_GRACE);
    const passo = (agora: number) => {
      if (!vivo) return;
      try {
        const w = quadro.current?.contentWindow as JanelaAbertura | null | undefined;
        if (w?.__ready && typeof w.renderAt === 'function') {
          if (inicio === null) inicio = agora;
          const decorrido = (agora - inicio) / 1000;
          const t = tempoOriginalDaAbertura(decorrido);
          w.renderAt(t);
          if (fundo.current) fundo.current.style.opacity = String(opacidadeFundoAbertura(t));
          if (decorrido >= ABERTURA_EXIBIDA_S) { fechar(); return; }
        }
      } catch { fechar(); return; }
      raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => { vivo = false; cancelAnimationFrame(raf); clearTimeout(desistir); clearTimeout(liberar); };
  }, [aberto, reduzir, fechar]);

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
        key="vambora-opening" data-testid="abertura" role="dialog" aria-modal="true" aria-label="Abertura do VanBora"
        className="fixed inset-0 z-[100] overflow-hidden outline-none"
        initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}
        onPointerDown={() => { if (podeDispensar) fechar(); }}
        onKeyDown={e => {
          if (e.code === 'Space' && podeDispensar) { e.preventDefault(); fechar(); }
          if (e.key === 'Tab') { e.preventDefault(); dialogo.current?.focus(); }
        }}
      >
        <div ref={fundo} className="absolute inset-0 bg-black" aria-hidden="true" />
        <iframe
          ref={quadro} src={URL_ABERTURA} title="" aria-hidden="true" tabIndex={-1}
          className="pointer-events-none absolute left-0 top-0 border-0"
          style={{ width: `${dpr * 100}%`, height: `${dpr * 100}%`, transform: `scale(${1 / dpr})`, transformOrigin: '0 0', background: 'transparent' }}
        />
        <h1 className="sr-only">VanBora</h1>
      </motion.div>}
    </AnimatePresence>
  </>;
}
