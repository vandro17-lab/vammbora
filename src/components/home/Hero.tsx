import { motion, useReducedMotion } from 'framer-motion';
import { MapPin, ShieldCheck, Clock } from 'lucide-react';
import { SearchForm } from '@/components/search/SearchForm';

export function Hero() {
  const reduzir = useReducedMotion();
  return (
    <section id="busca" className="relative overflow-hidden bg-brand-gradient">
      <div className="container-page grid gap-10 py-14 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:py-20">
        <motion.div
          initial={reduzir ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col justify-center text-white"
        >
          <span className="chip w-fit bg-white/10 text-mint-200 ring-1 ring-white/15">
            <MapPin className="h-3.5 w-3.5" /> Araçatuba e região
          </span>
          <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.1] sm:text-5xl">
            A van certa para a rota do seu aluno.
          </h1>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-navy-100">
            Nada de distância em linha reta. O Vambora mostra só as vans que realmente conseguem
            buscar na porta, chegar a tempo e ter vaga no horário que você precisa.
          </p>

          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm text-navy-100">
            <li className="inline-flex items-center gap-2">
              <Clock className="h-4 w-4 text-mint-300" /> Compatibilidade de rota e horário
            </li>
            <li className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-mint-300" /> Contato direto, sem intermediário
            </li>
          </ul>
        </motion.div>

        <motion.div
          initial={reduzir ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <SearchForm />
        </motion.div>
      </div>
    </section>
  );
}
