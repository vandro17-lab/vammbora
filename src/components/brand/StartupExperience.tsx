import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useVitrine } from '@/data/VitrineProvider';
import './startup.css';

const SESSION_KEY = 'vambora:opening:v1';
const MIN_DURATION = 3200;
const MAX_DURATION = 7000;

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
  const [tempoMinimo, setTempoMinimo] = useState(false);
  const [demorando, setDemorando] = useState(false);
  const conteudo = useRef<HTMLDivElement>(null);
  const pular = useRef<HTMLButtonElement>(null);
  const focoAnterior = useRef<HTMLElement | null>(null);

  const fechar = useCallback(() => {
    try { sessionStorage.setItem(SESSION_KEY, 'seen'); } catch { /* Armazenamento privado pode estar bloqueado. */ }
    setAberto(false);
  }, []);

  useEffect(() => {
    if (!aberto) return;
    const minimo = window.setTimeout(() => setTempoMinimo(true), reduzir ? 400 : MIN_DURATION);
    const aviso = window.setTimeout(() => setDemorando(true), MIN_DURATION);
    const limite = window.setTimeout(fechar, MAX_DURATION);
    return () => { clearTimeout(minimo); clearTimeout(aviso); clearTimeout(limite); };
  }, [aberto, reduzir, fechar]);

  useEffect(() => { if (aberto && tempoMinimo && !carregando) fechar(); }, [aberto, tempoMinimo, carregando, fechar]);

  useEffect(() => {
    if (!aberto) return;
    focoAnterior.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (conteudo.current) conteudo.current.inert = true;
    pular.current?.focus({ preventScroll: true });
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
        key="vambora-opening" className="startup" role="dialog" aria-modal="true" aria-label="Boas-vindas ao Vambora"
        initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduzir ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
        onKeyDown={e => { if (e.key === 'Escape') fechar(); if (e.key === 'Tab') { e.preventDefault(); pular.current?.focus(); } }}
      >
        <div className="startup-glow" aria-hidden="true" />
        <div className="startup-grid" aria-hidden="true" />
        <div className="startup-center">
          <div className="startup-scene" aria-hidden="true">
            <svg className="startup-road" viewBox="0 0 400 160" fill="none">
              <path d="M-20 125H90C130 125 130 45 180 45H420" stroke="url(#opening-road)" strokeWidth="1.5" />
              <defs><linearGradient id="opening-road"><stop stopColor="#67dbb4" stopOpacity="0" /><stop offset=".5" stopColor="#67dbb4" stopOpacity=".65" /><stop offset="1" stopColor="#67dbb4" stopOpacity="0" /></linearGradient></defs>
            </svg>
            <div className="startup-van"><OpeningVan /></div>
            <div className="startup-word">Vam<span>bora</span><span className="startup-period">.</span></div>
          </div>
          <h1 className="sr-only">Vambora</h1>
          <p className="startup-tagline"><span>Conectando pessoas.</span><span>Encurtando destinos.</span></p>
          <div className="startup-loading" role="status" aria-live="polite">
            <span className="startup-loading-line" aria-hidden="true" />
            <span className="startup-status">{demorando && carregando ? 'Preparando suas opções…' : 'Escolar e universitário'}</span>
          </div>
        </div>
        <div className="startup-bottom"><span>ARAÇATUBA E REGIÃO</span><button ref={pular} type="button" onClick={fechar}>Pular abertura <span aria-hidden="true">↗</span></button></div>
      </motion.div>}
    </AnimatePresence>
  </>;
}

/** Desenho vetorial próprio: leve, nítido em qualquer tela e sem imagens externas. */
function OpeningVan() {
  return <svg viewBox="0 0 160 110" fill="none">
    <defs>
      <linearGradient id="opening-body" x1="35" y1="20" x2="105" y2="95" gradientUnits="userSpaceOnUse"><stop stopColor="#a0efd2" /><stop offset=".45" stopColor="#55d3a7" /><stop offset="1" stopColor="#168766" /></linearGradient>
      <linearGradient id="opening-window" x1="60" y1="35" x2="80" y2="66" gradientUnits="userSpaceOnUse"><stop stopColor="#e0fff4" /><stop offset="1" stopColor="#7cbeaf" /></linearGradient>
    </defs>
    <ellipse cx="82" cy="96" rx="66" ry="7" fill="#020d1b" opacity=".3" />
    <path d="M16 74V39c0-9 7-15 16-15h68c8 0 13 3 18 9l20 23c5 5 7 10 7 17v10H16v-9Z" fill="url(#opening-body)" />
    <path d="M28 27h71c7 0 11 2 15 6" stroke="#d0ffec" strokeWidth="2" strokeLinecap="round" opacity=".6" />
    <rect x="29" y="36" width="29" height="26" rx="5" fill="#0d3142" />
    <rect x="64" y="36" width="29" height="26" rx="5" fill="#0d3142" />
    <path d="M101 37h5c3 0 6 2 8 5l15 18h-28V37Z" fill="url(#opening-window)" />
    <path d="m32 39 15 0-15 19V39Zm35 0h15L67 58V39Z" fill="#baf4e2" opacity=".18" />
    <path d="M16 70h129v10H16z" fill="#103348" />
    <rect x="17" y="81" width="128" height="5" rx="2.5" fill="#277863" />
    <rect x="136" y="64" width="9" height="5" rx="2" fill="#fff2c9" />
    <rect x="16" y="64" width="4" height="5" rx="1.5" fill="#f7a277" />
    <rect x="101" y="65" width="7" height="2" rx="1" fill="#103348" />
    {[43, 118].map(x => <g key={x} className="startup-wheel" style={{ transformOrigin: `${x}px 85px` }}><circle cx={x} cy="85" r="14" fill="#071a2d" /><circle cx={x} cy="85" r="8" fill="#aac7c8" /><path d={`M${x} 78v14m-7-7h14`} stroke="#effffb" strokeWidth="2" /><circle cx={x} cy="85" r="3" fill="#416474" /></g>)}
  </svg>;
}
