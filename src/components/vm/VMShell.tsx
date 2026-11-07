import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Route as RouteIcon, Handshake, LineChart, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Abas da navegação inferior. O 5º item é "Mais" (hub), que reúne Minha Van,
 * Documentação, Combustível, Clube etc. — coerente com a referência (/pro) e
 * evitando deixar o hub órfão. Minha Van (/app/van) é alcançada a partir do hub.
 */
export const TABS = [
  { to: '/app', end: true, label: 'Início', Icon: Home },
  { to: '/app/rotas', end: false, label: 'Rotas', Icon: RouteIcon },
  { to: '/app/oportunidades', end: false, label: 'Oportunidades', Icon: Handshake },
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
      <div className="vm-nav-inner flex items-stretch justify-around gap-1 rounded-t-2xl border-t border-navy-100 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0.4rem)] pt-1.5 shadow-[0_-10px_30px_-18px_rgba(11,31,58,0.35)] backdrop-blur-xl">
        {TABS.map(({ to, end, label, Icon }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) => cn(
              'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-0.5 py-1.5 text-[10px] font-semibold tracking-tight transition-colors',
              isActive ? 'bg-mint-400 text-navy-950 shadow-[0_3px_12px_rgba(202,138,4,0.15)]' : 'text-navy-500 hover:bg-navy-50',
            )}>
            {({ isActive }) => (
              <>
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.4 : 2} />
                <span className="leading-none">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
