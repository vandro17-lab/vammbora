import { cn } from '@/lib/utils';

const PARES = [
  { carro: '#2f52a0', faixa: '#3cc394' },
  { carro: '#1ba67a', faixa: '#7c9cd6' },
  { carro: '#213d7d', faixa: '#a8eccf' },
  { carro: '#128563', faixa: '#adc3e7' },
];

function seed(s: string): number {
  return [...s].reduce((acc, c) => acc + c.charCodeAt(0), 0);
}

/**
 * Ilustração original de uma van (substitui "foto do veículo" na demo).
 * Cores variam conforme o nome, para diferenciar os cards.
 */
export function VanIllustration({ seedKey, className }: { seedKey: string; className?: string }) {
  const { carro, faixa } = PARES[seed(seedKey) % PARES.length];
  return (
    <div className={cn('relative overflow-hidden bg-navy-100', className)}>
      <svg viewBox="0 0 320 180" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={`sky-${seedKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d6e2f4" />
            <stop offset="100%" stopColor="#eef3fb" />
          </linearGradient>
        </defs>
        <rect width="320" height="180" fill={`url(#sky-${seedKey})`} />
        {/* chão */}
        <rect y="138" width="320" height="42" fill="#c7d6ec" />
        <rect y="138" width="320" height="4" fill="#b0c4e0" />
        {/* van */}
        <g>
          <rect x="66" y="62" width="188" height="70" rx="16" fill={carro} />
          <rect x="74" y="74" width="60" height="34" rx="8" fill="#eef3fb" />
          <rect x="142" y="74" width="46" height="34" rx="8" fill="#eef3fb" />
          <rect x="196" y="74" width="40" height="34" rx="8" fill="#eef3fb" />
          <rect x="66" y="116" width="188" height="10" fill={faixa} />
          <circle cx="104" cy="134" r="16" fill="#0b1f3a" />
          <circle cx="104" cy="134" r="7" fill="#eef3fb" />
          <circle cx="216" cy="134" r="16" fill="#0b1f3a" />
          <circle cx="216" cy="134" r="7" fill="#eef3fb" />
        </g>
      </svg>
    </div>
  );
}
