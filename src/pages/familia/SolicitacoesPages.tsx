import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Loader2, Plus, ClipboardList, MapPin, Clock, School, Lock, CheckCircle2 } from 'lucide-react';
import { VMShell } from '@/components/vm/VMShell';
import { Card, SubHeader, AvisoErro, EstadoVazio } from '@/components/vm/ui';
import { useAuth } from '@/lib/auth';
import { USE_SUPABASE } from '@/lib/supabase';
import { useVitrine } from '@/data/VitrineProvider';
import { listarMinhasSolicitacoes, obterSolicitacao, mudarStatus } from '@/data/solicitacoes';
import {
  ETAPAS_ENSINO, MOTIVOS_ENCERRAMENTO, TEXTO_STATUS, acoesDoStatus, textoHorarios,
  type MotivoEncerramento, type Solicitacao, type StatusSolicitacao,
} from '@/lib/solicitacao';
import { TURNO_LABEL, cn, nomeDestinoParaExibicao } from '@/lib/utils';

/** Só a conta logada vê as próprias solicitações (a RLS confirma no servidor). */
export function ExigirFamilia({ children }: { children: ReactNode }) {
  const { session, carregando } = useAuth();
  const { pathname } = useLocation();
  if (!USE_SUPABASE) return <>{children}</>;
  if (carregando) return <div className="flex min-h-dvh items-center justify-center text-navy-400"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!session) return <Navigate to={`/familia/entrar?voltar=${encodeURIComponent(pathname)}`} replace />;
  return <>{children}</>;
}

const COR_STATUS: Record<StatusSolicitacao, string> = {
  ativa: 'bg-mint-100 text-navy-900',
  pausada: 'bg-amber-100 text-amber-900',
  encerrada: 'bg-navy-100 text-navy-600',
};
function Status({ s }: { s: StatusSolicitacao }) {
  return <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold', COR_STATUS[s])}>{TEXTO_STATUS[s]}</span>;
}

function useNomeDoDestino() {
  const { destinosPorId } = useVitrine();
  return (id: string) => (destinosPorId[id] ? nomeDestinoParaExibicao(destinosPorId[id].nome) : 'Escola');
}

