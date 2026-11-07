import { useCallback, useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import {
  Loader2,
  LogOut,
  Users,
  Inbox,
  Eye,
  EyeOff,
  ShieldCheck,
  FlaskConical,
  RefreshCw,
} from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { useAuth } from '@/lib/auth';
import { USE_SUPABASE } from '@/lib/supabase';
import {
  adminListarMotoristas,
  adminListarInteressados,
  adminAtualizarMotorista,
  type MotoristaAdmin,
  type InteressadoAdmin,
} from '@/data/source';

export function AdminPage() {
  const { session, isAdmin, verificandoAdmin, carregando, sair } = useAuth();

  if (!USE_SUPABASE) return <AdminAviso texto="O painel precisa do banco (Supabase) configurado. Neste ambiente de demonstração ele está desligado." />;
  if (carregando) return <AdminCarregando />;
  if (!session) return <Navigate to="/admin/login" replace />;
  // Enquanto o papel de admin ainda está sendo verificado, não mostre "sem
  // permissão" (evita o flash antes de a RPC responder).
  if (verificandoAdmin) return <AdminCarregando />;
  if (!isAdmin) return <SemPermissao onSair={sair} email={session.user.email ?? ''} />;

  return <AdminDashboard onSair={sair} />;
}

function AdminShell({ children, onSair }: { children: React.ReactNode; onSair?: () => void }) {
  return (
    <div className="min-h-dvh bg-navy-50">
      <header className="border-b border-navy-100 bg-white">
        <div className="container-page flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="chip bg-navy-900 text-white">Admin</span>
          </div>
          {onSair && (
            <button className="btn btn-sm btn-ghost" onClick={onSair}>
              <LogOut className="h-4 w-4" /> Sair
            </button>
          )}
        </div>
      </header>
      <main className="container-page py-8">{children}</main>
    </div>
  );
}

function AdminCarregando() {
  return (
    <AdminShell>
      <div className="flex items-center justify-center py-32 text-navy-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    </AdminShell>
  );
}

function AdminAviso({ texto }: { texto: string }) {
  return (
    <AdminShell>
      <div className="card mx-auto max-w-lg p-8 text-center">
        <p className="text-navy-600">{texto}</p>
        <Link to="/" className="btn btn-md btn-navy mt-5">
          Voltar ao site
        </Link>
      </div>
    </AdminShell>
  );
}

function SemPermissao({ onSair, email }: { onSair: () => void; email: string }) {
  return (
    <AdminShell onSair={onSair}>
      <div className="card mx-auto max-w-lg p-8 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-3 font-display text-xl font-bold">Acesso ainda não liberado</h1>
        <p className="mt-2 text-navy-600">
          Você está logado como <strong>{email}</strong>, mas sua conta ainda não tem papel de
          administrador. Peça para a equipe liberar seu acesso.
        </p>
      </div>
    </AdminShell>
  );
}

function AdminDashboard({ onSair }: { onSair: () => void }) {
  const [motoristas, setMotoristas] = useState<MotoristaAdmin[]>([]);
  const [interessados, setInteressados] = useState<InteressadoAdmin[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [erroCarregar, setErroCarregar] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErroCarregar(false);
    try {
      const [m, i] = await Promise.all([adminListarMotoristas(), adminListarInteressados()]);
      setMotoristas(m);
      setInteressados(i);
    } catch {
      setErroCarregar(true);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  async function aplicar(
    id: string,
    patch: Partial<Pick<MotoristaAdmin, 'is_published' | 'is_suspended' | 'seats_available'>>,
  ) {
    setSalvandoId(id);
    setAviso(null);
    const r = await adminAtualizarMotorista(id, patch);
    if (r.ok) {
      await recarregar();
      setAviso({ tipo: 'ok', texto: 'Alteração salva.' });
    } else {
      setAviso({ tipo: 'erro', texto: `Não foi possível salvar: ${r.erro ?? 'erro desconhecido'}` });
    }
    setSalvandoId(null);
  }

  const alternar = (
    id: string,
    patch: Partial<Pick<MotoristaAdmin, 'is_published' | 'is_suspended' | 'seats_available'>>,
  ) => aplicar(id, patch);
  const salvarVagas = (id: string, valor: number) =>
    aplicar(id, { seats_available: Math.max(0, valor) });

  return (
    <AdminShell onSair={onSair}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Painel de administração</h1>
          <p className="mt-1 text-sm text-navy-500">Gerencie motoristas e veja interessados.</p>
        </div>
        <button className="btn btn-sm btn-ghost" onClick={recarregar} disabled={carregando}>
          <RefreshCw className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      {/* Feedback de gravação */}
      {aviso && (
        <p
          role="status"
          className={`mt-4 rounded-xl p-3 text-sm ${
            aviso.tipo === 'ok' ? 'bg-mint-50 text-mint-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {aviso.texto}
        </p>
      )}

      {/* Falha de carregamento */}
      {erroCarregar && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          <span>Não foi possível carregar os dados (falha de conexão).</span>
          <button className="btn btn-sm btn-navy" onClick={recarregar}>
            <RefreshCw className="h-4 w-4" /> Tentar de novo
          </button>
        </div>
      )}

      {/* Resumo */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <ResumoCard Icone={Users} rotulo="Motoristas" valor={motoristas.length} />
        <ResumoCard
          Icone={Eye}
          rotulo="Publicados"
          valor={motoristas.filter((m) => m.is_published && !m.is_suspended).length}
        />
        <ResumoCard Icone={Inbox} rotulo="Interessados" valor={interessados.length} />
      </div>

      {/* Motoristas */}
      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg font-bold">Motoristas</h2>
        <div className="card overflow-hidden">
          {carregando && motoristas.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-navy-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : motoristas.length === 0 ? (
            <p className="p-6 text-center text-sm text-navy-500">Nenhum motorista cadastrado.</p>
          ) : (
            <div className="divide-y divide-navy-100">
              {motoristas.map((m) => {
                const visivel = m.is_published && !m.is_suspended;
                const salvando = salvandoId === m.id;
                return (
                  <div key={m.id} className="flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold text-navy-900">{m.name}</span>
                        {m.is_demo && (
                          <span className="chip bg-amber-100 text-amber-800">
                            <FlaskConical className="h-3 w-3" /> demo
                          </span>
                        )}
                        <span
                          className={`chip ${visivel ? 'bg-mint-100 text-mint-800' : 'bg-navy-100 text-navy-500'}`}
                        >
                          {visivel ? 'Visível' : 'Oculto'}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-navy-400">
                        {m.slug} · nota {Number(m.rating_avg).toFixed(1)}
                      </p>
                    </div>

                    {/* Vagas */}
                    <label className="flex items-center gap-1.5 text-sm text-navy-600">
                      Vagas
                      <input
                        type="number"
                        min={0}
                        max={m.capacity_total}
                        defaultValue={m.seats_available}
                        className="h-9 w-16 rounded-lg border border-navy-200 px-2 text-center"
                        disabled={salvando}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (v !== m.seats_available) salvarVagas(m.id, v);
                        }}
                      />
                    </label>

                    {/* Publicar/ocultar */}
                    <button
                      className="btn btn-sm btn-ghost"
                      disabled={salvando}
                      onClick={() => alternar(m.id, { is_suspended: visivel ? true : false, is_published: true })}
                      title={visivel ? 'Ocultar da vitrine' : 'Mostrar na vitrine'}
                    >
                      {salvando ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : visivel ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                      {visivel ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Interessados */}
      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg font-bold">
          Interessados (lista de espera)
        </h2>
        <div className="card overflow-hidden">
          {interessados.length === 0 ? (
            <p className="p-6 text-center text-sm text-navy-500">
              Nenhum interessado registrado ainda.
            </p>
          ) : (
            <div className="divide-y divide-navy-100">
              {interessados.map((i) => (
                <div key={i.id} className="flex flex-wrap items-center gap-2 p-4 text-sm">
                  <span className="font-semibold text-navy-900">{i.contact_name}</span>
                  <span className="text-navy-500">{i.contact_whatsapp}</span>
                  {i.region && <span className="chip bg-navy-50 text-navy-600">{i.region}</span>}
                  <span className="ml-auto text-xs text-navy-400">
                    {new Date(i.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </AdminShell>
  );
}

function ResumoCard({
  Icone,
  rotulo,
  valor,
}: {
  Icone: typeof Users;
  rotulo: string;
  valor: number;
}) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-navy-50 text-navy-700">
        <Icone className="h-5 w-5" />
      </span>
      <div>
        <p className="font-display text-2xl font-bold leading-none">{valor}</p>
        <p className="mt-1 text-xs text-navy-500">{rotulo}</p>
      </div>
    </div>
  );
}
