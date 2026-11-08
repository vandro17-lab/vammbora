import { ArrowUpRight, MapPin, Route, MessageCircle } from 'lucide-react';
import { SearchForm } from '@/components/search/SearchForm';

export function Hero() {
  return (
    <section id="busca" className="premium-hero relative overflow-hidden text-white">
      <div className="hero-orbit" aria-hidden="true" />
      <div className="container-page relative grid items-center gap-12 py-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20 lg:py-20">
        <div>
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-mint-300">
            <span className="h-1.5 w-1.5 rounded-full bg-mint-400" /> Araçatuba · São Paulo
          </span>
          <h1 className="mt-6 max-w-xl font-display text-[clamp(2.65rem,5.5vw,5rem)] font-extrabold leading-[1.06] tracking-[-0.055em]">
            O próximo passo<br />é <span className="text-mint-300">ir tranquilo.</span>
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-navy-100">
            Encontre uma van para a escola ou faculdade. Compare as opções e combine o caminho com quem dirige.
          </p>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-navy-100">
            <span className="inline-flex items-center gap-2"><Route className="h-4 w-4 text-mint-300" /> Escolar e universitário</span>
            <span className="inline-flex items-center gap-2"><MessageCircle className="h-4 w-4 text-mint-300" /> Contato direto</span>
          </div>
          <div className="mt-12 hidden max-w-md items-center gap-4 border-t border-white/15 pt-6 lg:flex">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10"><MapPin className="h-5 w-5 text-mint-300" /></span>
            <div><p className="font-semibold">Da sua região ao próximo destino.</p><p className="mt-1 text-sm text-navy-200">Uma rotina mais simples começa aqui.</p></div>
            <ArrowUpRight className="ml-auto h-5 w-5 text-mint-300" />
          </div>
        </div>
        <div className="relative text-navy-900"><SearchForm /></div>
      </div>
      <div className="border-t border-white/10 bg-white/[0.03]">
        <div className="container-page flex flex-wrap items-center justify-between gap-3 py-5 text-xs text-navy-100 sm:text-sm">
          <span>Mais clareza para escolher. Mais leveza para ir.</span>
          <a href="#como-funciona" className="inline-flex items-center gap-2 font-semibold text-mint-300">Conheça o VanBora <ArrowUpRight className="h-4 w-4" /></a>
        </div>
      </div>
    </section>
  );
}
