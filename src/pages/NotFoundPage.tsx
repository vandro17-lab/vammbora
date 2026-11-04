import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <Compass className="h-14 w-14 text-navy-300" />
      <h1 className="mt-6 font-display text-3xl font-bold">Página não encontrada</h1>
      <p className="mt-2 max-w-md text-navy-600">
        Essa rota saiu do trajeto. Volte para a página inicial e faça uma nova busca.
      </p>
      <Link to="/" className="btn btn-lg btn-primary mt-6">
        Voltar ao início
      </Link>
    </div>
  );
}
