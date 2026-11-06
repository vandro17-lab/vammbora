import type { ReactNode } from 'react';
import { PencilSimpleLine } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useAppAssets } from '@/lib/vm/useAppAssets';
import { useEdicaoAparencia } from '@/lib/vm/useEdicaoAparencia';
import { slotPorId } from '@/lib/vm/slots';

/**
 * Resolve a URL vigente de um slot: prévia LOCAL não publicada (durante a edição)
 * tem prioridade sobre a arte publicada. Fora do modo de edição, `previa` é sempre
 * vazia — o comportamento é idêntico ao anterior.
 */
function useUrlDoSlot(slot: string): string | undefined {
  const { url } = useAppAssets();
  const { previaDe } = useEdicaoAparencia();
  return previaDe(slot) ?? url(slot);
}

/**
 * Envolve o conteúdo de um slot com o DESTAQUE discreto + alvo de toque do modo
 * "Editar aparência". Fora do modo (ou se o slot não estiver registrado), renderiza
 * o conteúdo sem qualquer wrapper — o layout normal permanece intacto.
 */
function SlotEditavel({ slot, children }: { slot: string; children: ReactNode }) {
  const { ativo, abrirEditor } = useEdicaoAparencia();
  const def = slotPorId(slot);

  if (!ativo || !def) return <>{children}</>;

  // role="button" (não <button>) porque vários slots vivem dentro de botões da
  // tela (banner do Clube, cards de atalho). Evita interativo aninhado inválido e
  // preserva a ação original: só a área da arte abre o editor; o resto navega.
  function abrir(e: { preventDefault: () => void; stopPropagation: () => void }) {
    e.preventDefault();
    e.stopPropagation();
    abrirEditor(def!);
  }

  return (
    <span className="relative block h-full w-full">
      {children}
      <span
        role="button"
        tabIndex={0}
        onClick={abrir}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') abrir(e); }}
        aria-label={`Editar arte: ${def.titulo}`}
        data-slot-editavel={slot}
        className="pointer-events-auto absolute inset-0 z-10 flex cursor-pointer items-start justify-end rounded-[inherit] focus:outline-none focus-visible:ring-2 focus-visible:ring-mint-500"
      >
        <span className="pointer-events-none absolute inset-0 rounded-[inherit] border border-dashed border-mint-400/90 bg-mint-400/10 ring-1 ring-mint-500/20" />
        <span className="pointer-events-none relative m-0.5 grid h-5 w-5 place-items-center rounded-full bg-mint-500 text-white shadow-md ring-2 ring-white">
          <PencilSimpleLine size={11} weight="bold" />
        </span>
      </span>
    </span>
  );
}

/**
 * Renderiza a arte de um slot de ILUSTRAÇÃO; se não houver (nem prévia), mostra o
 * fallback (visual atual). O container de posicionamento fica na tela que usa.
 */
export function SlotIlustracao({ slot, fallback, alt, className }: {
  slot: string; fallback: ReactNode; alt: string; className?: string;
}) {
  const u = useUrlDoSlot(slot);
  return (
    <SlotEditavel slot={slot}>
      {u
        ? <img src={u} alt={alt} draggable={false} loading="lazy" className={cn('h-full w-full object-contain', className)} />
        : <>{fallback}</>}
    </SlotEditavel>
  );
}

/** Idem para um slot de ÍCONE (renderizado dentro do quadradinho colorido). */
export function SlotIcone({ slot, fallback, className }: {
  slot: string; fallback: ReactNode; className?: string;
}) {
  const u = useUrlDoSlot(slot);
  return (
    <SlotEditavel slot={slot}>
      {u
        ? <img src={u} alt="" draggable={false} loading="lazy" className={cn('h-full w-full object-contain', className)} />
        : <>{fallback}</>}
    </SlotEditavel>
  );
}
