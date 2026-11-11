import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Reorder, useDragControls } from 'framer-motion';
import { AlertTriangle, Check, GripVertical, Home, Loader2, MapPin, RotateCcw, School, UserX, Users } from 'lucide-react';
import { VMShell } from '@/components/vm/VMShell';
import { Card, SubHeader } from '@/components/vm/ui';
import { MapaInterativoRota } from '@/components/motorista/MapaInterativoRota';
import { CampoEndereco } from '@/components/search/CampoEndereco';
import { novoId, obterRota, salvarRota } from '@/data/motorista-store';
import { escolasEsvaziadas, escolasSemAlunos, resolverEscolaSemAlunos, type DecisaoEscolaVazia } from '@/lib/edicao-rota';
import { obterMatrizViaria } from '@/lib/matriz-viaria';
import { CampoDuracao, PeriodoEscolar, SaidaEAntecipacao } from '@/components/motorista/CadastroRotaEtapa1';
import { ENDERECO_VAZIO, type EnderecoCampo } from '@/lib/endereco';
import {
  alunosForaDeOrdem, alunosQuePodemVoltar, distanciaPelasRuas, pendenciasParaConcluirVolta, pontosParaOrdenarVolta,
  removerAluno, reordenarParadas, sugerirVolta, trocarEnderecoDoAluno,
} from '@/lib/rota-volta';
import { cn, nomeDestinoParaExibicao } from '@/lib/utils';
import type { ParadaRota, PassageiroRota, Rota } from '@/types/motorista';

