import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Route, MapPin, Sparkles } from 'lucide-react';
import { VanMark } from '@/components/brand/Logo';

interface Props {
  totalConsultados: number;
  cidade: string;
}

/**
 * Tela de carregamento premium exibida ENQUANTO a busca real acontece.
 * Van dirigindo (rodas girando + suspensão), estrada com parallax, pontos de
 * origem/destino e aurora animada.
 *
 * Honestidade (regras do comando):
 * - Não há barra de progresso determinística: o indicador é INDETERMINADO,
 *   porque não sabemos quanto falta — o overlay vive enquanto a busca real roda.
 * - As mensagens descrevem atividade EM ANDAMENTO e são genéricas quando não
 *   correspondem a etapas verificáveis; nunca afirmam etapas concluídas.
 * - Respeita prefers-reduced-motion, teclado e leitores de tela (aria-live).
 */
export function SearchLoadingScreen({ totalConsultados, cidade }: Props) {
  const reduzir = useReducedMotion();
  const [passo, setPasso] = useState(0);

  const passos = [
    { Icone: Route, texto: 'Procurando vans para o seu destino' },
    {
      Icone: MapPin,
      texto:
        totalConsultados > 0
          ? `Consultando trajetos em ${cidade}`
          : `Consultando trajetos pelas ruas de ${cidade}`,
    },
    { Icone: Sparkles, texto: 'Organizando as opções para você' },
  ];

  useEffect(() => {
    if (reduzir) return;
    // Alterna a MENSAGEM visível (atividade em andamento), sem prometer que uma
    // etapa terminou. O ciclo se repete porque a busca pode durar mais que isso.
    const t = window.setInterval(() => setPasso((n) => (n + 1) % passos.length), 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduzir]);

  const AtualIcone = passos[passo].Icone;

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center overflow-hidden bg-brand-gradient grain"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      role="status"
      aria-live="polite"
      aria-label="Buscando vans compatíveis"
    >
      {/* Aurora atrás */}
      {!reduzir && (
        <>
          <div className="pointer-events-none absolute -left-32 top-16 h-72 w-72 rounded-full bg-mint-500/20 blur-3xl animate-aurora-a" />
          <div className="pointer-events-none absolute -right-40 bottom-12 h-72 w-72 rounded-full bg-navy-400/15 blur-3xl animate-aurora-b" />
        </>
      )}

      {/* Marca */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 mb-10"
      >
        <span className="inline-flex items-center gap-2.5">
          <span className={reduzir ? '' : 'animate-pulse-glow'}>
            <VanMark className="h-11 w-11" />
          </span>
          <span className="font-display text-2xl font-extrabold tracking-tightest text-white">
            Vam<span className="text-mint-400">bora</span>
          </span>
        </span>
      </motion.div>

      {/* Palco da van */}
      <div className="relative z-10 h-48 w-[min(92vw,30rem)]">
        {/* Cidade ao fundo (parallax lento) */}
        {!reduzir && (
          <motion.div
            className="absolute bottom-16 left-0 flex gap-8 opacity-40"
            animate={{ x: ['0%', '-50%'] }}
            transition={{ duration: 9, ease: 'linear', repeat: Infinity }}
          >
            {[0, 1].map((k) => (
              <svg key={k} width="520" height="90" viewBox="0 0 520 90" className="shrink-0">
                <g fill="#a8c0e4">
                  {[10, 70, 120, 190, 250, 320, 380, 450].map((x, i) => (
                    <rect key={x} x={x} y={90 - (26 + ((i * 13) % 46))} width="34" height="90" rx="4" />
                  ))}
                </g>
              </svg>
            ))}
          </motion.div>
        )}

        {/* Van (centralizada via flex; só a suspensão usa transform, sem conflito) */}
        <div className="absolute inset-x-0 bottom-10 flex justify-center">
          <motion.div
            animate={reduzir ? undefined : { y: [0, -4, 0, -2, 0] }}
            transition={reduzir ? undefined : { duration: 1.1, ease: 'easeInOut', repeat: Infinity }}
          >
            <LoaderVan spinning={!reduzir} />
          </motion.div>
        </div>

        {/* Estrada */}
        <div className="absolute inset-x-0 bottom-0 h-10 rounded-t-xl bg-navy-950/60 ring-1 ring-white/5" />
        <div
          className={
            'absolute inset-x-0 bottom-[18px] h-[3px] ' + (reduzir ? '' : 'animate-road-scroll')
          }
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, rgba(255,255,255,0.75) 0 26px, transparent 26px 60px)',
          }}
        />

        {/* Pontos de origem (embarque) e destino (escola) sobre a estrada */}
        <div className="absolute bottom-[34px] left-3 flex flex-col items-center gap-1">
          <span className="h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-emerald-400/30" />
          <span className="text-[10px] font-semibold text-emerald-200/90">Origem</span>
        </div>
        <div className="absolute bottom-[34px] right-3 flex flex-col items-center gap-1">
          <span className="h-3 w-3 rounded-full bg-mint-400 ring-2 ring-mint-400/30" />
          <span className="text-[10px] font-semibold text-mint-200/90">Escola</span>
        </div>
      </div>

      {/* Mensagens */}
      <div className="relative z-10 mt-8 flex min-h-14 max-w-lg items-center px-6 text-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={passo}
            initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="inline-flex items-center gap-2 text-base font-medium text-navy-100"
          >
            <AtualIcone className="h-4 w-4 text-mint-300" />
            {passos[passo].texto}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Indicador INDETERMINADO — não fingimos progresso nem porcentagem:
          o overlay existe enquanto a busca real roda. */}
      <div className="relative z-10 mt-5 h-1.5 w-56 overflow-hidden rounded-full bg-white/10">
        {reduzir ? (
          <div className="h-full w-1/3 rounded-full bg-mint-400/80" />
        ) : (
          <motion.div
            className="h-full w-2/5 rounded-full bg-gradient-to-r from-mint-400 to-mint-500"
            animate={{ x: ['-110%', '260%'] }}
            transition={{ duration: 1.25, ease: 'easeInOut', repeat: Infinity }}
          />
        )}
      </div>
      <p className="relative z-10 mt-3 text-xs text-navy-300">
        Mostramos vagas e horários informados pelos motoristas.
      </p>
    </motion.div>,
    document.body,
  );
}

