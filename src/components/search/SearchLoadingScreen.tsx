import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { OpeningVan } from '@/components/brand/StartupExperience';
import '@/components/brand/startup.css';

interface Props { cidade: string }

/** A busca usa a mesma abertura da entrada, mantendo a tela protegida durante o processamento. */
export function SearchLoadingScreen({ cidade }: Props) {
  return createPortal(
    <motion.div
      className="startup"
      role="status"
      aria-live="polite"
      aria-label="Buscando vans para seu destino"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: .35 }}
    >
      <div className="startup-glow" aria-hidden="true" />
      <div className="startup-grid" aria-hidden="true" />
      <div className="startup-center">
        <div className="startup-scene" aria-hidden="true">
          <svg className="startup-road" viewBox="0 0 400 160" fill="none">
            <path d="M-20 125H90C130 125 130 45 180 45H420" stroke="url(#search-road)" strokeWidth="1.5" />
            <defs><linearGradient id="search-road"><stop stopColor="#facc15" stopOpacity="0" /><stop offset=".5" stopColor="#facc15" stopOpacity=".65" /><stop offset="1" stopColor="#facc15" stopOpacity="0" /></linearGradient></defs>
          </svg>
          <div className="startup-van"><OpeningVan /></div>
          <div className="startup-word">Van<span>Bora</span><span className="startup-period">.</span></div>
        </div>
        <h1 className="sr-only">VanBora</h1>
        <p className="startup-tagline"><span>Conectando pessoas.</span><span>Encurtando destinos.</span></p>
        <div className="startup-loading" role="status" aria-live="polite">
          <span className="startup-loading-line" aria-hidden="true" />
          <span className="startup-status">Consultando trajetos em {cidade}</span>
        </div>
      </div>
      <div className="startup-bottom"><span>ARAÇATUBA E REGIÃO</span></div>
    </motion.div>,
    document.body,
  );
}
