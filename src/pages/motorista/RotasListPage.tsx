import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Route as RouteIcon, Plus, Loader2, ChevronRight, UserPlus, Copy, AlertCircle } from 'lucide-react';
import { MotoristaShell, ExigirMotorista } from './MotoristaShell';
import { listarRotas, duplicarRota } from '@/data/motorista-store';
import { pendenciasDeRevisao, totalDePendencias } from '@/lib/cadastro-rota';
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
  const [duplicando, setDuplicando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ erro: boolean; texto: string } | null>(null);

  useEffect(() => {
    let vivo = true;
    listarRotas().then((r) => vivo && setRotas(r)).catch(() => {}).finally(() => vivo && setCarregando(false));
    return () => { vivo = false; };
  }, []);

  /** Cópia completa da rota (paradas, alunos, horários, escolas), como rascunho. */
  async function duplicar(r: Rota) {
    setDuplicando(r.id); setAviso(null);
    try {
      const copia = await duplicarRota(r.id);
      setRotas(await listarRotas());
      setAviso({ erro: false, texto: `“${copia.nome}” criada como rascunho, com todos os dados da original.` });
    } catch (e) {
      setAviso({ erro: true, texto: 'Não foi possível duplicar: ' + (e as Error).message });
    } finally {
      setDuplicando(null);
    }
  }

  return (
    <MotoristaShell titulo="Minhas rotas" voltarPara="/painel">
      {aviso && <p role={aviso.erro ? 'alert' : 'status'} className={aviso.erro ? 'mb-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700' : 'mb-4 rounded-xl bg-mint-50 p-3 text-sm text-mint-800'}>{aviso.texto}</p>}
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
          {rotas.map((r) => {
            const pendentes = totalDePendencias(pendenciasDeRevisao(r));
            return (
              <div key={r.id} className="card flex items-center gap-1 p-0">
                <Link to={`/painel/rota/${r.id}`} className="card-interactive flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-4">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-navy-50 text-navy-700"><RouteIcon className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-navy-900">{r.nome || 'Rota'}</p>
                    <p className="text-sm text-navy-500">
                      {r.sentido === 'ida' ? 'Ida' : 'Volta'}{r.turno ? ` · ${TURNO_LABEL[r.turno]}${r.periodoConfirmado ? '' : ' (a confirmar)'}` : ''} · {r.passageiros.length} aluno(s)
                      {' · '}<span className={r.status === 'concluida' && !r.ofertaPausada ? 'text-mint-700' : 'text-amber-700'}>{r.status !== 'concluida' ? 'rascunho' : r.ofertaPausada ? 'concluída · oferta pausada' : 'concluída'}</span>
                    </p>
                    {pendentes > 0 && (
                      <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        <AlertCircle className="h-3.5 w-3.5" /> Precisa de revisão ({pendentes})
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-navy-300" />
                </Link>
                <button type="button" className="btn btn-sm btn-ghost mr-2 !px-2.5" aria-label={`Duplicar ${r.nome || 'rota'}`} title="Duplicar rota" disabled={duplicando !== null} onClick={() => duplicar(r)}>
                  {duplicando === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            );
          })}
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
