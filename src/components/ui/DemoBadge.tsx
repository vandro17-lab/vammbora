import { FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Selo de demonstração — cumpre a regra do Ideathon de identificar
 * dados explicitamente simulados, de forma discreta e profissional.
 */
export function DemoBadge({ className, texto }: { className?: string; texto?: string }) {
  return (
    <span className={cn('demo-ribbon', className)} title="Dados de demonstração">
      <FlaskConical className="h-3.5 w-3.5" />
      {texto ?? 'Demonstração'}
    </span>
  );
}
