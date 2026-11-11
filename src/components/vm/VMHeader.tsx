import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { CaretLeft, Bell } from '@phosphor-icons/react';
import { Logo } from '@/components/brand/Logo';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import { VanEscolar } from '@/components/vm/VanEscolar';
import { SlotIlustracao } from '@/components/vm/SlotImagem';
import { TextoEditavel } from '@/components/vm/TextoEditavel';
import type { TextoDef } from '@/data/ui-config';

/**
 * Cabeçalho premium de seção do app Vambora Motoristas (fiel à referência):
 * faixa em gradiente verde/teal com borda inferior em CURVA orgânica, linha da
 * marca (logo oficial VanBora) e sino à direita, van escolar ao fundo,
 * e o título com ícone + subtítulo. Reutilizável pelas telas de aba.
 */
export function VMSectionHeader({
  icon: Icon, titulo, subtitulo, acao, voltarPara = '/app', tituloKey, subtituloKey,
}: {
  icon: PhosphorIcon; titulo: string; subtitulo: string; acao?: ReactNode; voltarPara?: string | null;
  /** Chaves estáveis p/ tornar título/subtítulo editáveis no modo admin (opcional). */
  tituloKey?: string; subtituloKey?: string;
}) {
  const navigate = useNavigate();
  const defTitulo: TextoDef | null = tituloKey
    ? { key: tituloKey, padrao: titulo, conteudoEditavel: true, base: { tamanhoPx: 27, peso: 800, cor: '#ffffff', alinhamento: 'left' } } : null;
  const defSub: TextoDef | null = subtituloKey
    ? { key: subtituloKey, padrao: subtitulo, conteudoEditavel: true, base: { tamanhoPx: 13, peso: 500, cor: '#eafff5', alinhamento: 'left' } } : null;
  return (
    <header className="vm-grad relative isolate overflow-hidden px-5 pb-11 pt-[calc(env(safe-area-inset-top)+0.7rem)] text-white">
      {/* Van escolar (identidade), grande, ao fundo-direita. Slot editável (fallback: vetor). */}
      <div className="pointer-events-none absolute -right-3 top-8 w-44 drop-shadow-xl">
        <SlotIlustracao slot="header.van" alt="Van escolar" fallback={<VanEscolar className="w-full opacity-[0.97]" />} />
      </div>
      {/* Brilho suave de topo */}
      <div className="pointer-events-none absolute -left-10 -top-16 h-40 w-40 rounded-full bg-white/10 blur-2xl" />

      <div className="vm-screen relative">
        {/* Linha da marca */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {voltarPara && (
              <button onClick={() => navigate(voltarPara)} aria-label="Voltar"
                className="-ml-1 grid h-8 w-8 place-items-center rounded-full text-white/90 transition active:scale-95">
                <CaretLeft size={22} weight="bold" />
              </button>
            )}
            <Logo altura="h-7" />
          </div>
          {acao ?? (
            <button aria-label="Avisos" className="relative grid h-9 w-9 place-items-center rounded-full bg-white/10 ring-1 ring-white/20 transition active:scale-95">
              <Bell size={20} weight="regular" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-amber-300 ring-2 ring-black" />
            </button>
          )}
        </div>

        {/* Título + subtítulo */}
        <div className="mt-4 max-w-[64%]">
          <div className="flex items-center gap-2">
            <Icon size={30} weight="duotone" className="text-mint-200" />
            {defTitulo
              ? <TextoEditavel def={defTitulo} as="h1" className="font-display text-[27px] font-extrabold leading-none tracking-tight" />
              : <h1 className="font-display text-[27px] font-extrabold leading-none tracking-tight">{titulo}</h1>}
          </div>
          {defSub
            ? <TextoEditavel def={defSub} as="p" className="mt-2 block text-[13px] font-medium leading-snug text-mint-50/90" />
            : <p className="mt-2 text-[13px] font-medium leading-snug text-mint-50/90">{subtitulo}</p>}
        </div>
      </div>

      {/* Borda inferior em curva orgânica (hill) */}
      <svg className="absolute inset-x-0 bottom-[-1px] h-10 w-full" viewBox="0 0 390 40" preserveAspectRatio="none" aria-hidden="true">
        {/* realce verde vivo acompanhando a curva */}
        <path d="M0,14 C120,42 270,42 390,10 L390,24 C270,52 120,52 0,26 Z" fill="#FFC700" opacity="0.95" />
        {/* recorte com a cor do fundo do app */}
        <path d="M0,20 C120,48 270,48 390,16 L390,40 L0,40 Z" fill="var(--vm-surface)" />
      </svg>
    </header>
  );
}
