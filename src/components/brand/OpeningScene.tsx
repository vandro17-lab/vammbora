import type { ReactNode } from 'react';
import './startup.css';

/**
 * Cena visual da abertura do VanBora (van vetorial + marca + tagline).
 * Compartilhada pela abertura do app e pela transição da busca, para que as
 * duas animações sejam idênticas. Só o visual — sem lógica de dispensar.
 */
export function OpeningScene({ status, skip }: { status?: ReactNode; skip?: ReactNode }) {
  return <>
    <div className="startup-glow" aria-hidden="true" />
    <div className="startup-grid" aria-hidden="true" />
    <div className="startup-center">
      <div className="startup-scene" aria-hidden="true">
        <svg className="startup-road" viewBox="0 0 400 160" fill="none">
          <path d="M-20 125H90C130 125 130 45 180 45H420" stroke="url(#opening-road)" strokeWidth="1.5" />
          <defs><linearGradient id="opening-road"><stop stopColor="#facc15" stopOpacity="0" /><stop offset=".5" stopColor="#facc15" stopOpacity=".65" /><stop offset="1" stopColor="#facc15" stopOpacity="0" /></linearGradient></defs>
        </svg>
        <div className="startup-van"><OpeningVan /></div>
        <div className="startup-word">Van<span>Bora</span><span className="startup-period">.</span></div>
      </div>
      <h1 className="sr-only">VanBora</h1>
      <p className="startup-tagline"><span>Conectando pessoas.</span><span>Encurtando destinos.</span></p>
      <div className="startup-loading" role="status" aria-live="polite">
        <span className="startup-loading-line" aria-hidden="true" />
        <span className="startup-status">{status ?? 'Escolar e universitário'}</span>
      </div>
      {skip}
    </div>
    <div className="startup-bottom"><span>ARAÇATUBA E REGIÃO</span></div>
  </>;
}

/** Desenho vetorial próprio: leve, nítido em qualquer tela e sem imagens externas. */
export function OpeningVan() {
  return <svg viewBox="0 0 160 110" fill="none">
    <defs>
      <linearGradient id="opening-body" x1="35" y1="20" x2="105" y2="95" gradientUnits="userSpaceOnUse"><stop stopColor="#525252" /><stop offset=".45" stopColor="#292929" /><stop offset="1" stopColor="#171717" /></linearGradient>
      <linearGradient id="opening-window" x1="60" y1="35" x2="80" y2="66" gradientUnits="userSpaceOnUse"><stop stopColor="#e5e5e5" /><stop offset="1" stopColor="#a3a3a3" /></linearGradient>
    </defs>
    <ellipse cx="82" cy="96" rx="66" ry="7" fill="#020d1b" opacity=".3" />
    <path d="M16 74V39c0-9 7-15 16-15h68c8 0 13 3 18 9l20 23c5 5 7 10 7 17v10H16v-9Z" fill="url(#opening-body)" />
    <path d="M28 27h71c7 0 11 2 15 6" stroke="#f5f5f5" strokeWidth="2" strokeLinecap="round" opacity=".6" />
    <rect x="29" y="36" width="29" height="26" rx="5" fill="#0a0a0a" />
    <rect x="64" y="36" width="29" height="26" rx="5" fill="#0a0a0a" />
    <path d="M101 37h5c3 0 6 2 8 5l15 18h-28V37Z" fill="url(#opening-window)" />
    <path d="m32 39 15 0-15 19V39Zm35 0h15L67 58V39Z" fill="#ffffff" opacity=".18" />
    <path d="M16 70h129v10H16z" fill="#facc15" /><text x="79" y="77.7" fontSize="8.5" fontWeight="900" letterSpacing="1.2" textAnchor="middle" fill="#171717">ESCOLAR</text>
    <rect x="17" y="81" width="128" height="5" rx="2.5" fill="#eab308" />
    <rect x="136" y="64" width="9" height="5" rx="2" fill="#fff2c9" />
    <rect x="16" y="64" width="4" height="5" rx="1.5" fill="#f7a277" />
    <rect x="101" y="65" width="7" height="2" rx="1" fill="#facc15" />
    {[43, 118].map(x => <g key={x} className="startup-wheel" style={{ transformOrigin: `${x}px 85px` }}><circle cx={x} cy="85" r="14" fill="#0a0a0a" /><circle cx={x} cy="85" r="8" fill="#a3a3a3" /><path d={`M${x} 78v14m-7-7h14`} stroke="#ffffff" strokeWidth="2" /><circle cx={x} cy="85" r="3" fill="#525252" /></g>)}
  </svg>;
}
