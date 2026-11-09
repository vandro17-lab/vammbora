import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Sparkles, MapPin, CheckCircle2, AlertTriangle, ChevronRight, Zap, Users, Eye, MessageCircle, TrendingUp, School, Navigation, Map as MapIcon } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Avatar } from '@/components/brand/Avatar';
import { VMShell } from '@/components/vm/VMShell';
import { Card, SubHeader, DemoChip, EstadoVazio } from '@/components/vm/ui';
import { SlotIlustracao } from '@/components/vm/SlotImagem';
import { useDadosMotorista } from '@/lib/vm/useDadosMotorista';
import { OPORTUNIDADES_VM, simularEncaixe, DIAS_UTEIS_MES } from '@/lib/vm/encaixe';
import { formatBRL, cn } from '@/lib/utils';

/** Pontos de referência de bairros: posições aproximadas para demonstração,
 * nunca endereços de famílias nem medições reais de procura. */
const REGIOES = [
  { id: 'ipanema', nome: 'Jardim Ipanema', lat: -21.190, lng: -50.450, procura: 18, oferta: 5, turno: 'Manhã', destino: 'Fatec Araçatuba' },
  { id: 'centro', nome: 'Centro', lat: -21.208, lng: -50.433, procura: 13, oferta: 6, turno: 'Tarde', destino: 'Colégio Paineiras' },
  { id: 'umuarama', nome: 'Umuarama', lat: -21.192, lng: -50.418, procura: 15, oferta: 4, turno: 'Manhã', destino: 'Fatec Araçatuba' },
  { id: 'jussara', nome: 'Jussara', lat: -21.222, lng: -50.448, procura: 11, oferta: 3, turno: 'Noite', destino: 'Fatec Araçatuba' },
] as const;
type Regiao = typeof REGIOES[number];
type Aba = 'radar' | 'rota' | 'interesses' | 'analise';
const ABAS: { id: Aba; nome: string }[] = [
  { id: 'radar', nome: 'Radar' }, { id: 'rota', nome: 'Na sua rota' },
  { id: 'interesses', nome: 'Interesses' }, { id: 'analise', nome: 'Análises' },
];

/** O mapa só desenha dados visuais. Nenhum endpoint do aplicativo é alterado. */
function MapaOportunidades({ regioes, selecionada, onSelecionar }: {
  regioes: readonly Regiao[]; selecionada: string; onSelecionar: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const camada = useRef<L.LayerGroup | null>(null);
  const [falha, setFalha] = useState(false);
  useEffect(() => {
    if (!container.current || map.current) return;
    try {
      const m = L.map(container.current, { zoomControl: false, scrollWheelZoom: false }).setView([-21.205, -50.435], 12);
      map.current = m;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors', maxZoom: 18,
      }).on('tileerror', () => setFalha(true)).addTo(m);
      L.control.zoom({ position: 'bottomright' }).addTo(m);
      camada.current = L.layerGroup().addTo(m);
      const resize = window.setTimeout(() => m.invalidateSize(), 150);
      return () => { window.clearTimeout(resize); m.remove(); map.current = null; camada.current = null; };
    } catch { setFalha(true); }
  }, []);
  useEffect(() => {
    const group = camada.current;
    if (!group) return;
    group.clearLayers();
    regioes.forEach((r) => {
      const active = selecionada === r.id;
      const cor = active ? '#171717' : '#eab308';
      const circle = L.circleMarker([r.lat, r.lng], {
        radius: active ? 19 : 14, color: '#fff', weight: 3, fillColor: cor, fillOpacity: 0.95,
      }).addTo(group);
      circle.bindTooltip(r.nome, { direction: 'top', offset: [0, -12] });
      circle.on('click', () => onSelecionar(r.id));
    });
  }, [regioes, selecionada, onSelecionar]);
  return (
    <div className="relative overflow-hidden rounded-[22px] border border-stone-200 bg-[#e9ece8]">
      <div ref={container} className="h-[290px] w-full" aria-label="Mapa interativo de Araçatuba" />
      <div className="pointer-events-none absolute left-3 top-3 z-[400] rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold text-stone-800 shadow-sm">
        <MapPin className="mr-1 inline h-3.5 w-3.5 text-amber-500" /> Araçatuba · SP
      </div>
      {falha && <div className="absolute bottom-3 left-3 z-[400] max-w-[70%] rounded-xl bg-white/95 p-2 text-[11px] font-medium text-stone-700 shadow">Mapa indisponível sem conexão. Selecione uma região abaixo.</div>}
    </div>
  );
}

