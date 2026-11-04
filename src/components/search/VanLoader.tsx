import { useEffect, useReducer } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Home, School } from 'lucide-react';
import { plural } from '@/lib/utils';

interface VanLoaderProps {
  /** Nº real de motoristas consultados — usado numa mensagem honesta. */
  totalConsultados: number;
  cidade: string;
}

export function VanLoader({ totalConsultados, cidade }: VanLoaderProps) {
  const reduzirMovimento = useReducedMotion();
  const [passo, avancar] = useReducer((p: number) => Math.min(p + 1, 2), 0);

  // Mensagens 100% honestas (nenhuma contagem inventada).
  const MENSAGENS = [
    'Consultando as rotas disponíveis…',
    totalConsultados > 0
      ? `Verificando horários e vagas de ${plural(totalConsultados, 'motorista', 'motoristas')} em ${cidade}…`
      : `Procurando motoristas em ${cidade}…`,
    'Comparando as melhores opções para você…',
  ];

  useEffect(() => {
    const t1 = setTimeout(avancar, 750);
    const t2 = setTimeout(avancar, 1500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div
      className="flex flex-col items-center justify-center py-16 text-center"
      role="status"
      aria-live="polite"
    >
      <div className="relative h-24 w-[min(90%,22rem)]">
        {/* linha da rota */}
        <svg viewBox="0 0 360 96" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <line
            x1="28"
            y1="60"
            x2="332"
            y2="60"
            stroke="#adc3e7"
            strokeWidth="3"
            strokeDasharray="2 8"
            strokeLinecap="round"
          />
        </svg>

        {/* pino casa */}
        <div className="absolute left-0 top-7 flex flex-col items-center text-navy-500">
          <Home className="h-6 w-6" />
        </div>
        {/* pino escola */}
        <div className="absolute right-0 top-7 flex flex-col items-center text-navy-500">
          <School className="h-6 w-6" />
        </div>

        {/* van */}
        <motion.div
          className="absolute top-3"
          initial={{ left: reduzirMovimento ? '46%' : '4%' }}
          animate={reduzirMovimento ? undefined : { left: ['4%', '84%', '4%'] }}
          transition={
            reduzirMovimento
              ? undefined
              : { duration: 2.1, ease: 'easeInOut', repeat: Infinity }
          }
        >
          <VanTiny />
        </motion.div>
      </div>

      <motion.p
        key={passo}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 text-base font-medium text-navy-700"
      >
        {MENSAGENS[passo]}
      </motion.p>
      <p className="mt-1 text-sm text-navy-400">Comparando rota, horário e vagas de verdade.</p>
    </div>
  );
}

function VanTiny() {
  return (
    <svg width="54" height="34" viewBox="0 0 54 34" fill="none" aria-hidden="true">
      <rect x="2" y="6" width="42" height="18" rx="5" fill="#2f52a0" />
      <rect x="6" y="9" width="12" height="8" rx="2" fill="#eef3fb" />
      <rect x="20" y="9" width="10" height="8" rx="2" fill="#eef3fb" />
      <rect x="32" y="9" width="9" height="8" rx="2" fill="#eef3fb" />
      <rect x="2" y="21" width="42" height="4" fill="#3cc394" />
      <circle cx="14" cy="27" r="5" fill="#0b1f3a" />
      <circle cx="14" cy="27" r="2" fill="#eef3fb" />
      <circle cx="34" cy="27" r="5" fill="#0b1f3a" />
      <circle cx="34" cy="27" r="2" fill="#eef3fb" />
    </svg>
  );
}
