import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ROTAS_PRE_LANCAMENTO } from '@/lib/interesse';

/**
 * Moldura das páginas públicas do pré-lançamento (início, formulários,
 * confirmação e privacidade). Independente do cabeçalho, do menu e do rodapé
 * do aplicativo: só a marca oficial, o conteúdo e o link da política.
 */
export function PaginaPublica({ children, voltar = false }: { children: ReactNode; voltar?: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#F5F5F5] text-black">
      <header className="bg-black">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-5">
          <Link to={ROTAS_PRE_LANCAMENTO.inicio} aria-label="VanBora — página inicial" className="rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#FFC700]">
            <img src="/brand/vanbora-horizontal.png" alt="VanBora" width={1013} height={240} className="h-9 w-auto select-none" draggable={false} />
          </Link>
          {voltar && (
            <Link to={ROTAS_PRE_LANCAMENTO.inicio} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-white hover:text-[#FFC700] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFC700]">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Início
            </Link>
          )}
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="px-5 pb-8 pt-6 text-center text-sm text-neutral-600">
        <p>VanBora — Mais vagas, mais conexões.</p>
        <p className="mt-1">
          <Link to={ROTAS_PRE_LANCAMENTO.privacidade} className="underline underline-offset-2 hover:text-black">Política de Privacidade</Link>
        </p>
      </footer>
    </div>
  );
}