/** Van de perfil, premium, com rodas girando (via CSS). */
function LoaderVan({ spinning }: { spinning: boolean }) {
  const wheel = {
    transformBox: 'fill-box' as const,
    transformOrigin: 'center' as const,
  };
  return (
    <svg width="170" height="92" viewBox="0 0 208 112" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="lv-corpo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5c84cf" />
          <stop offset="60%" stopColor="#2f52a0" />
          <stop offset="100%" stopColor="#182e60" />
        </linearGradient>
        <linearGradient id="lv-vidro" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#eaf3ff" />
          <stop offset="100%" stopColor="#9fc0ea" />
        </linearGradient>
        <linearGradient id="lv-aro" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f4f7fb" />
          <stop offset="100%" stopColor="#9fb4cf" />
        </linearGradient>
      </defs>

      {/* corpo */}
      <path
        d="M14 86 L14 44 Q14 26 32 24 L128 16 Q140 15 150 23 L180 46 Q190 54 190 68 L190 86 Q190 92 184 92 L20 92 Q14 92 14 86 Z"
        fill="url(#lv-corpo)"
      />
      <path d="M18 42 Q18 30 34 28 L128 20 Q136 19 143 24 L128 24 L34 32 Q22 33 22 46 Z" fill="#fff" opacity="0.22" />
      <rect x="14" y="74" width="176" height="8" fill="#3cc394" />
      {/* vidros */}
      <g fill="url(#lv-vidro)">
        <rect x="34" y="34" width="34" height="26" rx="5" />
        <rect x="74" y="34" width="32" height="26" rx="5" />
        <rect x="150" y="40" width="26" height="22" rx="5" />
      </g>
      <path d="M40 60 L56 34 L64 34 L48 60 Z" fill="#fff" opacity="0.5" />
      {/* farol */}
      <circle cx="186" cy="66" r="4" fill="#fff4cf" />
      {/* rodas (giram) */}
      {[52, 150].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="92" r="17" fill="#111b2e" />
          <g style={spinning ? wheel : undefined} className={spinning ? 'animate-wheel-spin' : ''}>
            <circle cx={cx} cy="92" r="9" fill="url(#lv-aro)" />
            {[0, 72, 144, 216, 288].map((a) => (
              <rect
                key={a}
                x={cx - 1}
                y="84"
                width="2"
                height="7"
                rx="1"
                fill="#c7d3e3"
                transform={`rotate(${a} ${cx} 92)`}
              />
            ))}
            <circle cx={cx} cy="92" r="2.5" fill="#64748b" />
          </g>
        </g>
      ))}
    </svg>
  );
}
