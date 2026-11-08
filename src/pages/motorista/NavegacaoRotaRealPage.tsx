import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Check, CheckCircle2, Clock3, Loader2, Navigation,
  Play, RotateCcw, Route as RouteIcon, Users, XCircle,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ExigirMotorista } from './MotoristaShell';
import { obterRota, listarVeiculos } from '@/data/motorista-store';
import { trajetoOSRM, type TrajetoRota } from '@/lib/geocode';
import { capacidadeAlunos } from '@/lib/ocupacao-rota';
import type { Rota, Veiculo, ParadaRota, PassageiroRota } from '@/types/motorista';
import { MapaNavegacaoRotaReal } from '@/components/motorista/MapaNavegacaoRotaReal';
import { cn, nomeDestinoParaExibicao } from '@/lib/utils';

type EstadoViagem = 'pronta' | 'movendo' | 'chegou' | 'confirmada' | 'finalizada';
type EventoViagem = { tipo: 'embarque' | 'desembarque' | 'parada'; texto: string };

function pontoMaisProximo(geometria: [number, number][], parada: ParadaRota): number {
  if (!Number.isFinite(parada.lat) || !Number.isFinite(parada.lng) || !geometria.length) return 0;
  let melhor = 0;
  let distancia = Number.POSITIVE_INFINITY;
  geometria.forEach(([lat, lng], i) => {
    const d = (lat - (parada.lat as number)) ** 2 + (lng - (parada.lng as number)) ** 2;
    if (d < distancia) { distancia = d; melhor = i; }
  });
  return melhor;
}

function nomePassageiro(pax: PassageiroRota): string {
  return pax.identificacao || 'Aluno';
}

function nomeParada(parada: ParadaRota | undefined): string {
  if (!parada) return 'Próxima parada';
  if (parada.tipo === 'escola') return nomeDestinoParaExibicao(parada.destinoNome || parada.rotulo || 'Escola');
  if (parada.tipo === 'saida') return parada.rotulo || 'Saída';
  return parada.rotulo || 'Casa do aluno';
}

