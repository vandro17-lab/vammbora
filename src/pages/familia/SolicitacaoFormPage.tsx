import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Loader2, Lock } from 'lucide-react';
import { VMShell } from '@/components/vm/VMShell';
import { Card, SubHeader, AvisoErro } from '@/components/vm/ui';
import { CampoEndereco } from '@/components/search/CampoEndereco';
import { useVitrine } from '@/data/VitrineProvider';
import { useAuth } from '@/lib/auth';
import { locaisDeDestinos } from '@/lib/geocode';
import { paramsParaCriterios } from '@/lib/searchParams';
import { novoId } from '@/data/motorista-store';
import { criarSolicitacao, atualizarSolicitacao, obterSolicitacao, SOLICITACOES_NO_SERVIDOR } from '@/data/solicitacoes';
import {
  PASSOS_SOLICITACAO, ETAPAS_ENSINO, SENTIDOS, OBSERVACOES_MAX,
  validarPasso, primeiroPassoComProblema, rascunhoVazio, rascunhoDaBusca, rascunhoDaSolicitacao, precisaEntrarParaConfirmar,
  type PassoSolicitacao, type RascunhoSolicitacao,
} from '@/lib/solicitacao';
import { TURNO_LABEL, cn, nomeDestinoParaExibicao } from '@/lib/utils';
import { ExigirFamilia } from '@/pages/familia/SolicitacoesPages';

/* Rascunho da NOVA solicitação: sobrevive a voltar etapas, recarregar e ao login. */
const K_RASCUNHO = 'vanbora.solicitacao.rascunho.v1';
interface Guardado { passo: PassoSolicitacao; r: RascunhoSolicitacao }
function lerRascunho(): Guardado | null {
  try { const v = sessionStorage.getItem(K_RASCUNHO); return v ? (JSON.parse(v) as Guardado) : null; } catch { return null; }
}
function gravarRascunho(g: Guardado) { try { sessionStorage.setItem(K_RASCUNHO, JSON.stringify(g)); } catch { /* segue em memória */ } }
function limparRascunho() { try { sessionStorage.removeItem(K_RASCUNHO); } catch { /* ignora */ } }

/** Nova solicitação: preencher NÃO exige conta; confirmar exige. */
export function NovaSolicitacaoPage() {
  const { search, pathname } = useLocation();
  const navigate = useNavigate();
  // Vindo da busca: começa um rascunho NOVO com os dados dela. Sem dados na URL
  // (voltar do login, recarregar): continua o rascunho guardado.
  const [inicial] = useState<Guardado>(() => {
    const daBusca = new URLSearchParams(search);
    if (daBusca.has('destino') || daBusca.has('endereco')) {
      return { passo: 'endereco', r: rascunhoDaBusca(paramsParaCriterios(daBusca), novoId()) };
    }
    return lerRascunho() ?? { passo: 'endereco', r: rascunhoVazio(novoId()) };
  });
  // Tira os dados da busca da URL: recarregar a página não apaga o que já foi preenchido.
  useEffect(() => { if (search) navigate(pathname, { replace: true }); }, [search, pathname, navigate]);
  return <FormularioSolicitacao inicial={inicial} />;
}

/** Edição: só a dona (rota protegida; a RLS confirma no servidor). */
export function EditarSolicitacaoPage() {
  const { id = '' } = useParams();
  const [inicial, setInicial] = useState<Guardado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    obterSolicitacao(id)
      .then((s) => {
        if (!s) setErro('Solicitação não encontrada na sua conta.');
        else if (s.status === 'encerrada') setErro('Esta solicitação foi encerrada e não pode mais ser alterada.');
        else setInicial({ passo: 'endereco', r: rascunhoDaSolicitacao(s) });
      })
      .catch((e) => setErro((e as Error).message));
  }, [id]);
  return (
    <ExigirFamilia>
      {inicial ? <FormularioSolicitacao inicial={inicial} editandoId={id} /> : (
        <VMShell nav={false}>
          <SubHeader titulo="Editar solicitação" onVoltar={() => history.back()} />
          <div className="px-4 pt-4">{erro ? <AvisoErro mensagem={erro} /> : <div className="flex justify-center py-16 text-navy-400"><Loader2 className="h-6 w-6 animate-spin" /></div>}</div>
        </VMShell>
      )}
    </ExigirFamilia>
  );
}

