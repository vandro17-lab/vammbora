import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

/** Chip "demonstração" discreto (quando a tela usa o cenário de exemplo). */
export function DemoChip({ className }: { className?: string }) {
  return (
    <span className={cn('chip bg-amber-100/90 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200', className)}>
      demonstração
    </span>
  );
}

/** Tile de indicador (número grande + rótulo + ícone colorido). */
export function StatTile({ icon: Icon, valor, rotulo, cor = 'green' }: {
  icon: LucideIcon; valor: ReactNode; rotulo: string;
  cor?: 'blue' | 'green' | 'purple' | 'amber' | 'rose' | 'teal' | 'navy' | 'slate';
}) {
  return (
    <div className="vm-card flex flex-col items-center gap-1 px-2 py-3 text-center">
      <span className={cn('vm-chip-ico', `vm-ico-${cor}`)}><Icon className="h-5 w-5" /></span>
      <span className="font-display text-xl font-extrabold leading-none text-navy-900">{valor}</span>
      <span className="text-[11px] font-medium text-navy-500">{rotulo}</span>
    </div>
  );
}

/** Cartão de seção branco com título opcional. */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('vm-card p-4', className)}>{children}</div>;
}

/** Barra de progresso (ocupação, etc.). */
export function Barra({ pct, className }: { pct: number; className?: string }) {
  const v = Math.max(0, Math.min(100, pct));
  return (
    <div className={cn('h-2.5 w-full overflow-hidden rounded-full bg-navy-100', className)}>
      <div className="h-full rounded-full bg-gradient-to-r from-mint-400 to-mint-600 transition-all" style={{ width: `${v}%` }} />
    </div>
  );
}

/** Linha "label → valor" para listas de detalhe. */
export function LinhaValor({ icon: Icon, cor = 'green', label, valor }: {
  icon: LucideIcon; cor?: string; label: string; valor: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className={cn('vm-chip-ico', `vm-ico-${cor}`)}><Icon className="h-5 w-5" /></span>
      <span className="flex-1 text-sm text-navy-600">{label}</span>
      <span className="font-display font-bold text-navy-900">{valor}</span>
    </div>
  );
}

/** Estado vazio (sem dados reais ainda): ícone, título, texto e ação opcional. */
export function EstadoVazio({ icon: Icon, titulo, texto, acao }: {
  icon: LucideIcon; titulo: string; texto: string; acao?: ReactNode;
}) {
  return (
    <div className="vm-card flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-mint-50 text-mint-600">
        <Icon className="h-8 w-8" />
      </span>
      <p className="mt-1 font-display text-lg font-bold text-navy-900">{titulo}</p>
      <p className="max-w-xs text-sm text-navy-500">{texto}</p>
      {acao && <div className="mt-3 w-full">{acao}</div>}
    </div>
  );
}

/** Cabeçalho de sub-tela (voltar + título + ação). */
export function SubHeader({ titulo, onVoltar, acao }: { titulo: string; onVoltar?: () => void; acao?: ReactNode }) {
  return (
    <div className="vm-grad px-4 pb-5 pt-[calc(env(safe-area-inset-top)+0.75rem)] text-white">
      <div className="vm-screen flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {onVoltar && (
            <button onClick={onVoltar} className="grid h-8 w-8 place-items-center rounded-full bg-white/15" aria-label="Voltar">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          )}
          <h1 className="font-display text-lg font-bold">{titulo}</h1>
        </div>
        {acao}
      </div>
    </div>
  );
}
