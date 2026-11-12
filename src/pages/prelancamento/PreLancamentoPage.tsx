import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { LogoCompleta } from '@/components/brand/Logo';
import { ROTAS_PRE_LANCAMENTO } from '@/lib/interesse';
import { IlustracaoFamilia, IlustracaoVan } from './Ilustracoes';

/**
 * Página inicial do PRÉ-LANÇAMENTO: apresenta a marca e os dois caminhos
 * (motorista / família). Não mostra resultados nem afirma que o serviço já
 * funciona — os dois cartões levam aos formulários de interesse.
 */
export function PreLancamentoPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-[#F5F5F5] text-black">
      <header className="bg-black px-5 pb-24 pt-10 text-center text-white sm:pt-14">
        <div className="mx-auto max-w-xl">
          <LogoCompleta className="mx-auto w-44 sm:w-52" />
          <p className="sr-only">VanBora — Mais vagas, mais conexões.</p>
          <p className="mt-6 inline-flex items-center rounded-full bg-[#FFC700] px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-black">
            Pré-lançamento
          </p>
          <h1 className="mt-4 font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Estamos chegando a Araçatuba!
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-neutral-200 sm:text-lg">
            Uma nova maneira de conectar famílias e motoristas de transporte escolar. Faça parte dessa novidade desde o começo.
          </p>
        </div>
      </header>

      <main className="mx-auto -mt-16 w-full max-w-3xl flex-1 px-5">
        <h2 className="sr-only">Escolha seu perfil</h2>
        <div className="grid gap-5 md:grid-cols-2">
          <CartaoPerfil
            para={ROTAS_PRE_LANCAMENTO.motorista}
            ilustracao={<IlustracaoVan className="h-16 w-24" />}
            titulo="Sou motorista"
            descricao="Quero divulgar minha van, preencher vagas e encontrar novas oportunidades."
            acao="Quero participar"
          />
          <CartaoPerfil
            para={ROTAS_PRE_LANCAMENTO.familia}
            ilustracao={<IlustracaoFamilia className="h-16 w-24" />}
            titulo="Quero contratar uma van"
            descricao="Quero encontrar transporte escolar para minha família."
            acao="Encontrar uma van"
          />
        </div>
        <p className="mx-auto mt-6 max-w-md text-center text-sm leading-relaxed text-neutral-600">
          O aplicativo ainda não foi lançado. Por enquanto, registramos o seu interesse para avisar quando houver novidades.
        </p>
      </main>

      <footer className="px-5 pb-8 pt-8 text-center text-sm text-neutral-600">
        <p>VanBora — Mais vagas, mais conexões.</p>
        <p className="mt-1">
          <Link to={ROTAS_PRE_LANCAMENTO.privacidade} className="underline underline-offset-2 hover:text-black">Política de Privacidade</Link>
        </p>
      </footer>
    </div>
  );
}

function CartaoPerfil({ para, ilustracao, titulo, descricao, acao }: {
  para: string; ilustracao: ReactNode; titulo: string; descricao: string; acao: string;
}) {
  return (
    <Link
      to={para}
      className="group flex h-full flex-col rounded-3xl bg-white p-6 shadow-[0_10px_30px_rgb(0_0_0/0.10)] ring-1 ring-black/5 transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FFC700] active:translate-y-0 sm:p-7"
    >
      <span className="flex h-24 w-full items-center justify-center rounded-2xl bg-[#F5F5F5]">{ilustracao}</span>
      <span className="mt-5 block font-display text-2xl font-extrabold tracking-tight">{titulo}</span>
      <span className="mt-2 block flex-1 text-base leading-relaxed text-neutral-700">{descricao}</span>
      <span className="mt-6 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[#FFC700] px-6 text-base font-bold text-black transition-colors group-hover:bg-[#E6B300]">
        {acao} <ArrowRight className="h-5 w-5" aria-hidden="true" />
      </span>
    </Link>
  );
}
