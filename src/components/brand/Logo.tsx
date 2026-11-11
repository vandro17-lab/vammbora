import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  /** Mantido por compatibilidade: a logo oficial tem fundo preto e serve em qualquer superfície. */
  variant?: 'light' | 'dark';
  /** false = só o emblema (espaços pequenos). */
  showWordmark?: boolean;
  /** Altura da arte, em classes utilitárias (padrão: h-8). */
  altura?: string;
}

/**
 * LOGO OFICIAL do VanBora (arte em public/brand, gerada por `npm run icons` a
 * partir de `vanbora-logo.png`, sem redesenho).
 *
 * A arte oficial é sobre PRETO, sem transparência: por isso ela vai sempre
 * dentro de uma placa preta de cantos arredondados — some em cabeçalhos
 * pretos e continua íntegra em fundos claros.
 */
export function Logo({ className, showWordmark = true, altura = 'h-8' }: LogoProps) {
  return (
    <span className={cn('inline-flex shrink-0 items-center rounded-xl bg-black px-2 py-1', className)}>
      <img
        src={showWordmark ? '/brand/vanbora-horizontal.png' : '/brand/vanbora-emblema.png'}
        alt="VanBora" draggable={false} decoding="async"
        className={cn(altura, 'w-auto select-none')}
      />
    </span>
  );
}

/** Emblema oficial (triângulo + van escolar), para espaços pequenos. */
export function VanMark({ className }: { className?: string }) {
  return <Logo showWordmark={false} className={cn('!p-0.5', className)} altura="h-full" />;
}

/** Logo oficial completa (emblema, nome e assinatura), para aberturas e telas de entrada. */
export function LogoCompleta({ className }: { className?: string }) {
  return <img src="/brand/vanbora-logo.png" alt="VanBora — mais vagas, mais conexões" draggable={false} decoding="async" className={cn('h-auto w-full select-none', className)} />;
}
