import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Route as RouteIcon, Sparkles, LineChart, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Abas da navegação inferior. O 5º item é "Mais" (hub), que reúne Minha Van,
 * Documentação, Combustível, Clube etc. — coerente com a referência (/pro) e
 * evitando deixar o hub órfão. Minha Van (/app/van) é alcançada a partir do hub.
 */
export const TABS = [
  { to: '/app', end: true, label: 'Início', Icon: Home },
  { to: '/app/rotas', end: false, label: 'Rotas', Icon: RouteIcon },
  { to: '/app/oportunidades', end: false, label: 'Oportunidades', Icon: Sparkles },
  { to: '/app/inteligencia', end: false, label: 'Inteligência', Icon: LineChart },
  { to: '/app/mais', end: false, label: 'Mais', Icon: LayoutGrid },
] as const;

/** Casca do app Vambora Motoristas: fundo + conteúdo + navegação inferior. */
export function VMShell({ children, nav = true }: { children: ReactNode; nav?: boolean }) {
  return (
    <div className="vm-app pb-24">
      <div className="vm-screen">{children}</div>
      {nav && <VMBottomNav />}
    </div>
  );
}

export function VMBottomNav() {
  return (
    <nav className="vm-nav">
      <div className="vm-nav-inner px-3">
        <div className="mb-3 flex items-stretch justify-between rounded-2xl border border-navy-100/70 bg-white/95 p-1.5 shadow-float backdrop-blur-xl">
          {TABS.map(({ to, end, label, Icon }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => cn(
                'flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[10px] font-semibold transition-colors',
                isActive ? 'text-white' : 'text-navy-400',
              )}>
              {({ isActive }) => (
                <>
                  <span className={cn('grid h-8 w-full place-items-center rounded-xl', isActive && 'bg-mint-500 shadow-glow')}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
