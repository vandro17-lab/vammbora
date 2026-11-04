import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  /** Cor do texto. 'light' para fundos escuros, 'dark' para fundos claros. */
  variant?: 'light' | 'dark';
  showWordmark?: boolean;
}

/** Ícone de van simplificado — logo original do Vambora (SVG). */
export function VanMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label="Vambora"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="48" height="48" rx="12" fill="#0b1f3a" />
      {/* corpo da van */}
      <path
        d="M9 29c0-1 .4-1.9 1.1-2.6l3.4-3.4c.6-.6 1.5-1 2.4-1h15.3c.8 0 1.6.3 2.2.9l4.3 4.1c.6.6 1 1.4 1 2.3V33a2 2 0 0 1-2 2h-1.2"
        stroke="#3cc394"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9 29v4a2 2 0 0 0 2 2h1.3" stroke="#3cc394" strokeWidth="2.4" strokeLinecap="round" />
      {/* janelas */}
      <path
        d="M16.5 23.5v4.2M23 23.5v4.2"
        stroke="#7c9cd6"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* rodas */}
      <circle cx="16" cy="35" r="3.1" fill="#0b1f3a" stroke="#eef3fb" strokeWidth="2.2" />
      <circle cx="33" cy="35" r="3.1" fill="#0b1f3a" stroke="#eef3fb" strokeWidth="2.2" />
    </svg>
  );
}

export function Logo({ className, variant = 'dark', showWordmark = true }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <VanMark className="h-9 w-9 shrink-0" />
      {showWordmark && (
        <span
          className={cn(
            'font-display text-xl font-extrabold tracking-tight',
            variant === 'light' ? 'text-white' : 'text-navy-900',
          )}
        >
          Vam<span className="text-mint-500">bora</span>
        </span>
      )}
    </span>
  );
}
