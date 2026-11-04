import { motion, useReducedMotion } from 'framer-motion';

/**
 * Transição de página premium: a nova tela surge com opacidade + leve escala +
 * desfoque, sem "pulo" vertical. Monta a cada navegação (rota = elemento novo).
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const reduzir = useReducedMotion();
  if (reduzir) return <>{children}</>;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.992, filter: 'blur(6px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
