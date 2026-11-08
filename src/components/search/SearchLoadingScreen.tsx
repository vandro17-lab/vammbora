import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import './SearchLoadingScreen.css';

interface Props { totalConsultados: number; cidade: string }

export function SearchLoadingScreen({ cidade }: Props) {
 const reduced = useReducedMotion();
 const [step, setStep] = useState(0);
 useEffect(() => {
  if (reduced) return;
  const id = window.setInterval(() => setStep(v => (v + 1) % 3), 1900);
  return () => window.clearInterval(id);
 }, [reduced]);
 return createPortal(
  <motion.div className="vb-search-cover" role="status" aria-live="polite" aria-label="Buscando vans para seu destino"
   initial={{opacity:1}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:.35}}>
   <div className="vb-search-content">
    <header className="vb-search-brand"><span className="vb-search-logo">▰</span><div><strong>Vam<span>Bora</span></strong><small>Transporte Escolar Inteligente</small></div></header>
    <section className="vb-search-scene" aria-label="Van escolar a caminho da escola">
     <svg className="vb-search-arc" viewBox="0 0 320 145" preserveAspectRatio="none" aria-hidden="true"><path d="M18 138 C90 -8 231 -8 302 105"/></svg>
     <span className="vb-search-pin" aria-hidden="true"><svg viewBox="0 0 32 42"><path d="M16 0C7 0 1 7 1 16c0 12 15 26 15 26s15-14 15-26C31 7 25 0 16 0Z"/><circle cx="16" cy="16" r="6" fill="#262626"/></svg></span>
     <span className="vb-search-school" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M24 4 5 20v24h38V20L24 4Zm0 7 12 10H12L24 11ZM10 25h28v14h-8V28H18v11h-8V25Zm12 7h4v12h-4V32Z"/></svg></span>
     <div className="vb-search-skyline" aria-hidden="true"/>
     <div className="vb-search-road" aria-hidden="true"/>
     <img className="vb-search-van" src="/vanbora-visual/02_veiculos/van-01.webp" alt="Van escolar" />
    </section>
    <div className="vb-search-title"><svg viewBox="0 0 56 56" fill="none" stroke="currentColor" strokeWidth="5"><circle cx="23" cy="23" r="17"/><path d="m36 36 15 15"/></svg><h1>Procurando vans<br/>para o seu destino</h1></div>
    <div className="vb-search-progress" aria-hidden="true"><div/></div>
    <div className="vb-search-steps" aria-label="Pesquisa em andamento">
     {['Consultando rotas','Verificando vagas','Carregando ofertas'].map((label,i) => <div className="vb-search-step" key={label}><span className={'vb-search-step-circle '+(i===step?'active':'')}>{i===0?'⌖':i===1?'♙':'✓'}</span><span>{label}</span></div>)}
    </div>
    <span className="vb-search-sr">Consultando trajetos em {cidade}</span>
   </div>
  </motion.div>, document.body
 );
}
