import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import type { NivelCompatibilidade } from '@/types';
import { cn } from '@/lib/utils';

const CONFIG: Record<
  NivelCompatibilidade,
  { label: string; classe: string; Icone: typeof CheckCircle2 }
> = {
  disponivel: {
    label: 'Vaga disponível',
    classe: 'bg-mint-100 text-mint-800 ring-1 ring-mint-200',
    Icone: CheckCircle2,
  },
  sob_consulta: {
    label: 'Sob consulta',
    classe: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
    Icone: Clock,
  },
  indisponivel: {
    label: 'Sem encaixe',
    classe: 'bg-navy-100 text-navy-500 ring-1 ring-navy-200',
    Icone: XCircle,
  },
};

export function CompatBadge({
  nivel,
  className,
}: {
  nivel: NivelCompatibilidade;
  className?: string;
}) {
  const { label, classe, Icone } = CONFIG[nivel];
  return (
    <span className={cn('chip', classe, className)}>
      <Icone className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
