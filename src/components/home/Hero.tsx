import { motion, useReducedMotion } from 'framer-motion';
import { MapPin, ShieldCheck, Clock, Star } from 'lucide-react';
import { SearchForm } from '@/components/search/SearchForm';

export function Hero() {
  const reduzir = useReducedMotion();
  const ease = [0.22, 1, 0.36, 1] as const;

  return (
    <section id="busca" className="relative overflow-hidden bg-brand-gradient grain">
      {/* Aurora animada atrás */}
      {!reduzir && (
        <>
          <div className="pointer-events-none absolute -left-28 -top-24 h-96 w-96 rounded-full bg-mint-500/25 blur-3xl animate-aurora-a" />
          <div className="pointer-events-none absolute right-0 top-10 h-[28rem] w-[28rem] rounded-full bg-navy-400/25 blur-3xl animate-aurora-b" />
        </>
      )}

      <div className="container-page relative grid gap-10 py-16 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:py-24">
        <motion.div
          initial={reduzir ? false : { opacity: 0, filter: 'blur(10px)', scale: 0.98 }}
          animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
          transition={{ duration: 0.8, ease }}
          className="flex flex-col justify-center text-white"
        >
          <span className="chip w-fit bg-white/10 text-mint-200 ring-1 ring-white/15 backdrop-blur">
            <MapPin className="h-3.5 w-3.5" /> Araçatuba e região
          </span>
          <h1 className="mt-5 font-display text-[2.6rem] font-extrabold leading-[1.05] sm:text-6xl">
            A van certa para a <span className="text-mint-400">rota</span> do seu aluno.
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-navy-100">
            Nada de distância em linha reta. O Vambora mostra só as vans que realmente conseguem
            buscar na porta, chegar a tempo e ter vaga no horário que você precisa.
          </p>

          <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm text-navy-100">
            <li className="inline-flex items-center gap-2">
              <Clock className="h-4 w-4 text-mint-300" /> Compatibilidade de rota e horário
            </li>
            <li className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-mint-300" /> Contato direto, sem intermediário
            </li>
            <li className="inline-flex items-center gap-2">
              <Star className="h-4 w-4 text-mint-300" /> Motoristas avaliados pela comunidade
            </li>
          </ul>
        </motion.div>

        <motion.div
          initial={reduzir ? false : { opacity: 0, filter: 'blur(10px)', y: 10 }}
          animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
          transition={{ duration: 0.8, delay: 0.12, ease }}
          className="relative"
        >
          {/* halo premium sob o cartão */}
          <div className="pointer-events-none absolute -inset-3 rounded-[1.8rem] bg-mint-400/10 blur-2xl" />
          <div className="relative rounded-[1.6rem] p-[1.5px]">
            <div className="rounded-[1.5rem] bg-gradient-to-b from-white/60 to-white/10 p-[1px] shadow-float">
              <SearchForm />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