const listar = (nomes: string[]) => (nomes.length <= 1 ? nomes.join('') : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`);
const paraHora = (min: number | null | undefined) => (min == null ? '' : `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`);
const paraMinutos = (hora: string) => { const [h, m] = hora.split(':').map(Number); return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null; };

/**
 * MONTAR A VOLTA a partir da ida, em dois passos:
 *  1) quem volta com a van (todos já marcados);
 *  2) a volta sugerida, com mapa + lista para ARRASTAR e ajustar.
 * A volta é salva como rota própria: mexer nela não altera a ida.
 */
export function MontarVoltaPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ida, setIda] = useState<Rota | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [passo, setPasso] = useState<'quem' | 'ajuste'>('quem');
  const [voltam, setVoltam] = useState<string[]>([]);
  const [volta, setVolta] = useState<Rota | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  // De onde veio a ORDEM sugerida: linha reta (aproximação) ou trajetos das ruas.
  const [ordemPor, setOrdemPor] = useState<'reta' | 'calculando' | 'ruas'>('reta');
  // O motorista já mexeu na volta: uma sugestão que chegue depois não sobrescreve.
  const mexeu = useRef(false);
  // Escolas que ficaram sem alunos nesta edição e esperam a decisão do motorista.
  const [escolasADecidir, setEscolasADecidir] = useState<string[]>([]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = id ? await obterRota(id) : null;
        if (!vivo) return;
        if (!r) setErro('Rota não encontrada.');
        else if (r.sentido !== 'ida') setErro('A volta é montada a partir de uma rota de ida.');
        else { setIda(r); setVoltam(alunosQuePodemVoltar(r).map((x) => x.id)); }
      } catch (e) { if (vivo) setErro((e as Error).message || 'Não foi possível carregar a rota.'); }
      finally { if (vivo) setCarregando(false); }
    })();
    return () => { vivo = false; };
  }, [id]);

  const podem = useMemo(() => (ida ? alunosQuePodemVoltar(ida) : []), [ida]);
  const semEscola = ida ? ida.passageiros.length - podem.length : 0;
  const paradas = useMemo(() => [...(volta?.paradas ?? [])].sort((a, b) => a.ordem - b.ordem), [volta]);
  const foraDeOrdem = volta ? alunosForaDeOrdem(volta) : [];
  const voltar = () => navigate(ida ? `/app/rotas/${ida.id}` : '/app/rotas');

  function montar(ids: string[]) {
    if (!ida) return;
    setVoltam(ids);
    // 1º: sugestão imediata por distância em LINHA RETA (só uma aproximação).
    setVolta(sugerirVolta(ida, { voltamIds: ids }));
    setAberta(null);
    setEscolasADecidir([]);
    mexeu.current = false;
    setPasso('ajuste');
    // 2º: refaz a ordem com os trajetos REAIS das ruas (a volta não é a ida
    // invertida: mão única e retornos mudam o caminho). Se o mapa não responder,
    // fica a aproximação — e a tela diz isso.
    const pontos = pontosParaOrdenarVolta(ida, ids);
    if (pontos.length < 2) return;
    setOrdemPor('calculando');
    obterMatrizViaria(pontos).then((matriz) => {
      const ruas = distanciaPelasRuas(matriz);
      const sugerida = sugerirVolta(ida, { voltamIds: ids, distancia: ruas.distancia });
      if (!ruas.completa() || mexeu.current) { setOrdemPor(mexeu.current ? 'ruas' : 'reta'); return; }
      setVolta(sugerida);
      setOrdemPor('ruas');
    }).catch(() => setOrdemPor('reta'));
  }

  /** Edição feita pelo motorista na volta (a partir daqui a sugestão não é mais trocada). */
  function editarVolta(f: (v: Rota) => Rota) {
    mexeu.current = true;
    setVolta((v) => {
      if (!v) return v;
      const nova = f(v);
      const esvaziadas = escolasEsvaziadas(v, nova).map((p) => p.id);
      if (esvaziadas.length) setEscolasADecidir((ids) => [...new Set([...ids, ...esvaziadas])]);
      return nova;
    });
  }
  const escolasPendentes = volta ? escolasSemAlunos(volta).filter((p) => escolasADecidir.includes(p.id)) : [];
  const decidirEscola = (paradaId: string, decisao: DecisaoEscolaVazia) => {
    setEscolasADecidir((ids) => ids.filter((id) => id !== paradaId));
    setVolta((v) => (v ? resolverEscolaSemAlunos(v, paradaId, decisao, novoId) : v));
  };
  const faltaParaConcluir = volta ? [...pendenciasParaConcluirVolta(volta), ...(escolasPendentes.length ? ['decidir o que fazer com a escola que ficou sem alunos'] : [])] : [];

  async function salvar() {
    if (!volta) return;
    setSalvando(true); setErro(null);
    try {
      // Só é CONCLUÍDA (e passa a aparecer nas buscas) com o que é próprio da
      // volta informado: liberação de cada escola, ordem possível, endereços.
      // Faltando algo, fica como rascunho — nada da ida é presumido.
      const salva = await salvarRota({ ...volta, status: faltaParaConcluir.length === 0 ? 'concluida' : 'rascunho' });
      navigate(`/app/rotas/${salva.id}`, { replace: true });
    } catch (e) {
      setErro((e as Error).message || 'Não foi possível salvar a volta.');
      setSalvando(false);
    }
  }

  if (carregando || !ida) {
    return (
      <VMShell nav={false}>
        <SubHeader titulo="Montar a volta" onVoltar={() => navigate('/app/rotas')} />
        <p className="p-6 text-center text-navy-500">{carregando ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : erro}</p>
      </VMShell>
    );
  }

  return (
    <VMShell nav={false}>
      <SubHeader titulo="Montar a volta" onVoltar={passo === 'ajuste' ? () => setPasso('quem') : voltar} />
      <div className="space-y-3.5 px-4 pb-28 pt-4">
        {passo === 'quem' ? (
          <>
            <Card>
              <p className="font-display text-lg font-extrabold text-navy-900">Quem volta com você?</p>
              <p className="mt-1 text-sm text-navy-500">Usamos a rota “{ida.nome || 'de ida'}”. Toque para desmarcar quem não volta na van.</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {podem.map((x) => {
                  const vai = voltam.includes(x.id);
                  return (
                    <button key={x.id} type="button" aria-pressed={vai}
                      onClick={() => setVoltam((v) => (vai ? v.filter((i) => i !== x.id) : [...v, x.id]))}
                      className={cn('flex min-h-[52px] items-center gap-2 rounded-2xl px-3 text-left text-sm font-semibold transition active:scale-[.98]', vai ? 'bg-mint-100 text-navy-900 ring-2 ring-mint-400' : 'bg-navy-50 text-navy-400')}>
                      <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold', vai ? 'bg-mint-400 text-navy-950' : 'bg-navy-200 text-white')}>{vai ? <Check className="h-4 w-4" /> : (x.identificacao || 'A').slice(0, 1).toUpperCase()}</span>
                      <span className={cn('min-w-0 flex-1 truncate', !vai && 'line-through')}>{x.identificacao || 'Aluno'}</span>
                    </button>
                  );
                })}
              </div>
              {podem.length === 0 && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">A ida ainda não tem alunos com casa e escola definidas. Complete a ida para montar a volta.</p>}
              {semEscola > 0 && podem.length > 0 && <p className="mt-3 text-xs text-navy-400">{semEscola} aluno(s) da ida sem escola de desembarque ficaram de fora.</p>}
            </Card>
            <div className="fixed inset-x-0 bottom-0 z-20 border-t border-navy-100 bg-white/95 p-3 backdrop-blur">
              <div className="vm-screen flex gap-2">
                <button type="button" className="btn btn-lg btn-ghost" onClick={voltar}>Agora não</button>
                <button type="button" className="btn btn-lg btn-primary flex-1" disabled={!voltam.length} onClick={() => montar(voltam)}>
                  <Users className="h-5 w-5" /> {voltam.length === podem.length ? 'Todos voltam' : `Voltam ${voltam.length}`} — montar
                </button>
              </div>
            </div>
          </>
        ) : volta && (
          <>
            <Card className="p-3.5">
              <div className="h-56 overflow-hidden rounded-2xl ring-1 ring-navy-100"><MapaInterativoRota paradas={volta.paradas} bare /></div>
              <p className="mt-2 text-xs text-navy-500" data-testid="ordem-da-volta">
                {ordemPor === 'ruas' ? 'Sugestão: sai da escola e entrega pelo caminho mais rápido pelas ruas (a volta não é a ida invertida).'
                  : ordemPor === 'calculando' ? 'Calculando a ordem pelos trajetos das ruas…'
                  : 'Sugestão aproximada, por distância em linha reta — o mapa das ruas não respondeu. Confira a ordem no mapa.'}
                {' '}Segure <GripVertical className="inline h-3.5 w-3.5" /> e arraste para mudar a ordem.
              </p>
              <p className="mt-1 text-xs text-navy-500">Horários, flexibilidade, tempo de atendimento, antecipação e escolas que você aceita <strong>não são copiados da ida</strong>: informe os da volta.</p>
            </Card>

            {escolasPendentes.map((p) => (
              <div key={p.id} role="alertdialog" aria-label="Escola sem alunos" data-testid="escola-sem-alunos" className="rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200">
                <p className="text-sm font-bold text-amber-900">{p.destinoNome || p.rotulo || 'A escola'} ficou sem alunos na volta.</p>
                <p className="mt-0.5 text-xs text-amber-900">O que você quer fazer com a visita a esta escola? Nada muda até você escolher.</p>
                <div className="mt-2 grid gap-2">
                  <button type="button" onClick={() => decidirEscola(p.id, 'manter')} className="min-h-[2.75rem] rounded-xl bg-white px-3 text-left text-sm font-bold ring-1 ring-navy-200">Continuar passando na escola</button>
                  <button type="button" onClick={() => decidirEscola(p.id, 'disponibilidade')} className="min-h-[2.75rem] rounded-xl bg-white px-3 text-left text-sm font-bold ring-1 ring-navy-200">Parar de passar, mas aceitar incluir</button>
                  <button type="button" onClick={() => decidirEscola(p.id, 'remover')} className="min-h-[2.75rem] rounded-xl bg-white px-3 text-left text-sm font-bold text-red-700 ring-1 ring-red-200">Tirar a escola desta rota</button>
                </div>
              </div>
            ))}

            {foraDeOrdem.length > 0 && (
              <p role="alert" className="flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> A casa de {listar(foraDeOrdem.map((x) => x.identificacao))} está antes da escola. Arraste a escola para cima.
              </p>
            )}

            <Reorder.Group axis="y" values={paradas.map((p) => p.id)} onReorder={(ids) => editarVolta((v) => reordenarParadas(v, ids as string[]))} className="space-y-2">
              {paradas.map((p, i) => (
                <ItemParada key={p.id} parada={p} numero={i + 1} aberta={aberta === p.id} onAbrir={() => setAberta((a) => (a === p.id ? null : p.id))}
                  embarcam={volta.passageiros.filter((x) => x.embarqueParadaId === p.id)} descem={volta.passageiros.filter((x) => x.desembarqueParadaId === p.id)}
                  onHorario={(min) => editarVolta((v) => ({ ...v, paradas: v.paradas.map((q) => (q.id === p.id ? { ...q, liberacaoMin: min } : q)) }))}
                  onGrupo={(min) => setVolta((v) => (v ? { ...v, paradas: v.paradas.map((q) => (q.id === p.id ? { ...q, atendimentoGrupoMin: min } : q)) } : v))}
                  onRemover={(alunoId) => { editarVolta((v) => removerAluno(v, alunoId)); setAberta(null); }}
                  onEndereco={(alunoId, rotulo, ponto) => { editarVolta((v) => trocarEnderecoDoAluno(v, alunoId, rotulo, ponto)); setAberta(null); }} />
              ))}
            </Reorder.Group>

            <Card className="space-y-4">
              <PeriodoEscolar rota={volta} setRota={(r) => setVolta(r)} />
              <SaidaEAntecipacao rota={volta} setRota={(r) => editarVolta(() => r)} />
            </Card>

            <button type="button" onClick={() => montar(voltam)} className="mx-auto flex min-h-[44px] items-center gap-2 text-sm font-semibold text-navy-500"><RotateCcw className="h-4 w-4" /> Voltar à sugestão</button>
            {erro && <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{erro}</p>}

            <div className="fixed inset-x-0 bottom-0 z-20 border-t border-navy-100 bg-white/95 p-3 backdrop-blur">
              <div className="vm-screen">
                {!(volta.turno && volta.periodoConfirmado) && <p className="mb-2 text-center text-xs font-semibold text-amber-800">Confirme o período escolar desta volta para salvar.</p>}
                {volta.turno && volta.periodoConfirmado && faltaParaConcluir.length > 0 && (
                  <p className="mb-2 text-center text-xs font-semibold text-amber-800" data-testid="volta-rascunho">Será salva como rascunho (não aparece nas buscas). Falta: {listar(faltaParaConcluir)}.</p>
                )}
                <button type="button" className="btn btn-lg btn-primary w-full" disabled={salvando || !volta.passageiros.length || foraDeOrdem.length > 0 || !(volta.turno && volta.periodoConfirmado)} onClick={salvar}>
                  {salvando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} {faltaParaConcluir.length === 0 ? 'Salvar rota de volta' : 'Salvar rascunho da volta'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </VMShell>
  );
}

function ItemParada({ parada, numero, embarcam, descem, aberta, onAbrir, onHorario, onGrupo, onRemover, onEndereco }: {
  parada: ParadaRota; numero: number; embarcam: PassageiroRota[]; descem: PassageiroRota[];
  aberta: boolean; onAbrir: () => void; onHorario: (min: number | null) => void; onGrupo: (min: number | null) => void;
  onRemover: (alunoId: string) => void; onEndereco: (alunoId: string, rotulo: string, ponto: { lat: number; lng: number } | null) => void;
}) {
  const arrasto = useDragControls();
  const escola = parada.tipo === 'escola';
  const [trocando, setTrocando] = useState<string | null>(null);
  const [endereco, setEndereco] = useState<EnderecoCampo>(ENDERECO_VAZIO);
  const titulo = escola ? nomeDestinoParaExibicao(parada.destinoNome || parada.rotulo || 'Escola') : `Casa de ${listar(descem.map((x) => x.identificacao)) || '—'}`;
  const Icone = escola ? School : Home;
  // Liberação dos alunos na volta (rotas antigas guardavam no horário da parada).
  const liberacao = parada.liberacaoMin ?? parada.horarioChegadaMin ?? null;

  return (
    <Reorder.Item value={parada.id} dragListener={false} dragControls={arrasto} className="vm-card relative select-none bg-white p-0" whileDrag={{ scale: 1.03, boxShadow: '0 12px 30px rgba(11,31,58,.22)', zIndex: 5 }} data-testid="parada-volta">
      <div className="flex items-center gap-2.5 p-3">
        <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-white', escola ? 'bg-navy-900' : 'bg-emerald-500')}><Icone className="h-5 w-5" /></span>
        <button type="button" onClick={onAbrir} className="min-w-0 flex-1 text-left" aria-expanded={aberta}>
          <p className="truncate text-sm font-bold text-navy-900"><span className="mr-1 text-navy-400">{numero}.</span>{titulo}</p>
          <p className="truncate text-xs text-navy-500">
            {escola ? `Embarcam ${embarcam.length} · ${liberacao != null ? `liberação às ${paraHora(liberacao)}` : 'toque para informar a liberação dos alunos'}` : (parada.rotulo || 'Endereço não informado')}
          </p>
          {!escola && !parada.confirmado && <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700"><MapPin className="h-3 w-3" /> sem ponto no mapa</p>}
        </button>
        <span onPointerDown={(e) => arrasto.start(e)} style={{ touchAction: 'none' }} role="button" aria-label={`Arrastar ${titulo}`}
          className="grid h-11 w-11 shrink-0 cursor-grab place-items-center rounded-xl bg-navy-50 text-navy-400 active:cursor-grabbing"><GripVertical className="h-5 w-5" /></span>
      </div>

      {aberta && (
        <div className="space-y-2 border-t border-navy-100 p-3">
          {escola ? (
            <>
              <label className="block text-sm font-semibold text-navy-700">Horário de liberação dos alunos
                <input type="time" className="field-input mt-1" value={paraHora(liberacao)} onChange={(e) => onHorario(e.target.value ? paraMinutos(e.target.value) : null)} />
              </label>
              <CampoDuracao rotulo="Tempo de atendimento do grupo" valor={parada.atendimentoGrupoMin} onChange={onGrupo} dica="Tempo parado na escola para todos embarcarem." />
            </>
          ) : descem.map((x) => (
            <div key={x.id} className="rounded-2xl bg-navy-50 p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-navy-800">{x.identificacao}</span>
                <button type="button" onClick={() => { setTrocando(trocando === x.id ? null : x.id); setEndereco(ENDERECO_VAZIO); }} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-white px-3 text-xs font-bold text-navy-700 ring-1 ring-navy-200"><MapPin className="h-4 w-4" /> Outro endereço</button>
                <button type="button" onClick={() => onRemover(x.id)} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-white px-3 text-xs font-bold text-red-700 ring-1 ring-red-200"><UserX className="h-4 w-4" /> Não volta</button>
              </div>
              {trocando === x.id && (
                <div className="mt-2">
                  <CampoEndereco valor={endereco} onChange={setEndereco} placeholder="Onde ele desce na volta?" />
                  <button type="button" className="btn btn-md btn-primary mt-2 w-full" disabled={!endereco.texto.trim() || !endereco.coord || endereco.validando}
                    onClick={() => { onEndereco(x.id, endereco.texto.trim(), endereco.coord); setTrocando(null); }}>Usar este endereço</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Reorder.Item>
  );
}
