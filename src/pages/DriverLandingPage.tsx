import { Link } from 'react-router-dom';
import { Route as RouteIcon, Users, Calculator, Check, ArrowRight } from 'lucide-react';
import { VanEscolar } from '@/components/vm/VanEscolar';
import { LINKS_ENTRADA_MOTORISTA } from '@/app/navegacao-motorista';

/**
 * TELA 1 — Boas-vindas do Vambora Motoristas.
 * Entrada única "Sou motorista": Marketplace → aqui → autenticação existente
 * (`/motorista/conta`) → app real (`/app`). Preserva o login Google/e-mail.
 */
export function DriverLandingPage() {
  const beneficios = [
    { Icone: RouteIcon, texto: 'Organize suas rotas' },
    { Icone: Users, texto: 'Encontre mais alunos' },
    { Icone: Calculator, texto: 'Calcule seus custos' },
  ];
  return (
    <div className="vm-grad flex min-h-dvh flex-col text-white">
      <div className="vm-screen flex flex-1 flex-col px-6 pb-8 pt-[calc(env(safe-area-inset-top)+2.5rem)]">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25">
            <Check className="h-5 w-5 text-white" strokeWidth={3} />
          </span>
          <span className="font-display text-2xl font-extrabold tracking-tight">Vambora <span className="text-mint-200">Motoristas</span></span>
        </div>

        <p className="mt-4 max-w-xs text-lg font-medium text-mint-50/90">
          O assistente inteligente do motorista de transporte escolar.
        </p>

        {/* Van escolar */}
        <div className="relative my-8 flex items-center justify-center">
          <div className="pointer-events-none absolute h-44 w-44 rounded-full bg-white/10 blur-2xl" />
          <VanEscolar className="relative w-full max-w-[22rem] drop-shadow-xl" />
        </div>

        {/* Benefícios */}
        <ul className="space-y-3">
          {beneficios.map((b) => (
            <li key={b.texto} className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15 ring-1 ring-white/20">
                <b.Icone className="h-5 w-5" />
              </span>
              <span className="text-base font-medium">{b.texto}</span>
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-8">
          <Link to={LINKS_ENTRADA_MOTORISTA.entrar}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white text-base font-bold text-mint-700 shadow-float transition active:scale-[0.98]">
            Começar agora <ArrowRight className="h-5 w-5" />
          </Link>
          <p className="mt-3 text-center text-sm text-mint-50/90">
            Já tem uma conta?{' '}
            <Link to={LINKS_ENTRADA_MOTORISTA.entrar} className="font-bold underline underline-offset-2">Entrar</Link>
          </p>
          <Link to={LINKS_ENTRADA_MOTORISTA.demonstracao} className="mt-4 block text-center text-xs font-medium text-mint-100/70">
            Conhecer o app
          </Link>
        </div>
      </div>
    </div>
  );
}