function FormularioSolicitacao({ inicial, editandoId }: { inicial: Guardado; editandoId?: string }) {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { destinos, destinosPorId, carregando: carregandoDestinos } = useVitrine();
  const locais = useMemo(() => locaisDeDestinos(destinos), [destinos]);
  const [passo, setPasso] = useState<PassoSolicitacao>(inicial.passo);
  const [r, setR] = useState<RascunhoSolicitacao>(inicial.r);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const titulo = useRef<HTMLHeadingElement>(null);

  // Só a NOVA solicitação guarda rascunho (inclusive o passo, para voltar do login na revisão).
  useEffect(() => { if (!editandoId) gravarRascunho({ passo, r }); }, [passo, r, editandoId]);
  useEffect(() => { titulo.current?.focus({ preventScroll: true }); }, [passo]);

  const indice = PASSOS_SOLICITACAO.findIndex((p) => p.id === passo);
  const ultimo = indice === PASSOS_SOLICITACAO.length - 1;
  const mudar = (m: Partial<RascunhoSolicitacao>) => { setErro(null); setR((a) => ({ ...a, ...m })); };
  const irPara = (p: PassoSolicitacao) => { setErro(null); setPasso(p); };
  const sair = () => (editandoId ? navigate(`/familia/solicitacoes/${editandoId}`) : navigate(-1));
  const voltar = () => (indice > 0 ? irPara(PASSOS_SOLICITACAO[indice - 1].id) : sair());
  const nomeDestino = (id: string) => (destinosPorId[id] ? nomeDestinoParaExibicao(destinosPorId[id].nome) : '—');

  async function continuar() {
    if (!ultimo) {
      const problema = validarPasso(passo, r);
      if (problema) { setErro(problema); return; }
      irPara(PASSOS_SOLICITACAO[indice + 1].id);
      return;
    }
    const pendente = primeiroPassoComProblema(r);
    if (pendente) { setPasso(pendente.passo); setErro(pendente.erro); return; }
    // Confirmar exige conta: guarda o rascunho e volta para a revisão depois do login.
    if (!editandoId && precisaEntrarParaConfirmar(SOLICITACOES_NO_SERVIDOR, !!session)) {
      gravarRascunho({ passo: 'revisao', r });
      navigate(`/familia/entrar?voltar=${encodeURIComponent('/familia/solicitacoes/nova')}`);
      return;
    }
    setEnviando(true); setErro(null);
    try {
      const s = editandoId ? await atualizarSolicitacao(editandoId, r) : await criarSolicitacao(r);
      if (!editandoId) limparRascunho();
      navigate(`/familia/solicitacoes/${s.id}`, { replace: true, state: { criada: !editandoId } });
    } catch (e) {
      setErro((e as Error).message); // o rascunho continua guardado
    } finally {
      setEnviando(false);
    }
  }

  return (
    <VMShell nav={false} className="pb-0">
      <div className="flex min-h-dvh flex-col">
        <SubHeader titulo={editandoId ? 'Editar solicitação' : 'Nova solicitação'} onVoltar={voltar}
          acao={<button type="button" onClick={() => { if (!editandoId) limparRascunho(); sair(); }} className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold">Cancelar</button>} />
        <div className="px-4 pt-3" aria-label="Progresso">
          <p className="text-sm font-semibold text-navy-600">Etapa {indice + 1} de {PASSOS_SOLICITACAO.length} · {PASSOS_SOLICITACAO[indice].nome}</p>
          <div className="mt-1.5 grid grid-cols-4 gap-1.5">
            {PASSOS_SOLICITACAO.map((p, i) => <span key={p.id} className={cn('h-1.5 rounded-full', i <= indice ? 'bg-mint-500' : 'bg-navy-100')} />)}
          </div>
        </div>

        <main className="flex-1 px-4 pb-24 pt-3">
          <Card className="p-4 sm:p-5">
            {passo === 'endereco' && (
              <Etapa tituloRef={titulo} titulo="De onde o aluno sai?" texto="Digite a rua e o número. Confira o alfinete no mapa.">
                <label className="field-label" htmlFor="sol-endereco">Endereço de embarque</label>
                <CampoEndereco id="sol-endereco" valor={r.endereco} onChange={(e) => mudar({ endereco: e })} locais={locais} placeholder="Ex.: Rua José Geraldo, 450" />
                <p className="mt-2 inline-flex gap-1.5 text-sm text-navy-600"><Lock className="mt-0.5 h-4 w-4 shrink-0" /> Seu endereço completo não é mostrado aos motoristas.</p>
              </Etapa>
            )}

            {passo === 'escola' && (
              <Etapa tituloRef={titulo} titulo="Para onde e em que horário?" texto="Escolha a escola e informe os horários.">
                <label className="field-label" htmlFor="sol-destino">Escola ou destino</label>
                <select id="sol-destino" className="field-input text-base" value={r.destinoId} disabled={carregandoDestinos} onChange={(e) => mudar({ destinoId: e.target.value })}>
                  <option value="">{carregandoDestinos ? 'Carregando escolas…' : 'Escolha na lista'}</option>
                  {destinos.map((d) => <option key={d.id} value={d.id}>{nomeDestinoParaExibicao(d.nome)}{d.bairro ? ` — ${d.bairro}` : ''}</option>)}
                </select>
                <p className="field-label mt-3">Trajeto</p>
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Trajeto">
                  {SENTIDOS.map((s) => (
                    <button key={s.id} type="button" role="radio" aria-checked={r.sentido === s.id} onClick={() => mudar({ sentido: s.id })}
                      className={cn('min-h-[3rem] rounded-xl px-2 text-[15px] font-semibold ring-1', r.sentido === s.id ? 'bg-mint-500 text-black ring-mint-500' : 'bg-white text-navy-700 ring-navy-200')}>{s.nome}</button>
                  ))}
                </div>
                <div className={cn('mt-3 grid gap-3', r.sentido === 'ambos' && 'grid-cols-2')}>
                  {r.sentido !== 'volta' && (
                    <div><label className="field-label" htmlFor="sol-ida">Chegar à escola até</label>
                      <input id="sol-ida" type="time" className="field-input text-base" value={r.horarioIda} onChange={(e) => mudar({ horarioIda: e.target.value })} /></div>
                  )}
                  {r.sentido !== 'ida' && (
                    <div><label className="field-label" htmlFor="sol-volta">Sai da escola às</label>
                      <input id="sol-volta" type="time" className="field-input text-base" value={r.horarioVolta} onChange={(e) => mudar({ horarioVolta: e.target.value })} /></div>
                  )}
                </div>
              </Etapa>
            )}

            {passo === 'detalhes' && (
              <Etapa tituloRef={titulo} titulo="Mais alguns detalhes" texto="Tudo opcional. Ajuda o motorista a entender o atendimento.">
                <label className="field-label" htmlFor="sol-etapa">Etapa escolar</label>
                <select id="sol-etapa" className="field-input text-base" value={r.etapa} onChange={(e) => mudar({ etapa: e.target.value as RascunhoSolicitacao['etapa'] })}>
                  <option value="">Prefiro não informar</option>
                  {ETAPAS_ENSINO.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
                <label className="field-label mt-3" htmlFor="sol-turno">Período</label>
                <select id="sol-turno" className="field-input text-base" value={r.turno} onChange={(e) => mudar({ turno: e.target.value as RascunhoSolicitacao['turno'] })}>
                  <option value="">Prefiro não informar</option>
                  {(['manha', 'tarde', 'noite'] as const).map((t) => <option key={t} value={t}>{TURNO_LABEL[t]}</option>)}
                </select>
                <label className="mt-3 flex min-h-[3rem] items-center gap-3 rounded-2xl bg-white px-3 text-[15px] font-semibold text-navy-900 ring-1 ring-navy-200">
                  <input type="checkbox" className="h-5 w-5 accent-[#FFC700]" checked={r.acessibilidade} onChange={(e) => mudar({ acessibilidade: e.target.checked })} />
                  Precisa de veículo acessível
                </label>
                <label className="field-label mt-3" htmlFor="sol-obs">Observações</label>
                <textarea id="sol-obs" rows={2} maxLength={OBSERVACOES_MAX} className="field-input text-base" value={r.observacoes}
                  placeholder="Ex.: dois irmãos na mesma escola" onChange={(e) => mudar({ observacoes: e.target.value })} />
                <p className="mt-1 text-xs text-navy-500">Não escreva documentos nem informações de saúde.</p>
              </Etapa>
            )}

            {passo === 'revisao' && (
              <Etapa tituloRef={titulo} titulo="Confira antes de confirmar" texto="Você não precisa informar valores: o preço é proposto pelos motoristas.">
                <dl className="divide-y divide-navy-50">
                  <Linha rotulo="Embarque" valor={r.endereco.texto || '—'} onAlterar={() => irPara('endereco')} />
                  <Linha rotulo="Escola" valor={nomeDestino(r.destinoId)} onAlterar={() => irPara('escola')} />
                  <Linha rotulo="Horários" valor={[r.sentido !== 'volta' && `ida até ${r.horarioIda || '—'}`, r.sentido !== 'ida' && `volta às ${r.horarioVolta || '—'}`].filter(Boolean).join(' · ')} onAlterar={() => irPara('escola')} />
                  <Linha rotulo="Detalhes" valor={[ETAPAS_ENSINO.find((e) => e.id === r.etapa)?.nome, r.turno && TURNO_LABEL[r.turno], r.acessibilidade && 'veículo acessível'].filter(Boolean).join(' · ') || 'Nenhum'} onAlterar={() => irPara('detalhes')} />
                </dl>
                {!editandoId && <p className="mt-2 text-sm text-navy-600">Ao confirmar, sua solicitação fica ativa e guardada na sua conta.{precisaEntrarParaConfirmar(SOLICITACOES_NO_SERVIDOR, !!session) ? ' Vamos pedir para você entrar na sua conta.' : ''}</p>}
              </Etapa>
            )}

            {erro && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{erro}</p>}
          </Card>
        </main>

        <div className="fixed inset-x-0 bottom-0 z-[700] border-t border-navy-100 bg-white/95 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur">
          <div className="vm-screen grid grid-cols-[1fr_1.6fr] gap-2.5">
            <button type="button" onClick={voltar} className="h-14 rounded-full bg-white text-base font-bold text-navy-800 ring-1 ring-navy-200 active:scale-[0.98]">Voltar</button>
            <button type="button" onClick={continuar} disabled={enviando}
              className="flex h-14 items-center justify-center gap-2 rounded-full bg-mint-500 text-base font-bold text-black shadow-float active:scale-[0.98] disabled:opacity-60">
              {enviando ? <><Loader2 className="h-5 w-5 animate-spin" /> Enviando…</> : ultimo ? (editandoId ? 'Salvar alterações' : 'Confirmar solicitação') : 'Continuar'}
            </button>
          </div>
        </div>
      </div>
    </VMShell>
  );
}

function Etapa({ titulo, texto, tituloRef, children }: { titulo: string; texto: string; tituloRef: React.RefObject<HTMLHeadingElement>; children: ReactNode }) {
  return (
    <section>
      <h2 ref={tituloRef} tabIndex={-1} className="font-display text-xl font-bold leading-snug text-navy-900 outline-none">{titulo}</h2>
      <p className="mt-1 text-[15px] text-navy-600">{texto}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Linha({ rotulo, valor, onAlterar }: { rotulo: string; valor: string; onAlterar: () => void }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-semibold uppercase tracking-wide text-navy-500">{rotulo}</dt>
        <dd className="mt-0.5 line-clamp-2 break-words text-[15px] text-navy-900">{valor}</dd>
      </div>
      <button type="button" onClick={onAlterar} className="shrink-0 rounded-full px-3 py-2 text-sm font-semibold text-mint-700 ring-1 ring-mint-200">Alterar</button>
    </div>
  );
}
