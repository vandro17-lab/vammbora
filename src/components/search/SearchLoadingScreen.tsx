import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import './SearchLoadingScreen.css';

interface Props { totalConsultados: number; cidade: string }

/** Overlay de transição da busca por vans: ocupa um único viewport, fica à frente
 *  de tudo (portal no <body>) e só aparece quando a imagem da van está pronta,
 *  evitando qualquer "piscada". A rolagem do fundo é travada pela página que a
 *  exibe (SearchResultsPage). */
export function SearchLoadingScreen({ cidade }: Props) {
  const [pronto, setPronto] = useState(false);
  const vanRef = useRef<HTMLImageElement>(null);

  // Mostra a cena apenas depois que a van decodificar (ou de imediato, se já veio
  // do cache). Fallback por timeout para nunca ficar invisível.
  useEffect(() => {
    let vivo = true;
    const liberar = () => { if (vivo) setPronto(true); };
    const img = vanRef.current;
    if (!img) { liberar(); return; }
    if (img.complete && img.naturalWidth) {
      img.decode ? img.decode().then(liberar, liberar) : liberar();
    }
    const fallback = window.setTimeout(liberar, 600);
    return () => { vivo = false; window.clearTimeout(fallback); };
  }, []);

  return createPortal(
    <motion.div
      className="vb-search-cover"
      role="status"
      aria-live="polite"
      aria-label="Buscando vans para o seu destino"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
    >
      <main className={'vb-search-screen' + (pronto ? ' vb-ready' : '')}>
        <header className="vb-search-brand">
          <span className="vb-search-logo" aria-hidden="true">
            <svg viewBox="0 0 64 64" fill="none" stroke="#121212" strokeWidth="4.6" strokeLinejoin="round" strokeLinecap="round">
              <path d="M10 38 18 22h28l9 16v10H9V38Z" />
              <circle cx="20" cy="48" r="6" fill="#ffca00" />
              <circle cx="45" cy="48" r="6" fill="#ffca00" />
              <path d="M20 22 14 37h36l-6-15" />
            </svg>
          </span>
          <span className="vb-search-brandtext">
            <span className="vb-search-brandname">Van<span>Bora</span></span>
            <small className="vb-search-sub">Transporte Escolar Inteligente</small>
          </span>
        </header>

        <section className="vb-search-scene" aria-label="Van escolar a caminho da escola">
          <div className="vb-search-city" aria-hidden="true">
            <svg viewBox="0 0 500 190" preserveAspectRatio="none">
              <path d="M0 190V130h28V94h32v28h21V75h24v36h25V60h28v52h27V90h28v24h21V52h29v65h23V83h28v38h24V70h32v46h20V92h32v31h24V61h33v61h22V99h30v91Z" fill="#080c12" />
              <path d="M0 190V155h25v-25h30v27h30v-49h25v44h29v-33h35v37h24v-50h30v48h27v-30h38v30h29v-53h32v51h30v-31h35v32h30v-44h30v81Z" fill="#16191d" />
            </svg>
          </div>
          <div className="vb-search-sunset" aria-hidden="true" />
          <svg className="vb-search-arc" viewBox="0 0 320 145" preserveAspectRatio="none" aria-hidden="true">
            <path d="M18 138 C 90 -8, 231 -8, 302 105" />
          </svg>
          <span className="vb-search-pin" aria-hidden="true">
            <svg viewBox="0 0 32 42" fill="currentColor">
              <path d="M16 0C7 0 1 7 1 16c0 12 15 26 15 26s15-14 15-26C31 7 25 0 16 0Z" />
              <circle cx="16" cy="16" r="6" fill="#222" />
            </svg>
          </span>
          <span className="vb-search-school" aria-hidden="true">
            <svg viewBox="0 0 48 48" fill="white">
              <path d="M24 4 5 20v24h38V20L24 4Zm0 7 12 10H12L24 11ZM10 25h28v14h-8V28H18v11h-8V25Zm12 7h4v12h-4V32Z" />
              <path d="M31 3h3v12h-3z" />
            </svg>
          </span>
          <div className="vb-search-road" aria-hidden="true" />
          <img
            ref={vanRef}
            className="vb-search-van"
            src="/vanbora-visual/02_veiculos/van-escolar-busca.webp"
            alt="Van escolar"
            onLoad={() => setPronto(true)}
            onError={() => setPronto(true)}
            draggable={false}
          />
          <svg className="vb-search-wave" viewBox="0 0 500 90" preserveAspectRatio="none" aria-hidden="true">
            <path d="M-20 64C150 102 250 16 520 20" />
          </svg>
        </section>

        <div className="vb-search-heading">
          <svg className="vb-search-magnify" viewBox="0 0 56 56" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" aria-hidden="true">
            <circle cx="23" cy="23" r="17" />
            <path d="m36 36 15 15" />
          </svg>
          <h1>Procurando vans<br />para o seu destino</h1>
        </div>

        <div className="vb-search-progress" aria-hidden="true"><div /></div>

        <section className="vb-search-steps" aria-label="Etapas da pesquisa">
          <div className="vb-search-step">
            <span className="vb-search-circle" aria-hidden="true">
              <svg viewBox="0 0 32 32" fill="currentColor"><path d="M16 1C8 1 3 7 3 15c0 10 13 16 13 16s13-6 13-16C29 7 24 1 16 1Z" /><circle cx="16" cy="14" r="5" fill="#242424" /></svg>
              <span className="vb-search-check">✓</span>
            </span>
            Consultando<br />rotas
          </div>
          <div className="vb-search-connector" aria-hidden="true" />
          <div className="vb-search-step">
            <span className="vb-search-circle" aria-hidden="true">
              <svg viewBox="0 0 32 32" fill="currentColor"><circle cx="16" cy="9" r="5" /><circle cx="5" cy="13" r="4" /><circle cx="27" cy="13" r="4" /><path d="M8 28v-8q0-6 8-6t8 6v8ZM0 28v-9q1-4 6-4h2v13ZM24 28V15h2q6 0 6 6v7Z" /></svg>
              <span className="vb-search-check">✓</span>
            </span>
            Verificando<br />vagas
          </div>
          <div className="vb-search-connector" aria-hidden="true" />
          <div className="vb-search-step">
            <span className="vb-search-circle" aria-hidden="true">
              <svg viewBox="0 0 32 32" fill="currentColor"><path d="m16 1 13 5v10c0 8-6 13-13 15C9 29 3 24 3 16V6L16 1Z" /><path d="m9 16 5 5 9-10" fill="none" stroke="#252525" strokeWidth="3" /></svg>
              <span className="vb-search-check">✓</span>
            </span>
            Carregando<br />ofertas
          </div>
        </section>

        <span className="vb-search-sr">Consultando trajetos em {cidade}</span>
      </main>
    </motion.div>, document.body
  );
}
