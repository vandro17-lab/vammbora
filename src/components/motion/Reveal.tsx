import type { CSSProperties, ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const MOTION = {
  div: motion.div,
  section: motion.section,
  li: motion.li,
  article: motion.article,
} as const;

interface RevealProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Atraso em segundos para efeito escalonado. */
  delay?: number;
  /** Tag renderizada (default div). */
  as?: keyof typeof MOTION;
}

/**
 * Revelação premium ao entrar na viewport: opacidade + leve escala + desfoque,
 * com easing suave. Evita o movimento vertical pesado ("subir"). Respeita
 * prefers-reduced-motion (aparece sem animar).
 */
export function Reveal({ children, className, style, delay = 0, as = 'div' }: RevealProps) {
  const reduzir = useReducedMotion();

  if (reduzir) {
    const Static = as;
    return (
      <Static className={className} style={style}>
        {children}
      </Static>
    );
  }

  const Comp = MOTION[as];
  return (
    <Comp
      className={className}
      style={style}
      initial={{ opacity: 0, scale: 0.98, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Comp>
  );
}
