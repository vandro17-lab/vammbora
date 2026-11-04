import { Link } from 'react-router-dom';
import { Logo } from '@/components/brand/Logo';

export function Footer() {
  return (
    <footer className="mt-20 bg-navy-900 text-navy-100">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <Logo variant="light" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-navy-300">
            Conectamos famílias e estudantes de Araçatuba a vans com rota compatível, horário e vaga
            — com contato direto e transparente.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white">Para famílias</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-navy-300">
            <li>
              <a href="/#busca" className="hover:text-white">
                Buscar van
              </a>
            </li>
            <li>
              <a href="/#como-funciona" className="hover:text-white">
                Como funciona
              </a>
            </li>
            <li>
              <a href="/#duvidas" className="hover:text-white">
                Dúvidas frequentes
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white">Para motoristas</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-navy-300">
            <li>
              <Link to="/motorista" className="hover:text-white">
                Cadastrar minha van
              </Link>
            </li>
            <li>
              <Link to="/motorista" className="hover:text-white">
                Preencher assentos
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white">Projeto</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-navy-300">
            <li>Van Bora · Fatec Araçatuba</li>
            <li>Ideathon Fatec 2026</li>
            <li>Cidade piloto: Araçatuba/SP</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-navy-800">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-6 text-xs text-navy-400 sm:flex-row">
          <p>© {new Date().getFullYear()} Vambora — protótipo acadêmico.</p>
          <p>
            Protótipo com dados de <strong className="text-navy-200">demonstração</strong>. Não
            representa serviço contratável ainda.
          </p>
        </div>
      </div>
    </footer>
  );
}