export function OportunidadesPage() {
  const { dados } = useDadosMotorista();
  const [aba, setAba] = useState<Aba>('radar');
  const [turno, setTurno] = useState('Todos');
  const [regiaoId, setRegiaoId] = useState<string>('ipanema');
  const [periodo, setPeriodo] = useState('30 dias');
  const regioes = useMemo(() => REGIOES.filter(r => turno === 'Todos' || r.turno === turno), [turno]);
  const regiao = regioes.find(r => r.id === regiaoId) ?? regioes[0];
  const compativeis = useMemo(() => OPORTUNIDADES_VM
    .map(op => ({ op, r: simularEncaixe(dados, op) }))
    .filter(x => x.r.cabe)
    .sort((a, b) => b.r.compatibilidadePct - a.r.compatibilidadePct), [dados]);
  return (
    <VMShell>
      <header className="vm-grad relative overflow-hidden px-5 pb-7 pt-[calc(env(safe-area-inset-top)+1rem)] text-white">
        <div className="relative z-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold tracking-wide text-yellow-200"><Sparkles className="h-3.5 w-3.5" /> VANBORA MOTORISTAS</span>
          <h1 className="mt-3 font-display text-[29px] font-extrabold leading-tight">Oportunidades<span className="text-yellow-300">.</span></h1>
          <p className="mt-1 max-w-[290px] text-sm leading-snug text-stone-200">Descubra caminhos para aproveitar melhor suas vagas.</p>
        </div>
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full border-[30px] border-yellow-400/10" />
      </header>
      <div className="space-y-4 px-4 pb-5 pt-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-stone-600"><MapPin className="mr-1 inline h-3.5 w-3.5" /> Araçatuba, São Paulo</p>
          <DemoChip />
        </div>
        <div className="grid grid-cols-4 gap-1 rounded-2xl bg-stone-200/60 p-1" role="tablist" aria-label="Tipos de oportunidade">
          {ABAS.map(a => <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} onClick={() => setAba(a.id)}
            className={cn('min-w-0 rounded-xl px-1 py-2.5 text-[11px] font-bold transition', aba === a.id ? 'bg-yellow-400 text-stone-950 shadow-sm' : 'text-stone-600')}>{a.nome}</button>)}
        </div>
        {aba === 'radar' && <>
          <div className="flex items-center justify-between">
            <div><h2 className="font-display text-lg font-extrabold text-stone-900">Radar de demanda</h2><p className="text-xs text-stone-500">Explore regiões com procura ilustrativa</p></div>
            <select aria-label="Filtrar turno" value={turno} onChange={e => setTurno(e.target.value)} className="rounded-xl border border-stone-200 bg-white px-2 py-2 text-xs font-bold text-stone-800">
              {['Todos','Manhã','Tarde','Noite'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <MapaOportunidades regioes={regioes} selecionada={regiao?.id ?? ''} onSelecionar={setRegiaoId} />
          <p className="text-[11px] leading-relaxed text-stone-500">Mapa real de Araçatuba (OpenStreetMap). Os círculos representam bairros aproximados; procura e oferta são exemplos fictícios.</p>
          {regiao && <Card className="border-yellow-200 bg-gradient-to-br from-white to-yellow-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div><span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-700">Região selecionada</span><h3 className="mt-1 font-display text-lg font-extrabold text-stone-900">{regiao.nome}</h3><p className="text-xs text-stone-500">Destino de exemplo: {regiao.destino}</p></div>
              <span className="rounded-full bg-yellow-400 px-2.5 py-1 text-[10px] font-extrabold text-stone-950">{regiao.turno}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-white p-3"><p className="text-[11px] text-stone-500">Famílias buscando</p><p className="font-display text-2xl font-extrabold text-stone-900">{regiao.procura}</p></div>
              <div className="rounded-xl bg-white p-3"><p className="text-[11px] text-stone-500">Vans disponíveis</p><p className="font-display text-2xl font-extrabold text-stone-900">{regiao.oferta}</p></div>
            </div>
          </Card>}
          <h3 className="font-display text-sm font-extrabold text-stone-900">Explore outras regiões</h3>
          <div className="grid grid-cols-2 gap-2">{regioes.map(r => <button type="button" key={r.id} onClick={() => setRegiaoId(r.id)}
            className={cn('rounded-xl border p-3 text-left transition active:scale-[0.98]', regiao?.id === r.id ? 'border-yellow-400 bg-yellow-50' : 'border-stone-200 bg-white')}>
            <p className="text-xs font-bold text-stone-900">{r.nome}</p><p className="mt-1 text-[11px] text-stone-500">{r.procura} buscas · {r.oferta} vans</p>
          </button>)}</div>
        </>}
        {aba === 'rota' && <>
          <div className="rounded-2xl bg-stone-900 p-4 text-white"><span className="text-xs font-bold text-yellow-300"><Navigation className="mr-1 inline h-4 w-4" /> SUA ROTA</span><h2 className="mt-2 font-display text-xl font-extrabold">Mais alunos no seu caminho</h2><p className="mt-1 text-xs text-stone-300">Resultados do encaixe já existente, sem alterar sua rota.</p></div>
          {compativeis.length === 0 && <EstadoVazio icon={Zap} ilustracao={<SlotIlustracao slot="oportunidades.vazio" alt="" fallback={<Zap className="h-8 w-8" />} />} titulo="Nenhuma oportunidade compatível" texto="O motor não encontrou encaixes para esta rota. Explore o radar para conhecer regiões de exemplo." />}
          {compativeis.map(({ op, r }) => <Link key={op.id} to={`/app/oportunidades/${op.id}`} className="block">
            <Card className="vm-press flex items-center gap-3 p-3.5"><Avatar nome={op.regiao} className="h-11 w-11 text-sm" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-stone-900">{op.regiao} → {op.escola}</p><p className="text-xs text-stone-500">{op.alunos} aluno{op.alunos > 1 ? 's' : ''} · {op.turno}</p><p className="mt-1 text-xs font-bold text-amber-700"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" /> {r.compatibilidadePct}% de compatibilidade</p></div><ChevronRight className="h-5 w-5 text-stone-400" /></Card>
          </Link>)}
          <p className="text-center text-[11px] text-stone-500">Encaixes demonstrativos calculados pelo motor atual. Nenhum aluno é cadastrado nesta tela.</p>
        </>}
        {aba === 'interesses' && <>
          <div><h2 className="font-display text-xl font-extrabold text-stone-900">Interesse no seu perfil</h2><p className="text-xs text-stone-500">Prévia ilustrativa de um futuro painel de contatos.</p></div>
          <div className="flex justify-end"><select aria-label="Período" value={periodo} onChange={e => setPeriodo(e.target.value)} className="rounded-xl border border-stone-200 bg-white p-2 text-xs font-semibold">{['7 dias','30 dias','90 dias'].map(p => <option key={p}>{p}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4"><Eye className="h-6 w-6 text-amber-600" /><p className="mt-3 font-display text-3xl font-extrabold">{periodo === '7 dias' ? 64 : periodo === '90 dias' ? 812 : 286}</p><p className="text-xs text-stone-500">Visualizações (exemplo)</p></Card>
            <Card className="p-4"><MessageCircle className="h-6 w-6 text-amber-600" /><p className="mt-3 font-display text-3xl font-extrabold">{periodo === '7 dias' ? 8 : periodo === '90 dias' ? 109 : 37}</p><p className="text-xs text-stone-500">Cliques no contato (exemplo)</p></Card>
          </div>
          <Card className="p-4"><h3 className="font-display font-bold">Como funciona?</h3><p className="mt-2 text-sm leading-relaxed text-stone-600">No futuro, esta área poderá mostrar visitas e cliques registrados no aplicativo. Um clique no WhatsApp não significa conversa iniciada nem contratação.</p></Card>
          <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-4 text-xs text-amber-900">Dados ilustrativos, sem conexão com métricas reais de visitantes.</div>
        </>}
        {aba === 'analise' && <>
          <div><h2 className="font-display text-xl font-extrabold text-stone-900">Inteligência regional</h2><p className="text-xs text-stone-500">Cenário de demonstração · Araçatuba</p></div>
          <Card className="bg-stone-900 p-5 text-white"><TrendingUp className="h-6 w-6 text-yellow-300" /><p className="mt-3 text-xs text-stone-300">Oportunidades de crescimento</p><h3 className="mt-1 font-display text-2xl font-extrabold">Encontre regiões promissoras</h3><p className="mt-2 text-xs leading-relaxed text-stone-300">Compare a procura ilustrativa com a oferta disponível em cada região.</p></Card>
          {REGIOES.map(r => <Card key={r.id} className="p-3.5"><div className="flex items-center justify-between gap-2"><div><p className="text-sm font-bold text-stone-900">{r.nome}</p><p className="text-[11px] text-stone-500">{r.destino} · {r.turno}</p></div><span className="rounded-lg bg-yellow-100 px-2 py-1 text-xs font-extrabold text-amber-800">{r.procura - r.oferta} diferença</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-yellow-400" style={{width: `${Math.round(r.procura / 20 * 100)}%`}} /></div><p className="mt-1 text-[10px] text-stone-500">{r.procura} buscas ilustrativas · {r.oferta} vans ilustrativas</p></Card>)}
          <Card className="flex items-start gap-3 p-4"><School className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /><div><p className="text-sm font-extrabold text-stone-900">Fatec Araçatuba</p><p className="mt-1 text-xs text-stone-600">Av. Prestes Maia, 1764 · Jardim Ipanema</p><p className="mt-2 text-[11px] text-stone-500">Instituição real; dados de procura são fictícios.</p></div></Card>
        </>}
      </div>
    </VMShell>
  );
}

/* ========================== TELA 7 — Simular Encaixe ========================== */
export function SimularEncaixePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { dados } = useDadosMotorista();
  const [aceito, setAceito] = useState(false);
  const op = OPORTUNIDADES_VM.find((o) => o.id === id) ?? OPORTUNIDADES_VM[0];
  const r = useMemo(() => simularEncaixe(dados, op), [dados, op]);
  const c = r.comparativo;

  const linhas = [
    { label: 'Alunos', antes: c.alunosAntes, depois: c.alunosDepois },
    { label: 'Ocupação', antes: `${c.ocupAntesPct}%`, depois: `${c.ocupDepoisPct}%` },
    { label: 'Distância diária', antes: `${c.kmDiaAntes.toFixed(1).replace('.', ',')} km`, depois: `${c.kmDiaDepois.toFixed(1).replace('.', ',')} km` },
    { label: 'Diesel por dia', antes: `${c.dieselDiaAntes.toFixed(1).replace('.', ',')} L`, depois: `${c.dieselDiaDepois.toFixed(1).replace('.', ',')} L` },
    { label: 'Custo por dia', antes: formatBRL(c.custoDiaAntes), depois: formatBRL(c.custoDiaDepois) },
  ];

  return (
    <VMShell nav={false}>
      <SubHeader titulo="Simular encaixe" onVoltar={() => navigate('/app/oportunidades')} />
      <div className="space-y-3.5 px-4 pt-4">
        <Card className="flex items-center gap-3 p-4">
          <Avatar nome={op.regiao} className="h-11 w-11 text-sm" />
          <div>
            <p className="font-bold text-navy-900">{op.regiao} → {op.escola}</p>
            <p className="text-xs text-navy-500">{op.alunos} aluno{op.alunos > 1 ? 's' : ''} · {op.turno}</p>
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          <p className="px-4 pt-4 font-display font-bold text-navy-900">Comparativo da rota</p>
          <div className="mt-2 grid grid-cols-[1fr_auto_auto] items-center">
            <div className="px-4 py-2" />
            <div className="px-3 py-2 text-center text-[11px] font-semibold text-navy-500">Rota atual</div>
            <div className="rounded-t-lg bg-mint-50 px-3 py-2 text-center text-[11px] font-semibold text-mint-700">Com novo aluno</div>
            {linhas.map((l) => (
              <div key={l.label} className="contents">
                <div className="border-t border-navy-50 px-4 py-2.5 text-sm text-navy-600">{l.label}</div>
                <div className="border-t border-navy-50 px-3 py-2.5 text-center text-sm font-semibold text-navy-700">{l.antes}</div>
                <div className="border-t border-navy-50 bg-mint-50/60 px-3 py-2.5 text-center text-sm font-bold text-navy-900">{l.depois}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className={cn('p-4', r.cabe ? 'ring-mint-200' : 'ring-amber-200')}>
          <div className="flex items-start gap-3">
            <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-white', r.cabe ? 'bg-mint-500' : 'bg-amber-500')}>
              {r.cabe ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            </span>
            <div>
              <p className="font-display font-bold text-navy-900">Análise da oportunidade</p>
              <p className="mt-0.5 text-sm text-navy-600">
                {r.cabe
                  ? `O novo aluno acrescenta cerca de ${formatBRL(c.custoExtraDia)} por dia em combustível e mantém os horários da escola.`
                  : 'Esse aluno não cabe sem atrasar os outros além da tolerância ou passar do horário da escola.'}
              </p>
            </div>
          </div>
        </Card>

        {r.cabe && (
          <button onClick={() => setAceito(true)} disabled={aceito}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-mint-500 text-base font-bold text-white shadow-float transition active:scale-[0.98] disabled:opacity-70">
            {aceito ? 'Oportunidade marcada ✓' : 'Aceitar oportunidade'}
          </button>
        )}
        {aceito && (
          <p className="text-center text-xs text-navy-500">
            A simulação <strong>não altera</strong> sua rota. Para incluir de verdade, abra o{' '}
            <Link to="/painel/rotas" className="font-semibold text-mint-700 underline">construtor de rotas</Link> e confirme.
          </p>
        )}
        <p className="pb-2 text-center text-[11px] text-navy-400"><Users className="mr-1 inline h-3 w-3" />Cálculo do motor real sobre a sua rota · receita extra estimada {formatBRL(c.receitaExtraMes)}/mês ({DIAS_UTEIS_MES} dias úteis).</p>
      </div>
    </VMShell>
  );
}
