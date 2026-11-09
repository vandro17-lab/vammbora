import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { OpeningScene } from '@/components/brand/OpeningScene';

interface Props { totalConsultados: number; cidade: string }

/**
 * Transição da busca — usa EXATAMENTE a mesma cena da abertura do app, para que
 * as duas animações sejam idênticas. Cobre a tela inteira (via portal) enquanto
 * a página de resultados carrega, sem deixar ver a troca de tela por trás.
 */
export function SearchLoadingScreen({ cidade }: Props) {
  return createPortal(
    <motion.div
      className="startup"
      role="status" aria-live="polite" aria-label="Buscando vans para seu destino"
      initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .4, ease: [0.22, 1, 0.36, 1] }}
    >
      <OpeningScene />
      <span className="sr-only">Consultando trajetos em {cidade}</span>
    </motion.div>,
    document.body,
  );
}
