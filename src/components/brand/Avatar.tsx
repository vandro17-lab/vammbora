import { cn } from '@/lib/utils';

const GRADIENTES = [
  'from-navy-600 to-navy-800',
  'from-mint-500 to-mint-700',
  'from-navy-500 to-mint-600',
  'from-mint-600 to-navy-700',
  'from-navy-700 to-mint-500',
];

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const a = partes[0]?.[0] ?? '';
  const b = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (a + b).toUpperCase();
}

function seed(nome: string): number {
  return [...nome].reduce((acc, c) => acc + c.charCodeAt(0), 0);
}

/**
 * Avatar ilustrado do motorista — iniciais sobre gradiente da marca.
 * Não usamos fotos de pessoas reais; isto é 100% gerado e seguro de licença.
 */
export function Avatar({ nome, className }: { nome: string; className?: string }) {
  const grad = GRADIENTES[seed(nome) % GRADIENTES.length];
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-gradient-to-br font-display font-bold text-white ring-2 ring-white/70',
        grad,
        className,
      )}
      aria-hidden="true"
    >
      {iniciais(nome)}
    </span>
  );
}
