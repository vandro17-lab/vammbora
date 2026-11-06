import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useAppAssets } from '@/lib/vm/useAppAssets';

/**
 * Renderiza a arte publicada de um slot de ILUSTRAÇÃO; se não houver, mostra o
 * fallback (visual atual). O container de posicionamento fica na tela que usa.
 */
export function SlotIlustracao({ slot, fallback, alt, className }: {
  slot: string; fallback: ReactNode; alt: string; className?: string;
}) {
  const { url } = useAppAssets();
  const u = url(slot);
  if (!u) return <>{fallback}</>;
  return <img src={u} alt={alt} draggable={false} loading="lazy" className={cn('h-full w-full object-contain', className)} />;
}

/** Idem para um slot de ÍCONE (renderizado dentro do quadradinho colorido). */
export function SlotIcone({ slot, fallback, className }: {
  slot: string; fallback: ReactNode; className?: string;
}) {
  const { url } = useAppAssets();
  const u = url(slot);
  if (!u) return <>{fallback}</>;
  return <img src={u} alt="" draggable={false} loading="lazy" className={cn('h-full w-full object-contain', className)} />;
}
