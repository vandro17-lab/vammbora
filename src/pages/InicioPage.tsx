import { Link } from 'react-router-dom';
import { Search, Bus } from 'lucide-react';
import { LogoCompleta } from '@/components/brand/Logo';

/**
 * TELA INICIAL do VanBora (Etapa 3A): apresenta a plataforma e leva direto aos
 * dois caminhos — procurar transporte (sem cadastro) ou entrar como motorista.
 * Paleta oficial: amarelo #FFC700, preto, branco e cinza-claro #F5F5F5. A logo
 * oficial já é sobre preto, por isso o fundo da tela é preto.
 */
export function InicioPage() {
  return (
    <main id="conteudo" tabIndex={-1} className="flex min-h-dvh flex-col bg-black text-white outline-none">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-4 min-[360px]:px-6 pt-[max(env(safe-area-inset-top),1.25rem)] [@media(max-height:700px)]:pb-2 [@media(max-height:700px)]:pt-[max(env(safe-area-inset-top),0.75rem)]">
        <LogoCompleta className="mx-auto w-[min(15rem,62vw,26dvh)] [@media(max-height:600px)]:w-[21dvh]" />

        <p className="mt-5 text-center text-[0.72rem] font-extrabold uppercase tracking-[0.14em] text-[#FFC700] [@media(max-height:700px)]:mt-3 [@media(max-height:700px)]:tracking-[0.08em]">
          Vitrine inteligente de transporte escolar
        </p>
        <h1 className="mt-3 text-center font-display text-[clamp(1.9rem,8.4vw,2.6rem)] font-extrabold leading-[1.08] tracking-tight [@media(max-height:700px)]:mt-2 [@media(max-height:700px)]:text-[1.75rem] [@media(max-height:600px)]:text-[1.55rem]">
          O caminho certo começa aqui.
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-center text-[1.02rem] leading-relaxed text-[#F5F5F5]/85 [@media(max-height:700px)]:mt-2 [@media(max-height:700px)]:text-[0.95rem] [@media(max-height:700px)]:leading-snug">
          Encontre vans escolares que atendem sua região ou ofereça seu serviço a novas famílias.
        </p>

        <h2 className="mt-7 text-center text-base font-bold text-[#F5F5F5] [@media(max-height:700px)]:mt-4">Como você quer começar?</h2>
        <nav aria-label="Como você quer começar" className="mt-3 grid gap-3 [@media(max-height:700px)]:mt-2 [@media(max-height:700px)]:gap-2.5">
          <Link to="/buscar"
            className="flex min-h-[3.75rem] items-center justify-center gap-2.5 rounded-2xl bg-[#FFC700] px-4 text-[clamp(1rem,4.6vw,1.125rem)] font-extrabold [@media(max-height:700px)]:min-h-[3.25rem] text-black shadow-[0_10px_30px_-12px_rgba(255,199,0,.7)] transition active:scale-[0.98] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FFC700]">
            <Search className="h-6 w-6" strokeWidth={2.6} aria-hidden="true" /> Procurar transporte escolar
          </Link>
          <Link to="/motorista"
            className="flex min-h-[3.75rem] items-center justify-center gap-2.5 rounded-2xl bg-white px-4 text-[clamp(1rem,4.6vw,1.125rem)] font-extrabold [@media(max-height:700px)]:min-h-[3.25rem] text-black ring-2 ring-white transition active:scale-[0.98] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-white">
            <Bus className="h-6 w-6" strokeWidth={2.4} aria-hidden="true" /> Sou motorista
          </Link>
        </nav>
        <p className="mt-3 text-center text-sm text-[#F5F5F5]/80 [@media(max-height:700px)]:mt-1.5">
          Já registrou uma solicitação?{' '}
          <Link to="/familia/solicitacoes" className="inline-block whitespace-nowrap py-1.5 font-bold text-[#FFC700] underline underline-offset-2">Acompanhe aqui</Link>
        </p>
      </div>

      <footer className="px-6 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1 text-center text-sm text-[#F5F5F5]/70 [@media(max-height:700px)]:pt-0">
        <Link to="/privacidade" className="inline-block py-2 underline underline-offset-2 hover:text-white">Política de Privacidade</Link>
      </footer>
    </main>
  );
}
