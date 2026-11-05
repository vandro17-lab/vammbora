import { Link, Navigate } from 'react-router-dom';
import { Loader2, LogOut, ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { useAuth } from '@/lib/auth';
import { USE_SUPABASE } from '@/lib/supabase';

/**
 * Só deixa entrar quem está logado (modo Supabase). No modo demonstração
 * (sem Supabase), o painel abre livremente com dados locais, para o motorista
 * conhecer o fluxo sem criar conta.
 */
export function ExigirMotorista({ children }: { children: React.ReactNode }) {
  const { session, carregando } = useAuth();
  if (!USE_SUPABASE) return <>{children}</>;
  if (carregando)
    return (
      <div className="flex min-h-dvh items-center justify-center text-navy-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  if (!session) return <Navigate to="/motorista/conta" replace />;
  return <>{children}</>;
}

export function MotoristaShell({
  children,
  titulo,
  voltarPara,
}: {
  children: React.ReactNode;
  titulo?: string;
  voltarPara?: string;
}) {
  const { sair, session } = useAuth();
  return (
    <div className="min-h-dvh bg-navy-50">
      <header className="sticky top-0 z-30 border-b border-navy-100 bg-white/95 backdrop-blur">
        <div className="container-page flex h-16 items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {voltarPara ? (
              <Link to={voltarPara} className="btn btn-sm btn-ghost" aria-label="Voltar">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            ) : (
              <Link to="/" aria-label="Início">
                <Logo />
              </Link>
            )}
            {titulo && <span className="font-display font-bold text-navy-900">{titulo}</span>}
          </div>
          {USE_SUPABASE && session && (
            <button className="btn btn-sm btn-ghost" onClick={sair}>
              <LogOut className="h-4 w-4" /> Sair
            </button>
          )}
        </div>
      </header>
      <main className="container-page py-6">{children}</main>
    </div>
  );
}
