import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Route as RouteIcon, Plus, Loader2, ChevronRight, UserPlus } from 'lucide-react';
import { MotoristaShell, ExigirMotorista } from './MotoristaShell';
import { listarRotas } from '@/data/motorista-store';
import type { Rota } from '@/types/motorista';
import { TURNO_LABEL } from '@/lib/utils';

export function RotasListPage() {
  return (
    <ExigirMotorista>
      <Lista />
    </ExigirMotorista>
  );
}

function Lista() {
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    listarRotas().then((r) => vivo && setRotas(r)).catch(() => {}).finally(() => vivo && setCarregando(false));
    return () => { vivo = false; };
  }, []);

  return (
    <MotoristaShell titulo="Minhas rotas" voltarPara="/painel">
      {carregando ? (
        <div className="flex justify-center py-16 text-navy-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : rotas.length === 0 ? (
        <div className="card p-8 text-center">
          <RouteIcon className="mx-auto h-10 w-10 text-navy-300" />
          <h2 className="mt-3 font-display text-lg font-bold">Monte a rota que você já faz</h2>
          <p className="mt-2 text-navy-600">Você vai ver os alunos entrando e saindo da van, parada por parada.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rotas.map((r) => (
            <Link key={r.id} to={`/painel/rota/${r.id}`} className="card card-interactive flex items-center gap-3 p-4">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-navy-50 text-navy-700"><RouteIcon className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-navy-900">{r.nome || 'Rota'}</p>
                <p className="text-sm text-navy-500">
                  {r.sentido === 'ida' ? 'Ida' : 'Volta'}{r.turno ? ` · ${TURNO_LABEL[r.turno]}` : ''} · {r.passageiros.length} aluno(s)
                  {' · '}<span className={r.status === 'concluida' ? 'text-mint-700' : 'text-amber-700'}>{r.status === 'concluida' ? 'concluída' : 'rascunho'}</span>
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-navy-300" />
            </Link>
          ))}
        </div>
      )}
      <Link to="/painel/rota/nova" className="btn btn-lg btn-primary mt-5 flex w-full">
        <Plus className="h-5 w-5" /> Criar rota
      </Link>
      {rotas.length > 0 && (
        <Link to="/painel/simulador" className="btn btn-lg btn-ghost mt-3 flex w-full">
          <UserPlus className="h-5 w-5" /> Simular novo aluno
        </Link>
      )}
    </MotoristaShell>
  );
}