/* ============================ Minhas solicitações ============================ */
export function SolicitacoesPage() {
  const navigate = useNavigate();
  const nomeDestino = useNomeDoDestino();
  const [lista, setLista] = useState<Solicitacao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const carregar = useCallback(() => {
    setErro(null); setLista(null);
    listarMinhasSolicitacoes().then(setLista).catch((e) => setErro((e as Error).message));
  }, []);
  useEffect(() => carregar(), [carregar]);

  return (
    <ExigirFamilia>
      <VMShell nav={false}>
        <SubHeader titulo="Minhas solicitações" onVoltar={() => navigate('/')} />
        <div className="space-y-3 px-4 pt-4 pb-6">
          {erro && <AvisoErro mensagem={erro} onTentar={carregar} />}
          {!erro && lista === null && <div className="flex justify-center py-16 text-navy-400"><Loader2 className="h-6 w-6 animate-spin" /></div>}
          {!erro && lista?.length === 0 && (
            <EstadoVazio icon={ClipboardList} titulo="Você ainda não tem solicitações"
              texto="Conte de onde sai, para qual escola vai e em que horário. Sua solicitação fica guardada aqui."
              acao={<Link to="/familia/solicitacoes/nova" className="flex h-14 w-full items-center justify-center rounded-full bg-mint-500 text-base font-bold text-black shadow-float">Nova solicitação</Link>} />
          )}
          {!!lista?.length && (
            <>
              <Link to="/familia/solicitacoes/nova" className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-mint-500 text-base font-bold text-black shadow-float">
                <Plus className="h-5 w-5" /> Nova solicitação
              </Link>
              <ul className="space-y-2.5">
                {lista.map((s) => (
                  <li key={s.id}>
                    <Link to={`/familia/solicitacoes/${s.id}`} className="block">
                      <Card className="vm-press">
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-display text-[17px] font-bold leading-snug text-navy-900">{nomeDestino(s.destinoId)}</p>
                          <Status s={s.status} />
                        </div>
                        <p className="mt-1 text-sm text-navy-600">{textoHorarios(s)}</p>
                        <p className="mt-0.5 text-xs text-navy-500">Criada em {new Date(s.criadaEm).toLocaleDateString('pt-BR')}</p>
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </VMShell>
    </ExigirFamilia>
  );
}

/* ============================ Detalhe e ações ============================ */
export function SolicitacaoPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation() as { state?: { criada?: boolean } };
  const nomeDestino = useNomeDoDestino();
  const [s, setS] = useState<Solicitacao | null | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [encerrando, setEncerrando] = useState(false);
  const [motivo, setMotivo] = useState<MotivoEncerramento | ''>('');

  const carregar = useCallback(() => {
    setErro(null);
    obterSolicitacao(id).then(setS).catch((e) => setErro((e as Error).message));
  }, [id]);
  useEffect(() => carregar(), [carregar]);

  async function mudar(status: StatusSolicitacao) {
    setOcupado(true); setErro(null);
    try {
      setS(await mudarStatus(id, status, status === 'encerrada' ? (motivo || null) : null));
      setEncerrando(false);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  const acoes = s ? acoesDoStatus(s.status) : null;
  return (
    <ExigirFamilia>
      <VMShell nav={false}>
        <SubHeader titulo="Solicitação" onVoltar={() => navigate('/familia/solicitacoes')} />
        <div className="space-y-3 px-4 pt-4 pb-6">
          {state?.criada && s && (
            <p role="status" className="flex items-start gap-2 rounded-2xl bg-mint-50 p-3 text-[15px] font-semibold text-navy-900 ring-1 ring-mint-200">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-mint-600" /> Solicitação registrada. Ela fica guardada aqui e pode ser alterada quando quiser.
            </p>
          )}
          {erro && <AvisoErro mensagem={erro} onTentar={carregar} />}
          {s === undefined && !erro && <div className="flex justify-center py-16 text-navy-400"><Loader2 className="h-6 w-6 animate-spin" /></div>}
          {s === null && <Card><p className="text-center text-navy-600">Solicitação não encontrada na sua conta.</p></Card>}
          {s && acoes && (
            <>
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <p className="font-display text-lg font-bold text-navy-900">{nomeDestino(s.destinoId)}</p>
                  <Status s={s.status} />
                </div>
                <dl className="mt-3 space-y-2.5 text-[15px]">
                  <Item icone={<MapPin className="h-4 w-4" />} rotulo="Embarque">{s.endereco}</Item>
                  <Item icone={<Clock className="h-4 w-4" />} rotulo="Horários">{textoHorarios(s)}{s.turno ? ` · ${TURNO_LABEL[s.turno]}` : ''}</Item>
                  {s.etapa && <Item icone={<School className="h-4 w-4" />} rotulo="Etapa escolar">{ETAPAS_ENSINO.find((e) => e.id === s.etapa)?.nome}</Item>}
                  {s.acessibilidade && <Item rotulo="Acessibilidade">Precisa de veículo acessível</Item>}
                  {s.observacoes && <Item rotulo="Observações">{s.observacoes}</Item>}
                  {s.status === 'encerrada' && s.motivoEncerramento && <Item rotulo="Motivo do encerramento">{MOTIVOS_ENCERRAMENTO.find((m) => m.id === s.motivoEncerramento)?.nome}</Item>}
                </dl>
                <p className="mt-3 inline-flex gap-1.5 text-sm text-navy-500"><Lock className="mt-0.5 h-4 w-4 shrink-0" /> Seu endereço completo não é mostrado aos motoristas.</p>
              </Card>

              <Card>
                <p className="font-display font-bold text-navy-900">Propostas</p>
                <p className="mt-1 text-[15px] text-navy-600">Nenhuma proposta recebida. O recebimento de propostas dos motoristas ainda vai ser liberado.</p>
              </Card>

              {encerrando ? (
                <Card>
                  <p className="font-display font-bold text-navy-900">Por que você quer encerrar?</p>
                  <p className="text-sm text-navy-600">Opcional. Depois de encerrada, a solicitação não pode ser reaberta.</p>
                  <div className="mt-3 space-y-2" role="radiogroup" aria-label="Motivo do encerramento">
                    {MOTIVOS_ENCERRAMENTO.map((m) => (
                      <button key={m.id} type="button" role="radio" aria-checked={motivo === m.id} onClick={() => setMotivo(m.id)}
                        className={cn('flex min-h-[3rem] w-full items-center rounded-2xl px-4 text-left text-[15px] font-semibold ring-1', motivo === m.id ? 'bg-mint-500 text-black ring-mint-500' : 'bg-white text-navy-800 ring-navy-200')}>
                        {m.nome}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2.5">
                    <button type="button" onClick={() => setEncerrando(false)} className="h-12 rounded-full bg-white font-bold text-navy-800 ring-1 ring-navy-200">Voltar</button>
                    <button type="button" onClick={() => mudar('encerrada')} disabled={ocupado} className="h-12 rounded-full bg-navy-900 font-bold text-white disabled:opacity-60">Encerrar</button>
                  </div>
                </Card>
              ) : (
                <div className="grid gap-2.5">
                  {acoes.editar && <Link to={`/familia/solicitacoes/${s.id}/editar`} className="flex h-14 items-center justify-center rounded-full bg-mint-500 text-base font-bold text-black shadow-float">Editar informações</Link>}
                  {acoes.pausar && <Botao onClick={() => mudar('pausada')} ocupado={ocupado}>Pausar solicitação</Botao>}
                  {acoes.reativar && <Botao onClick={() => mudar('ativa')} ocupado={ocupado}>Reativar solicitação</Botao>}
                  {acoes.encerrar && <Botao onClick={() => setEncerrando(true)} ocupado={ocupado}>Encerrar solicitação</Botao>}
                  {s.status === 'pausada' && <p className="text-center text-sm text-navy-600">Pausada: ela fica guardada, mas não aparece para motoristas.</p>}
                </div>
              )}
            </>
          )}
        </div>
      </VMShell>
    </ExigirFamilia>
  );
}

function Item({ icone, rotulo, children }: { icone?: ReactNode; rotulo: string; children: ReactNode }) {
  return (
    <div>
      <dt className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-navy-500">{icone}{rotulo}</dt>
      <dd className="mt-0.5 break-words text-navy-900">{children}</dd>
    </div>
  );
}

function Botao({ onClick, ocupado, children }: { onClick: () => void; ocupado: boolean; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={ocupado}
      className="flex h-14 items-center justify-center rounded-full bg-white text-base font-bold text-navy-800 ring-1 ring-navy-200 active:scale-[0.98] disabled:opacity-60">
      {ocupado ? <Loader2 className="h-5 w-5 animate-spin" /> : children}
    </button>
  );
}
