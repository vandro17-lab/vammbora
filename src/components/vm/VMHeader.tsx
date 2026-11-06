import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { CaretLeft, Bell, Check } from '@phosphor-icons/react';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import { VanEscolar } from '@/components/vm/VanEscolar';

/**
 * Cabeçalho premium de seção do app Vambora Motoristas (fiel à referência):
 * faixa em gradiente verde/teal com cantos inferiores arredondados, linha da
 * marca (check + "Vambora Motoristas") e sino à direita, van escolar ao fundo,
 * e o título com ícone + subtítulo. Reutilizável pelas telas de aba.
 */
export function VMSectionHeader({
  icon: Icon, titulo, subtitulo, acao, voltarPara = '/app',
}: {
  icon: PhosphorIcon; titulo: string; subtitulo: string; acao?: ReactNode; voltarPara?: string | null;
}) {
  const navigate = useNavigate();
  return (
    <header className="vm-grad relative overflow-hidden rounded-b-[1.75rem] px-5 pb-6 pt-[calc(env(safe-area-inset-top)+0.6rem)] text-white">
      {/* Van escolar ao fundo (identidade), discreta atrás do conteúdo */}
      <VanEscolar className="pointer-events-none absolute right-1 top-9 w-36 opacity-95 drop-shadow-lg" />
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
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-white shadow-sm">
              <Check size={18} weight="bold" className="text-mint-600" />
            </span>
            <span className="font-display text-[15px] font-extrabold leading-[1.05] tracking-tight">
              Vambora<br />Motoristas
            </span>
          </div>
          {acao ?? (
            <button aria-label="Avisos" className="relative grid h-9 w-9 place-items-center rounded-full bg-white/15 ring-1 ring-white/20 transition active:scale-95">
              <Bell size={20} weight="fill" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-amber-300 ring-2 ring-[#0f8a66]" />
            </button>
          )}
        </div>

        {/* Título + subtítulo */}
        <div className="mt-3.5 max-w-[66%]">
          <div className="flex items-center gap-2">
            <Icon size={30} weight="duotone" className="text-mint-200" />
            <h1 className="font-display text-[26px] font-extrabold leading-none tracking-tight">{titulo}</h1>
          </div>
          <p className="mt-2 text-[13px] font-medium leading-snug text-mint-50/90">{subtitulo}</p>
        </div>
      </div>
    </header>
  );
}
