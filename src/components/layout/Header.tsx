import { Link, NavLink } from 'react-router-dom';
import { Download, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Logo } from '@/components/brand/Logo';
import { useInstallPrompt } from '@/pwa/useInstallPrompt';
import { cn } from '@/lib/utils';

const LINKS = [
  { to: '/#como-funciona', label: 'Como funciona' },
  { to: '/#duvidas', label: 'Dúvidas' },
];

export function Header() {
  const [aberto, setAberto] = useState(false);
  const { podeInstalar, instalar } = useInstallPrompt();

  return (
    <header className="sticky top-0 z-40 border-b border-navy-100/70 bg-white/95 backdrop-blur-md">
      <div className="container-page flex h-20 items-center justify-between gap-4">
        <Link to="/" aria-label="Página inicial VanBora">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Navegação principal">
          {LINKS.map((l) => (
            <a
              key={l.to}
              href={l.to}
              className="text-sm font-medium text-navy-600 transition-colors hover:text-navy-900"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {podeInstalar && (
            <button className="btn btn-sm btn-ghost" onClick={instalar}>
              <Download className="h-4 w-4" />
              Instalar VanBora
            </button>
          )}
          <a
            href="/pesquisa-validacao.html"
            className="btn btn-sm btn-ghost whitespace-nowrap px-2 text-[11px]"
          >
            Pesquisa de validação de ideia
          </a>
          <NavLink to="/motorista" className="btn btn-sm btn-navy">
            Sou motorista
          </NavLink>
        </div>

        <button
          className="btn btn-sm btn-ghost md:hidden"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          aria-label={aberto ? 'Fechar menu' : 'Abrir menu'}
        >
          {aberto ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Menu mobile */}
      <div
        className={cn(
          'overflow-hidden border-t border-navy-100 bg-white transition-all md:hidden',
          aberto ? 'max-h-96' : 'invisible max-h-0 border-t-0',
        )}
      >
        <div className="container-page flex flex-col gap-1 py-3">
          {LINKS.map((l) => (
            <a
              key={l.to}
              href={l.to}
              onClick={() => setAberto(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-navy-700 hover:bg-navy-50"
            >
              {l.label}
            </a>
          ))}
          {podeInstalar && (
            <button
              className="btn btn-md btn-ghost mt-1 justify-start"
              onClick={() => {
                setAberto(false);
                instalar();
              }}
            >
              <Download className="h-4 w-4" />
              Instalar VanBora
            </button>
          )}
          <a
            href="/pesquisa-validacao.html"
            onClick={() => setAberto(false)}
            className="btn btn-md btn-ghost mt-1 justify-start text-xs"
          >
            Pesquisa de validação de ideia
          </a>
          <Link to="/motorista" onClick={() => setAberto(false)} className="btn btn-md btn-navy mt-1">
            Sou motorista
          </Link>
        </div>
      </div>
    </header>
  );
}