function NavegacaoProtegida() {
  const { id } = useParams();
  const [rota, setRota] = useState<Rota | null>(null);
  const [veiculo, setVeiculo] = useState<Veiculo | null>(null);
  const [trajeto, setTrajeto] = useState<TrajetoRota | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [erroOperacao, setErroOperacao] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoViagem>('pronta');
  const [indiceAtual, setIndiceAtual] = useState(0);
  const [indiceAlvo, setIndiceAlvo] = useState(1);
  const [progresso, setProgresso] = useState(0);
  const [aBordoIds, setABordoIds] = useState<string[]>([]);
  const [entreguesIds, setEntreguesIds] = useState<string[]>([]);
  const [eventos, setEventos] = useState<EventoViagem[]>([]);
  const frameRef = useRef<number | null>(null);
  const inicioAnimacaoRef = useRef<number | null>(null);
  const inicioProgressoRef = useRef(0);
  const fimProgressoRef = useRef(1);

  useEffect(() => {
    let vivo = true;
    (async () => {
      if (!id) { setErro('Rota não informada.'); setCarregando(false); return; }
      try {
        const [r, veiculos] = await Promise.all([obterRota(id), listarVeiculos().catch(() => [] as Veiculo[])]);
        if (!r) throw new Error('Esta rota não está disponível para o motorista conectado.');
        const pontos = [...r.paradas].sort((a, b) => a.ordem - b.ordem).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
        if (pontos.length < 2) throw new Error('A rota precisa ter pelo menos duas paradas geolocalizadas.');
        const t = await trajetoOSRM(pontos.map((p) => ({ lat: p.lat as number, lng: p.lng as number })));
        if (!t?.geometria.length) throw new Error('Não foi possível carregar o trajeto pelas ruas.');
        if (vivo) {
          setRota(r);
          setVeiculo(veiculos.find((v) => v.id === r.veiculoId) ?? null);
          setTrajeto(t);
          setProgresso(0);
        }
      } catch (e) {
        if (vivo) setErro((e as Error).message || 'Não foi possível carregar a rota.');
      } finally { if (vivo) setCarregando(false); }
    })();
    return () => { vivo = false; if (frameRef.current != null) cancelAnimationFrame(frameRef.current); };
  }, [id]);

  const paradas = useMemo(() => [...(rota?.paradas ?? [])].sort((a, b) => a.ordem - b.ordem), [rota]);
  const progressosParadas = useMemo(() => {
    if (!trajeto) return [];
    const ultimo = Math.max(1, trajeto.geometria.length - 1);
    return paradas.map((p) => pontoMaisProximo(trajeto.geometria, p) / ultimo);
  }, [paradas, trajeto]);
  const capacidade = rota ? capacidadeAlunos(rota, veiculo) : 0;
  const aBordo = useMemo(() => rota?.passageiros.filter((p) => aBordoIds.includes(p.id)) ?? [], [rota, aBordoIds]);
  const entregues = useMemo(() => rota?.passageiros.filter((p) => entreguesIds.includes(p.id)) ?? [], [rota, entreguesIds]);
  const paradaAlvo = paradas[indiceAlvo];
  const passageirosNaParada = useMemo(() => {
    if (!rota || !paradaAlvo) return { entrando: [] as PassageiroRota[], saindo: [] as PassageiroRota[] };
    return {
      entrando: rota.passageiros.filter((p) => p.embarqueParadaId === paradaAlvo.id && !aBordoIds.includes(p.id) && !entreguesIds.includes(p.id)),
      saindo: rota.passageiros.filter((p) => p.desembarqueParadaId === paradaAlvo.id),
    };
  }, [rota, paradaAlvo, aBordoIds, entreguesIds]);

  useEffect(() => {
    if (estado !== 'movendo' || !trajeto || progressosParadas.length < 2) return;
    const duracao = Math.max(5000, Math.min(22000, (fimProgressoRef.current - inicioProgressoRef.current) * trajeto.geometria.length * 70));
    const tick = (agora: number) => {
      if (inicioAnimacaoRef.current == null) inicioAnimacaoRef.current = agora;
      const fracao = Math.min(1, (agora - inicioAnimacaoRef.current) / duracao);
      setProgresso(inicioProgressoRef.current + (fimProgressoRef.current - inicioProgressoRef.current) * fracao);
      if (fracao < 1) frameRef.current = requestAnimationFrame(tick);
      else setEstado('chegou');
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current != null) cancelAnimationFrame(frameRef.current); };
  }, [estado, indiceAlvo, progressosParadas, trajeto]);

  function iniciarTrecho() {
    if (!trajeto || indiceAlvo >= paradas.length || !progressosParadas.length) return;
    setErroOperacao(null);
    inicioProgressoRef.current = progressosParadas[indiceAtual] ?? progresso;
    fimProgressoRef.current = progressosParadas[indiceAlvo] ?? 1;
    setProgresso(inicioProgressoRef.current);
    inicioAnimacaoRef.current = null;
    setEstado('movendo');
  }

  function iniciarRota() {
    if (estado === 'pronta') iniciarTrecho();
    else if (estado === 'confirmada') iniciarTrecho();
  }

  function confirmarParada() {
    if (!rota || !paradaAlvo) return;
    setErroOperacao(null);
    const { entrando, saindo } = passageirosNaParada;
    const faltandoDesembarque = saindo.filter((p) => !aBordoIds.includes(p.id));
    if (faltandoDesembarque.length) {
      setErroOperacao(`Não é possível confirmar: ${faltandoDesembarque.map(nomePassageiro).join(', ')} não está a bordo.`);
      return;
    }
    const novaBordo = aBordoIds.filter((idPax) => !saindo.some((p) => p.id === idPax));
    if (novaBordo.length + entrando.length > capacidade) {
      setErroOperacao(`Capacidade excedida: a van comporta ${capacidade} aluno(s) e esta parada deixaria ${novaBordo.length + entrando.length} a bordo.`);
      return;
    }
    const idsSaindo = saindo.map((p) => p.id);
    const idsEntrando = entrando.map((p) => p.id);
    setABordoIds([...novaBordo, ...idsEntrando]);
    setEntreguesIds((anteriores) => [...new Set([...anteriores, ...idsSaindo])]);
    setEventos((anteriores) => [
      ...anteriores,
      ...(saindo.length ? [{ tipo: 'desembarque' as const, texto: `Desembarque confirmado: ${saindo.map(nomePassageiro).join(', ')}` }] : []),
      ...(entrando.length ? [{ tipo: 'embarque' as const, texto: `Embarque confirmado: ${entrando.map(nomePassageiro).join(', ')}` }] : []),
      ...(!saindo.length && !entrando.length ? [{ tipo: 'parada' as const, texto: `Parada confirmada: ${nomeParada(paradaAlvo)}` }] : []),
    ]);
    setIndiceAtual(indiceAlvo);
    if (indiceAlvo >= paradas.length - 1) setEstado('finalizada');
    else {
      setIndiceAlvo(indiceAlvo + 1);
      setEstado('confirmada');
    }
  }

  function reiniciar() {
    if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    setEstado('pronta'); setIndiceAtual(0); setIndiceAlvo(1); setProgresso(0);
    setABordoIds([]); setEntreguesIds([]); setEventos([]); setErroOperacao(null);
  }

  const percentual = Math.round(progresso * 100);
  const textoAcao = estado === 'pronta' ? 'Iniciar rota' : estado === 'movendo' ? 'A caminho da próxima parada' : estado === 'chegou' ? (passageirosNaParada.saindo.length ? 'Confirmar desembarque' : passageirosNaParada.entrando.length ? 'Confirmar embarque' : 'Confirmar parada') : estado === 'confirmada' ? 'Ir para a próxima parada' : 'Rota concluída';
  const alunosNaParada = [...passageirosNaParada.saindo.map((p) => ({ p, acao: 'desce' })), ...passageirosNaParada.entrando.map((p) => ({ p, acao: 'embarca' }))];

  if (carregando) return <div className="flex min-h-dvh items-center justify-center bg-navy-950 text-white"><Loader2 className="h-7 w-7 animate-spin" /></div>;
  if (erro || !rota || !trajeto) return <div className="flex min-h-dvh items-center justify-center bg-navy-950 p-4"><div className="card max-w-md p-7 text-center"><RouteIcon className="mx-auto h-10 w-10 text-navy-300" /><h1 className="mt-4 font-display text-xl font-bold text-navy-900">Não foi possível abrir a rota</h1><p className="mt-2 text-sm text-navy-600">{erro}</p><Link to="/app/rotas" className="btn btn-lg btn-primary mt-6 w-full">Voltar para minhas rotas</Link></div></div>;

  return (
    <div className="h-dvh overflow-hidden bg-navy-950 text-white">
      <header className="relative z-20 border-b border-white/10 bg-navy-950/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to={`/app/rotas/${rota.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
          <div className="text-center"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-mint-300">Navegação da rota</p><p className="font-display text-sm font-extrabold">{rota.nome || 'Rota do motorista'}</p></div>
          <span className="hidden rounded-full bg-mint-400/15 px-3 py-1 text-[11px] font-bold text-mint-200 sm:inline-flex">{percentual}% concluído</span>
        </div>
      </header>
      <main className="mx-auto grid h-[calc(100dvh-4rem)] min-h-0 max-w-7xl grid-rows-[minmax(0,36%)_minmax(0,64%)] gap-2 overflow-hidden p-2 sm:gap-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_25rem] lg:grid-rows-1">
        <section className="relative min-h-0 overflow-hidden rounded-[1.6rem] bg-navy-100 shadow-2xl ring-1 ring-white/10">
          <MapaNavegacaoRotaReal paradas={paradas} trajeto={trajeto} progresso={progresso} seguindo={estado === 'movendo'} />
          <div className="pointer-events-none absolute left-3 right-3 top-3 flex items-start justify-between gap-3 sm:left-5 sm:right-5 sm:top-5">
            <div className="rounded-2xl bg-navy-950/90 px-4 py-3 shadow-xl backdrop-blur"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-mint-300">{estado === 'finalizada' ? 'Rota concluída' : estado === 'chegou' ? 'Você chegou' : estado === 'movendo' ? 'Em deslocamento' : 'Rota pronta'}</p><p className="mt-1 max-w-[14rem] font-display text-base font-extrabold text-white">{estado === 'finalizada' ? 'Todos os eventos registrados' : nomeParada(paradaAlvo)}</p></div>
            <div className="rounded-2xl bg-white/95 px-3 py-2 text-right text-xs font-bold text-navy-900 shadow-lg"><span className="block text-[10px] uppercase tracking-widest text-navy-500">Paradas</span>{Math.min(indiceAtual, paradas.length - 1)} / {Math.max(0, paradas.length - 1)}</div>
          </div>
        </section>
        <aside className="grid min-h-0 min-w-0 grid-cols-2 grid-rows-[auto_auto_auto_minmax(0,1fr)] gap-2 overflow-hidden lg:flex lg:flex-col lg:gap-3">
          <section className="col-span-2 min-h-0 rounded-[1.6rem] bg-navy-900 p-3 shadow-xl ring-1 ring-white/10 sm:p-5 lg:col-span-1">
            <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-mint-300">Operação da van</p><h1 className="mt-1 font-display text-2xl font-extrabold">{estado === 'finalizada' ? 'Viagem finalizada' : estado === 'chegou' ? 'Confirme a parada' : estado === 'movendo' ? 'Em deslocamento' : 'Pronta para sair'}</h1></div><Navigation className="h-7 w-7 shrink-0 text-mint-300" /></div>
            <p className="mt-2 hidden text-sm leading-relaxed text-white/65 sm:mt-3 sm:block">O mapa mostra o trajeto real. A viagem só avança depois que você confirma quem embarcou e quem desembarcou.</p>
            <button className="btn btn-md btn-primary mt-3 w-full sm:btn-lg sm:mt-5" disabled={estado === 'movendo' || estado === 'finalizada'} onClick={estado === 'chegou' ? confirmarParada : estado === 'pronta' || estado === 'confirmada' ? iniciarRota : undefined}>
              {estado === 'movendo' ? <><Clock3 className="h-5 w-5 animate-pulse" /> {textoAcao}</> : estado === 'finalizada' ? <><CheckCircle2 className="h-5 w-5" /> {textoAcao}</> : estado === 'chegou' ? <><Check className="h-5 w-5" /> {textoAcao}</> : <><Play className="h-5 w-5" /> {textoAcao}</>}
            </button>
            {estado === 'finalizada' && <button className="btn btn-md btn-ghost mt-2 w-full border border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={reiniciar}><RotateCcw className="h-4 w-4" /> Reiniciar rota</button>}
            {erroOperacao && <p role="alert" className="mt-2 flex items-start gap-2 rounded-xl bg-red-500/15 p-2 text-xs text-red-100 sm:mt-3 sm:p-3 sm:text-sm"><XCircle className="mt-0.5 h-4 w-4 shrink-0" />{erroOperacao}</p>}
          </section>
          <section className="col-span-2 grid grid-cols-3 gap-1 rounded-[1.6rem] bg-white p-2 text-center text-navy-900 shadow-xl ring-1 ring-white/10 sm:gap-2 sm:p-3 lg:col-span-1">
            <div><Users className="mx-auto h-5 w-5 text-blue-600" /><strong className="mt-1 block font-display text-lg">{aBordo.length}</strong><span className="text-[11px] text-navy-500">a bordo</span></div>
            <div><CheckCircle2 className="mx-auto h-5 w-5 text-mint-600" /><strong className="mt-1 block font-display text-lg">{entregues.length}</strong><span className="text-[11px] text-navy-500">entregues</span></div>
            <div><Users className="mx-auto h-5 w-5 text-amber-600" /><strong className="mt-1 block font-display text-lg">{Math.max(0, capacidade - aBordo.length)}</strong><span className="text-[11px] text-navy-500">livres</span></div>
          </section>
          <section className="col-span-2 min-h-0 rounded-[1.6rem] bg-white p-3 text-navy-900 shadow-xl ring-1 ring-white/10 sm:p-5 lg:col-span-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-navy-400">{estado === 'chegou' ? 'Operação desta parada' : 'Próxima parada'}</p>
            <h2 className="mt-1 font-display text-lg font-extrabold">{estado === 'finalizada' ? 'Todos chegaram' : nomeParada(paradaAlvo)}</h2>
            {estado === 'chegou' && <p className="mt-1 text-xs text-navy-500">Confirme a operação para registrar a viagem e liberar a próxima etapa.</p>}
            {alunosNaParada.length > 0 && <div className="mt-2 space-y-1 sm:mt-3 sm:space-y-2">{alunosNaParada.map(({ p, acao }) => <div key={`${acao}-${p.id}`} className="flex items-center justify-between gap-2 rounded-xl bg-navy-50 px-3 py-1.5 text-xs sm:py-2 sm:text-sm"><span className="min-w-0 truncate font-semibold">{nomePassageiro(p)}</span><span className={cn('shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase', acao === 'embarca' ? 'bg-mint-100 text-mint-700' : 'bg-blue-100 text-blue-700')}>{acao}</span></div>)}</div>}
            {estado === 'chegou' && alunosNaParada.length === 0 && <p className="mt-2 rounded-xl bg-navy-50 p-2 text-xs text-navy-600 sm:mt-3 sm:p-3 sm:text-sm">Nenhum aluno associado a esta parada. Confirme para continuar.</p>}
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-navy-100 sm:mt-4 sm:h-2"><div className="h-full rounded-full bg-mint-500 transition-[width] duration-300" style={{ width: `${percentual}%` }} /></div>
          </section>
          <section className="min-h-0 overflow-hidden rounded-[1.6rem] bg-white p-3 text-navy-900 shadow-xl ring-1 ring-white/10 sm:p-5">
            <div className="flex items-center justify-between"><h2 className="font-display text-sm font-extrabold sm:text-base">Passageiros a bordo</h2><span className="text-xs font-semibold text-navy-400">{aBordo.length}/{capacidade}</span></div>
            <div className="mt-2 max-h-16 space-y-1 overflow-hidden sm:mt-3 sm:max-h-none sm:space-y-2">{aBordo.length ? aBordo.map((p) => <div key={p.id} className="flex items-center gap-2 rounded-xl bg-mint-50 px-2 py-1.5 text-xs sm:gap-3 sm:px-3 sm:py-2 sm:text-sm"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-mint-500 text-[10px] font-bold text-white sm:h-7 sm:w-7 sm:text-xs">{nomePassageiro(p).slice(0, 1).toUpperCase()}</span><span className="min-w-0 flex-1 truncate font-semibold">{nomePassageiro(p)}</span><span className="text-[9px] font-bold uppercase text-mint-700 sm:text-[10px]">a bordo</span></div>) : <p className="rounded-xl bg-navy-50 p-2 text-xs text-navy-500 sm:p-3 sm:text-sm">Nenhum aluno a bordo ainda.</p>}</div>
          </section>
          <section className="min-h-0 overflow-hidden rounded-[1.6rem] bg-white p-3 text-navy-900 shadow-xl ring-1 ring-white/10 sm:p-5">
            <div className="flex items-center justify-between"><h2 className="font-display text-sm font-extrabold sm:text-base">Histórico</h2><span className="text-xs font-semibold text-navy-400">{eventos.length}</span></div>
            <div className="mt-2 max-h-16 space-y-1 overflow-hidden text-xs sm:mt-3 sm:max-h-none sm:space-y-2 sm:text-sm">{eventos.length ? eventos.map((evento, i) => <div key={i} className="flex gap-2 text-navy-600"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-600 sm:h-4 sm:w-4" />{evento.texto}</div>) : <p className="text-navy-500">As confirmações aparecerão aqui.</p>}</div>
          </section>
        </aside>
      </main>
    </div>
  );
}

export function NavegacaoRotaRealPage() {
  return <ExigirMotorista><NavegacaoProtegida /></ExigirMotorista>;
}
