import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, MapPin, Navigation, Play, RotateCcw, Route as RouteIcon } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ExigirMotorista, MotoristaShell } from './MotoristaShell';
import { obterRota } from '@/data/motorista-store';
import { trajetoOSRM, type TrajetoRota } from '@/lib/geocode';
import type { Rota } from '@/types/motorista';
import { MapaNavegacaoRotaReal } from '@/components/motorista/MapaNavegacaoRotaReal';
import { cn, nomeDestinoParaExibicao } from '@/lib/utils';

function NavegacaoProtegida() {
  const { id } = useParams();
  const [rota, setRota] = useState<Rota | null>(null);
  const [trajeto, setTrajeto] = useState<TrajetoRota | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [seguindo, setSeguindo] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const frameRef = useRef<number | null>(null);
  const inicioRef = useRef<number | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      if (!id) { setErro('Rota não informada.'); setCarregando(false); return; }
      try {
        const r = await obterRota(id);
        if (!r) throw new Error('Esta rota não está disponível para o motorista conectado.');
        const pontos = [...r.paradas].sort((a, b) => a.ordem - b.ordem).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
        if (pontos.length < 2) throw new Error('A rota precisa ter pelo menos duas paradas geolocalizadas.');
        const t = await trajetoOSRM(pontos.map((p) => ({ lat: p.lat as number, lng: p.lng as number })));
        if (!t?.geometria.length) throw new Error('Não foi possível carregar o trajeto pelas ruas.');
        if (vivo) { setRota(r); setTrajeto(t); }
      } catch (e) {
        if (vivo) setErro((e as Error).message || 'Não foi possível carregar a rota.');
      } finally { if (vivo) setCarregando(false); }
    })();
    return () => { vivo = false; if (frameRef.current != null) cancelAnimationFrame(frameRef.current); };
  }, [id]);

  useEffect(() => {
    if (!seguindo || !trajeto) return;
    const duracao = Math.max(18000, Math.min(50000, trajeto.geometria.length * 90));
    const tick = (agora: number) => {
      if (inicioRef.current == null) inicioRef.current = agora - progresso * duracao;
      const p = Math.min(1, (agora - inicioRef.current) / duracao);
      setProgresso(p);
      if (p < 1) frameRef.current = requestAnimationFrame(tick);
      else setSeguindo(false);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current != null) cancelAnimationFrame(frameRef.current); };
  }, [seguindo, trajeto]);

  const paradas = useMemo(() => [...(rota?.paradas ?? [])].sort((a, b) => a.ordem - b.ordem), [rota]);
  const paradaAtual = Math.min(paradas.length - 1, Math.floor(progresso * Math.max(1, paradas.length - 1)));
  const proxima = paradas[Math.min(paradas.length - 1, paradaAtual + (progresso >= 1 ? 0 : 1))];
  const chegou = progresso >= 1;

  function reiniciar() {
    if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    inicioRef.current = null;
    setProgresso(0);
    setSeguindo(false);
  }

  if (carregando) return <MotoristaShell titulo="Navegação real" voltarPara="/painel/rotas"><div className="flex justify-center py-20 text-navy-400"><Loader2 className="h-7 w-7 animate-spin" /></div></MotoristaShell>;
  if (erro || !rota || !trajeto) return <MotoristaShell titulo="Navegação real" voltarPara="/painel/rotas"><div className="card p-7 text-center"><RouteIcon className="mx-auto h-10 w-10 text-navy-300" /><h1 className="mt-4 font-display text-xl font-bold text-navy-900">Não foi possível abrir a rota</h1><p className="mt-2 text-sm text-navy-600">{erro}</p><Link to="/painel/rotas" className="btn btn-lg btn-primary mt-6 w-full">Voltar para minhas rotas</Link></div></MotoristaShell>;

  return (
    <div className="min-h-dvh bg-navy-950 text-white">
      <header className="relative z-20 border-b border-white/10 bg-navy-950/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to={`/app/rotas/${rota.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
          <div className="text-center"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-mint-300">Navegação real</p><p className="font-display text-sm font-extrabold">{rota.nome || 'Rota do motorista'}</p></div>
          <span className="hidden rounded-full bg-mint-400/15 px-3 py-1 text-[11px] font-bold text-mint-200 sm:inline-flex">Mapa ao vivo</span>
        </div>
      </header>
      <main className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-6xl gap-4 p-3 sm:p-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="relative min-h-[62dvh] overflow-hidden rounded-[1.6rem] bg-navy-100 shadow-2xl ring-1 ring-white/10 lg:min-h-[calc(100dvh-7rem)]">
          <MapaNavegacaoRotaReal paradas={paradas} trajeto={trajeto} progresso={progresso} seguindo={seguindo} />
          <div className="pointer-events-none absolute left-3 right-3 top-3 flex items-start justify-between gap-3 sm:left-5 sm:right-5 sm:top-5">
            <div className="rounded-2xl bg-navy-950/90 px-4 py-3 shadow-xl backdrop-blur"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-mint-300">Rota pelas ruas</p><p className="mt-1 font-display text-base font-extrabold text-white">{chegou ? 'Rota concluída' : 'Seguindo o trajeto real'}</p></div>
            <div className="rounded-2xl bg-white/95 px-3 py-2 text-right text-xs font-bold text-navy-900 shadow-lg"><span className="block text-[10px] uppercase tracking-widest text-navy-500">Progresso</span>{Math.round(progresso * 100)}%</div>
          </div>
        </section>
        <aside className="flex flex-col gap-3">
          <section className="rounded-[1.6rem] bg-navy-900 p-5 shadow-xl ring-1 ring-white/10">
            <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-mint-300">VanBora Motoristas</p><h1 className="mt-1 font-display text-2xl font-extrabold">{chegou ? 'Você chegou' : 'Em deslocamento'}</h1></div><Navigation className="h-7 w-7 text-mint-300" /></div>
            <p className="mt-3 text-sm leading-relaxed text-white/65">A van acompanha a linha azul pelas ruas reais, sem animação aérea ou caminho artificial.</p>
            <button className="btn btn-lg btn-primary mt-5 w-full" onClick={() => { if (chegou) reiniciar(); else setSeguindo((v) => !v); }}>
              {chegou ? <><RotateCcw className="h-5 w-5" /> Recomeçar rota</> : seguindo ? <><MapPin className="h-5 w-5" /> Pausar deslocamento</> : <><Play className="h-5 w-5" /> Iniciar rota</>}
            </button>
          </section>
          <section className="rounded-[1.6rem] bg-white p-5 text-navy-900 shadow-xl ring-1 ring-white/10">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-navy-400">Próxima parada</p>
            <h2 className="mt-1 font-display text-lg font-extrabold">{proxima?.tipo === 'escola' ? nomeDestinoParaExibicao(proxima.destinoNome || proxima.rotulo || 'Escola') : (proxima?.rotulo || 'Parada')}</h2>
            <p className="mt-1 text-xs text-navy-500">{proxima?.tipo === 'escola' ? 'Destino escolar' : proxima?.tipo === 'saida' ? 'Ponto de saída' : 'Embarque de passageiro'}</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-navy-100"><div className="h-full rounded-full bg-mint-500 transition-[width] duration-300" style={{ width: `${Math.round(progresso * 100)}%` }} /></div>
          </section>
          <section className="rounded-[1.6rem] bg-white p-5 text-navy-900 shadow-xl ring-1 ring-white/10">
            <div className="flex items-center justify-between"><h2 className="font-display font-extrabold">Paradas da rota</h2><span className="text-xs font-semibold text-navy-400">{paradas.length} pontos</span></div>
            <div className="mt-3 space-y-2">{paradas.map((p, i) => <div key={p.id} className={cn('flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition', i <= paradaAtual ? 'bg-mint-50 text-navy-900' : 'text-navy-500')}><span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold', i < paradaAtual ? 'bg-mint-500 text-white' : i === paradaAtual ? 'bg-navy-900 text-white' : 'bg-navy-100 text-navy-500')}>{i < paradaAtual ? <CheckCircle2 className="h-4 w-4" /> : i + 1}</span><span className="min-w-0 flex-1 truncate">{p.tipo === 'escola' ? (p.destinoNome || p.rotulo || 'Escola') : (p.rotulo || (p.tipo === 'saida' ? 'Saída' : 'Casa'))}</span></div>)}</div>
          </section>
        </aside>
      </main>
    </div>
  );
}

export function NavegacaoRotaRealPage() {
  return <ExigirMotorista><NavegacaoProtegida /></ExigirMotorista>;
}
