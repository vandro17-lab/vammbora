import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Home, Route as RouteIcon, Sparkles, Wallet, LayoutGrid, Users, CalendarDays, Bell, Fuel,
  Wrench, FileText, BarChart3, Gift, Car, User, ChevronRight, ArrowLeft, Clock, CheckCircle2,
  AlertTriangle, TrendingUp, Bus, School, MapPin, Star, Plus, ArrowRight,
} from 'lucide-react';
import { Avatar } from '@/components/brand/Avatar';
import { criarMatrizDemo, rotaOperacionalDeCadastro, partidaRetroativa, encontrarEncaixes } from '@/lib/encaixe';
import { minutosParaTextoHora, formatBRL, cn } from '@/lib/utils';
import {
  MOTORISTA_DEMO, VAN_DEMO, ALUNOS_DEMO, INDICADORES_DEMO, OPORTUNIDADES_DEMO, FINANCEIRO_DEMO,
  AVISOS_DEMO, CALENDARIO_DEMO, COMBUSTIVEL_DEMO, MANUTENCAO_DEMO, DOCUMENTOS_DEMO,
  rotaDemoManha, pedidoDaOportunidade, type OportunidadeDemo,
} from '@/data/motorista-demo';

/** Folga de saída (min): a van parte um pouco antes do horário mais apertado,
 *  deixando margem — é o que permite (ou não) encaixar um novo aluno. */
const FOLGA_SAIDA_MIN = 8;

type Aba = 'inicio' | 'rotas' | 'oportunidades' | 'financeiro' | 'mais';
const EASE = [0.22, 1, 0.36, 1] as const;

/** Gradiente de cada módulo (estilo lançador de apps). */
const TILE: Record<string, string> = {
  passageiros: 'from-sky-400 to-blue-600', vagas: 'from-mint-400 to-mint-600',
  calendario: 'from-violet-400 to-purple-600', avisos: 'from-amber-400 to-orange-500',
  combustivel: 'from-rose-400 to-red-500', manutencao: 'from-slate-400 to-slate-600',
  documentacao: 'from-teal-400 to-cyan-600', relatorios: 'from-indigo-400 to-indigo-600',
  clube: 'from-fuchsia-400 to-pink-600', alugavan: 'from-emerald-400 to-green-600',
  perfil: 'from-navy-400 to-navy-700',
};

/* ============================= Shell ============================= */
export function VamboraProPage() {
  const [aba, setAba] = useState<Aba>('inicio');
  const [modulo, setModulo] = useState<string | null>(null);
  const chaveTela = modulo ?? aba;

  function irPara(a: Aba) { setModulo(null); setAba(a); }

  return (
    <div className="relative min-h-dvh bg-navy-50 pb-28">
      {/* Cabeçalho fixo (glass) + faixa de protótipo */}
      <header className="sticky top-0 z-30 border-b border-navy-100/60 bg-white/80 backdrop-blur-xl">
        <div className="container-page max-w-xl">
          <div className="flex h-14 items-center justify-between">
            <Link to="/" className="inline-flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-navy-900 text-white"><Bus className="h-4 w-4" /></span>
              <span className="font-display text-[15px] font-extrabold tracking-tightest text-navy-900">Vam<span className="text-mint-500">bora</span> Pro</span>
            </Link>
            <span className="chip bg-amber-100/80 text-[10px] text-amber-800 ring-1 ring-amber-200">Protótipo · demo</span>
          </div>
        </div>
      </header>

      <main className="container-page max-w-xl py-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={chaveTela}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            {modulo ? (
              <ModuloDetalhe modulo={modulo} onVoltar={() => setModulo(null)} />
            ) : aba === 'inicio' ? (
              <Inicio irPara={irPara} abrir={setModulo} />
            ) : aba === 'rotas' ? (
              <Rotas />
            ) : aba === 'oportunidades' ? (
              <Oportunidades />
            ) : aba === 'financeiro' ? (
              <Financeiro />
            ) : (
              <Mais onAbrir={setModulo} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <BottomNav aba={aba} ativo={!modulo} onIr={irPara} />
    </div>
  );
}

/* ============================ Bottom Nav ============================ */
function BottomNav({ aba, ativo, onIr }: { aba: Aba; ativo: boolean; onIr: (a: Aba) => void }) {
  const itens = [
    ['inicio', Home, 'Início'], ['rotas', RouteIcon, 'Rotas'], ['oportunidades', Sparkles, 'Vagas'],
    ['financeiro', Wallet, 'Financeiro'], ['mais', LayoutGrid, 'Mais'],
  ] as const;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)]">
      <div className="container-page max-w-xl">
        <div className="mb-3 flex items-stretch justify-between rounded-2xl border border-navy-100/70 bg-white/90 p-1.5 shadow-float backdrop-blur-xl">
          {itens.map(([k, Icone, label]) => {
            const on = ativo && aba === k;
            return (
              <motion.button key={k} onClick={() => onIr(k)} whileTap={{ scale: 0.88 }}
                className="relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[10.5px] font-semibold">
                {on && (
                  <motion.span layoutId="navpill" className="absolute inset-0 rounded-xl bg-mint-500 shadow-glow"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
                )}
                <Icone className={cn('relative z-10 h-5 w-5 transition-colors', on ? 'text-white' : 'text-navy-400')} />
                <span className={cn('relative z-10 transition-colors', on ? 'text-white' : 'text-navy-400')}>{label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

/* ============================ Início ============================ */
function Inicio({ irPara, abrir }: { irPara: (a: Aba) => void; abrir: (m: string) => void }) {
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const atalhos = [
    { k: 'rota', Icone: Plus, label: 'Nova rota', to: '/painel/rota/nova' as const },
    { k: 'passageiros', Icone: Users, label: 'Passageiros', mod: 'passageiros' },
    { k: 'documentacao', Icone: FileText, label: 'Documentos', mod: 'documentacao' },
    { k: 'financeiro', Icone: Wallet, label: 'Financeiro', aba: 'financeiro' as Aba },
  ];
  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-brand-gradient grain p-5 text-white shadow-float">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-mint-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-navy-400/20 blur-3xl" />
        <div className="relative flex items-center gap-3.5">
          <Avatar nome={MOTORISTA_DEMO.nome} className="h-14 w-14 text-lg ring-2 ring-white/25" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-mint-200/90">{saudacao},</p>
            <p className="truncate font-display text-xl font-bold leading-tight">{MOTORISTA_DEMO.apelido}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="chip bg-white/15 py-0.5 text-[11px] text-white ring-1 ring-white/20">
                <Star className="h-3 w-3 fill-amber-300 text-amber-300" /> {MOTORISTA_DEMO.nota.toFixed(1).replace('.', ',')}
              </span>
              <span className="chip bg-white/10 py-0.5 text-[11px] text-navy-100">{MOTORISTA_DEMO.avaliacoes} avaliações</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats sobreposto */}
      <div className="-mt-10 relative">
        <div className="card flex divide-x divide-navy-100 p-0">
          <Indicador valor={INDICADORES_DEMO.alunos} rotulo="alunos" />
          <Indicador valor={INDICADORES_DEMO.vagas} rotulo="vagas" destaque />
          <Indicador valor={INDICADORES_DEMO.rotas} rotulo="rotas" />
          <Indicador valor={INDICADORES_DEMO.escolas} rotulo="escolas" />
        </div>
      </div>

      {/* Atalhos rápidos */}
      <div className="grid grid-cols-4 gap-2">
        {atalhos.map((a) => {
          const conteudo = (
            <>
              <span className={cn('grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-card',
                a.k === 'rota' ? 'from-mint-400 to-mint-600' : a.k === 'passageiros' ? 'from-sky-400 to-blue-600' : a.k === 'documentacao' ? 'from-teal-400 to-cyan-600' : 'from-violet-400 to-purple-600')}>
                <a.Icone className="h-5 w-5" />
              </span>
              <span className="text-[11px] font-medium text-navy-600">{a.label}</span>
            </>
          );
          const cls = 'flex flex-col items-center gap-1.5 active:scale-95 transition-transform';
          return a.to ? (
            <Link key={a.k} to={a.to} className={cls}>{conteudo}</Link>
          ) : (
            <button key={a.k} onClick={() => (a.aba ? irPara(a.aba) : abrir(a.mod!))} className={cls}>{conteudo}</button>
          );
        })}
      </div>

      {/* Rota de hoje */}
      <button onClick={() => irPara('rotas')} className="card card-interactive w-full overflow-hidden p-0 text-left">
        <div className="flex items-center gap-3 p-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-navy-900 text-white"><Bus className="h-6 w-6" /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-display font-bold text-navy-900">Rota de hoje</p>
              <span className="chip bg-mint-100 py-0.5 text-[10px] text-mint-800">Manhã · ida</span>
            </div>
            <p className="mt-0.5 truncate text-xs text-navy-500">{VAN_DEMO.modelo} · saída ~06h20 · {INDICADORES_DEMO.alunos} alunos</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-navy-300" />
        </div>
        <div className="h-1 w-full bg-navy-50"><div className="h-full bg-gradient-to-r from-mint-400 to-mint-600" style={{ width: '75%' }} /></div>
      </button>

      {/* Laboratório do motor (mesmo motor da busca) */}
      <Link to="/pro/encaixe" className="card card-interactive flex items-center gap-3 overflow-hidden p-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-400 to-indigo-600 text-white shadow-card"><RouteIcon className="h-6 w-6" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold text-navy-900">Testar encaixe inteligente</p>
          <p className="mt-0.5 text-xs text-navy-500">Ida, volta e horários — calculado pelo motor real</p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-navy-300" />
      </Link>

      {/* Avisos */}
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold">Avisos</h2>
          <span className="chip bg-amber-100 py-0.5 text-[10px] text-amber-800">{AVISOS_DEMO.length} novos</span>
        </div>
        <div className="mt-3 space-y-2">
          {AVISOS_DEMO.map((a, i) => (
            <motion.div key={a.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i, ease: EASE }}
              className="flex items-start gap-2.5 rounded-xl bg-navy-50 p-3 text-sm">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-600"><Bell className="h-3.5 w-3.5" /></span>
              <div className="flex-1"><p className="text-navy-700">{a.texto}</p><p className="text-xs text-navy-400">{a.quando}</p></div>
            </motion.div>
          ))}
        </div>
      </div>

      <button onClick={() => irPara('oportunidades')} className="btn btn-lg btn-primary w-full">
        <Sparkles className="h-5 w-5" /> Ver oportunidades
      </button>
    </div>
  );
}

function Indicador({ valor, rotulo, destaque }: { valor: number; rotulo: string; destaque?: boolean }) {
  return (
    <div className="flex-1 p-3 text-center">
      <p className={cn('font-display text-2xl font-bold', destaque ? 'text-mint-600' : 'text-navy-900')}><CountUp value={valor} /></p>
      <p className="text-[11px] text-navy-500">{rotulo}</p>
    </div>
  );
}

/** Contagem animada (respeita quem pede menos movimento). */
function CountUp({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) { setN(value); return; }
    let raf = 0; const start = performance.now(); const dur = 850;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduce]);
  return <>{n}</>;
}

/* ============================ Rotas ============================ */
function Rotas() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Minhas rotas</h1>
      {[['Rota da manhã — ida', 'ida'], ['Rota da manhã — volta', 'volta']].map(([nome, s], i) => (
        <motion.div key={nome} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 * i, ease: EASE }}
          className="card card-interactive overflow-hidden p-0">
          <div className="flex items-center gap-3 p-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-mint-400 to-mint-600 text-white"><RouteIcon className="h-5 w-5" /></span>
            <div className="flex-1">
              <p className="font-semibold text-navy-900">{nome}</p>
              <p className="mt-0.5 text-sm text-navy-500">{INDICADORES_DEMO.alunos} alunos · 2 escolas · Seg a Sex</p>
            </div>
            <span className="chip bg-mint-100 py-0.5 text-[10px] text-mint-800">concluída</span>
          </div>
          <div className="flex items-center justify-between border-t border-navy-50 px-4 py-2 text-xs text-navy-400">
            <span>{s === 'ida' ? 'Casas → Escola' : 'Escola → Casas'}</span>
            <span className="inline-flex items-center gap-1 text-mint-600">ver detalhes <ArrowRight className="h-3.5 w-3.5" /></span>
          </div>
        </motion.div>
      ))}
      <Link to="/painel/rota/nova" className="btn btn-lg btn-navy flex w-full">
        <Plus className="h-5 w-5" /> Montar uma rota de verdade
      </Link>
      <p className="text-center text-xs text-navy-400">O construtor visual grava uma rota real.</p>
    </div>
  );
}

/* ========================= Oportunidades ========================= */
function Oportunidades() {
  const [sel, setSel] = useState<OportunidadeDemo | null>(null);
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Oportunidades</h1>
      <p className="text-sm text-navy-600">Famílias procurando van na sua região. Toque para simular o impacto de aceitar — calculado pelo motor.</p>
      <div className="space-y-3">
        {OPORTUNIDADES_DEMO.map((op, i) => (
          <motion.button key={op.id} onClick={() => setSel(op)} whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 * i, ease: EASE }}
            className="card card-interactive flex w-full items-center gap-3 p-4 text-left">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-mint-400 to-mint-600 text-white shadow-card"><MapPin className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-navy-900">{op.regiao} → {op.escola}</p>
              <p className="text-xs text-navy-500">{op.turno} · {op.quando}</p>
            </div>
            <span className="chip bg-mint-50 py-1 text-[11px] text-mint-700">Simular</span>
          </motion.button>
        ))}
      </div>
      <p className="text-center text-xs text-navy-400">Sem dados pessoais das famílias.</p>
      <AnimatePresence>
        {sel && <SimuladorImpacto op={sel} onFechar={() => setSel(null)} />}
      </AnimatePresence>
    </div>
  );
}

function SimuladorImpacto({ op, onFechar }: { op: OportunidadeDemo; onFechar: () => void }) {
  const reduce = useReducedMotion();
  const opcao = useMemo(() => {
    // MESMO motor da busca das famílias (#7), sobre a rota demonstrativa com
    // coordenadas. A matriz de tempos é de demonstração (não trânsito real).
    const matriz = criarMatrizDemo();
    const base0 = rotaOperacionalDeCadastro(rotaDemoManha(), { capacidade: VAN_DEMO.lugares, partidaMin: 0 });
    if (!base0) return null;
    const latest = partidaRetroativa(base0, matriz);
    const base = { ...base0, partidaMin: (latest ?? op.limiteEscolaMin) - FOLGA_SAIDA_MIN };
    return encontrarEncaixes(base, pedidoDaOportunidade(op), matriz)[0] ?? null;
  }, [op]);

  const cabe = !!opcao;
  const Icone = cabe ? CheckCircle2 : AlertTriangle;
  const titulo = cabe ? 'Cabe na rota' : 'Não cabe sem prejudicar os outros';
  const motivoNaoCabe = op.escola === 'Colégio Paineiras'
    ? 'Essa casa fica fora do alcance da rota: encaixar atrasaria os outros alunos em mais de 10 minutos ou passaria do horário final.'
    : 'Esta rota não atende essa escola. O motor só oferece escolas que já fazem parte do itinerário.';

  return (
    <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/50 p-0 sm:items-center sm:p-5"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={onFechar}>
      <motion.div className="w-full max-w-md overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl"
        initial={reduce ? { opacity: 0 } : { y: '100%' }} animate={reduce ? { opacity: 1 } : { y: 0 }} exit={reduce ? { opacity: 0 } : { y: '100%' }}
        transition={{ type: 'spring', stiffness: 360, damping: 34 }} onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-navy-100 sm:hidden" />

        {/* Cabeçalho colorido do resultado */}
        <div className={cn('px-6 pb-5 pt-4', cabe ? 'bg-mint-50' : 'bg-red-50')}>
          <p className="text-xs font-medium text-navy-500">E se eu aceitar este aluno?</p>
          <p className="mt-0.5 text-sm font-semibold text-navy-700">{op.regiao} → {op.escola} · {op.turno}</p>
          <div className="mt-3 flex items-center gap-3">
            <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white', cabe ? 'bg-mint-500' : 'bg-red-500')}>
              <Icone className="h-6 w-6" />
            </span>
            <p className={cn('font-display text-lg font-bold leading-tight', cabe ? 'text-mint-800' : 'text-red-700')}>{titulo}</p>
          </div>
        </div>

        <div className="px-6 py-5">
          {cabe && opcao ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-navy-50 p-3">
                  <p className="inline-flex items-center gap-1.5 text-xs text-navy-500"><Home className="h-3.5 w-3.5" /> Busca em casa</p>
                  <p className="mt-1 font-display text-xl font-bold text-navy-900">{minutosParaTextoHora(opcao.horarioBuscaMin)}</p>
                </div>
                <div className="rounded-2xl bg-navy-50 p-3">
                  <p className="inline-flex items-center gap-1.5 text-xs text-navy-500"><School className="h-3.5 w-3.5" /> Chega à escola</p>
                  <p className="mt-1 font-display text-xl font-bold text-navy-900">{minutosParaTextoHora(opcao.horarioEntregaMin)}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <span className="chip bg-navy-50 text-navy-600"><Clock className="h-3.5 w-3.5" /> {opcao.minutosABordo} min a bordo</span>
                <span className="chip bg-navy-50 text-navy-600">+{opcao.desvioMin} min de desvio</span>
                <span className="chip bg-mint-100 text-mint-800">outros alunos: até 10 min de variação</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-navy-700">{motivoNaoCabe}</p>
          )}
          <p className="mt-4 text-xs text-navy-400">Cálculo real do motor de compatibilidade, sobre a rota demonstrativa (matriz de tempos de exemplo). Sujeito à confirmação do motorista; não reserva vaga nem substitui a aprovação dos documentos.</p>
          <button className="btn btn-lg btn-navy mt-4 w-full" onClick={onFechar}>Entendi</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ============================ Financeiro ============================ */
function Financeiro() {
  const reduce = useReducedMotion();
  const max = Math.max(...FINANCEIRO_DEMO.porMes.map((m) => m.valor));
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Financeiro</h1>
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-mint-100 text-mint-700"><Wallet className="h-4 w-4" /></span>
          <p className="mt-2 text-xs text-navy-500">Receita do mês</p>
          <p className="mt-0.5 font-display text-2xl font-bold text-navy-900">{formatBRL(INDICADORES_DEMO.receitaMes)}</p>
        </div>
        <div className="card p-4">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-100 text-amber-700"><Clock className="h-4 w-4" /></span>
          <p className="mt-2 text-xs text-navy-500">A receber</p>
          <p className="mt-0.5 font-display text-2xl font-bold text-amber-600">{formatBRL(INDICADORES_DEMO.aReceber)}</p>
        </div>
      </div>
      <div className="card p-5">
        <div className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-mint-600" /><h2 className="font-display font-bold">Últimos meses</h2></div>
        <div className="mt-4 flex items-end justify-between gap-2">
          {FINANCEIRO_DEMO.porMes.map((m, i) => (
            <div key={m.mes} className="flex flex-1 flex-col items-center justify-end gap-1.5">
              <span className="text-[10px] font-semibold text-navy-500">{(m.valor / 1000).toFixed(1)}k</span>
              <motion.div className="w-full rounded-t-lg bg-gradient-to-t from-mint-500 to-mint-300"
                initial={reduce ? false : { height: 0 }} animate={{ height: `${Math.round((m.valor / max) * 120)}px` }}
                transition={{ delay: 0.05 * i, duration: 0.6, ease: EASE }} />
              <span className="text-[11px] text-navy-400">{m.mes}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="card p-5">
        <h2 className="font-display font-bold">Mensalidades</h2>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <span className="chip bg-mint-100 text-mint-800"><CheckCircle2 className="h-3.5 w-3.5" /> {FINANCEIRO_DEMO.pagos} pagas</span>
          <span className="chip bg-amber-100 text-amber-800"><Clock className="h-3.5 w-3.5" /> {FINANCEIRO_DEMO.emAtraso} em atraso</span>
          <span className="chip bg-navy-50 text-navy-600">{formatBRL(FINANCEIRO_DEMO.mensalidade)}/aluno</span>
        </div>
      </div>
      <p className="text-center text-xs text-navy-400">Valores demonstrativos. Não representam cobrança real.</p>
    </div>
  );
}

/* ============================== Mais ============================== */
function Mais({ onAbrir }: { onAbrir: (m: string) => void }) {
  const itens = [
    ['passageiros', Users, 'Passageiros'], ['vagas', Sparkles, 'Vagas por trecho'],
    ['calendario', CalendarDays, 'Calendário'], ['avisos', Bell, 'Avisos'],
    ['combustivel', Fuel, 'Combustível'], ['manutencao', Wrench, 'Manutenção'],
    ['documentacao', FileText, 'Documentação'], ['relatorios', BarChart3, 'Relatórios'],
    ['clube', Gift, 'Clube do Motorista'], ['alugavan', Car, 'AlugaVan'],
    ['perfil', User, 'Perfil'],
  ] as const;
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Mais</h1>
      <div className="grid grid-cols-2 gap-3">
        {itens.map(([k, Icone, label], i) => (
          <motion.button key={k} onClick={() => onAbrir(k)} whileTap={{ scale: 0.96 }}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 * i, ease: EASE }}
            className="card card-interactive flex items-center gap-3 p-4 text-left">
            <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-card', TILE[k])}>
              <Icone className="h-5 w-5" />
            </span>
            <span className="text-sm font-semibold leading-tight text-navy-900">{label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

/* ========================= Detalhe de módulo ========================= */
function ModuloDetalhe({ modulo, onVoltar }: { modulo: string; onVoltar: () => void }) {
  return (
    <div className="space-y-4">
      <button onClick={onVoltar} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-navy-600 shadow-card ring-1 ring-navy-100 hover:text-navy-900">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>
      {modulo === 'passageiros' && <Passageiros />}
      {modulo === 'vagas' && <Vagas />}
      {modulo === 'calendario' && <Calendario />}
      {modulo === 'avisos' && <ListaSimples titulo="Avisos" itens={AVISOS_DEMO.map((a) => `${a.texto} (${a.quando})`)} />}
      {modulo === 'combustivel' && <Combustivel />}
      {modulo === 'manutencao' && <Manutencao />}
      {modulo === 'documentacao' && <Documentacao />}
      {modulo === 'relatorios' && <VisaoFutura titulo="Relatórios" texto="Relatórios de frequência, ocupação e receita. Entram com os dados reais em operação." />}
      {modulo === 'clube' && <VisaoFutura titulo="Clube do Motorista" texto="Vantagens e parcerias para motoristas. Planejado para uma fase futura." />}
      {modulo === 'alugavan' && <VisaoFutura titulo="AlugaVan" texto="Aluguel de van para cobrir imprevistos. Planejado para uma fase futura." />}
      {modulo === 'perfil' && <Perfil />}
    </div>
  );
}

function Passageiros() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Passageiros <span className="text-navy-400">({ALUNOS_DEMO.length})</span></h1>
      <div className="mt-3 space-y-2">
        {ALUNOS_DEMO.map((a, i) => (
          <motion.div key={a.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.02 * i, ease: EASE }}
            className="card flex items-center gap-3 p-3">
            <Avatar nome={a.nome} className="h-9 w-9 text-xs" />
            <div className="flex-1"><p className="text-sm font-semibold text-navy-900">{a.nome}</p><p className="text-xs text-navy-500">{a.escola} · {a.regiao}</p></div>
            <span className="chip bg-navy-50 py-0.5 text-[11px] text-navy-500">{a.embarque}</span>
          </motion.div>
        ))}
      </div>
      <p className="mt-3 text-xs text-navy-400">Identificações curtas (apelidos), sem informações pessoais reais.</p>
    </div>
  );
}

function Vagas() {
  const trechos = [
    { onde: 'Centro → V. Mendonça', ocupados: 4 }, { onde: 'V. Mendonça → J. Nova Iorque', ocupados: 7 },
    { onde: 'J. Nova Iorque → Água Branca', ocupados: 9 }, { onde: 'Água Branca → Escola', ocupados: 12 },
  ];
  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Vagas por trecho</h1>
      <p className="mt-1 text-sm text-navy-600">A van enche ao longo da rota. A vaga de verdade depende do trecho.</p>
      <div className="mt-3 space-y-2">
        {trechos.map((t, i) => {
          const pct = (t.ocupados / VAN_DEMO.lugares) * 100;
          return (
            <div key={t.onde} className="card p-3">
              <div className="flex items-center justify-between text-sm"><span className="text-navy-700">{t.onde}</span><span className="font-semibold text-navy-900">{VAN_DEMO.lugares - t.ocupados} livre(s)</span></div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-navy-100">
                <motion.div className="h-full rounded-full bg-gradient-to-r from-mint-400 to-mint-600"
                  initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: 0.05 * i, duration: 0.6, ease: EASE }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Calendario() {
  return <ListaSimples titulo="Calendário" itens={CALENDARIO_DEMO.map((c) => `${c.dia}: ${c.evento}`)} />;
}
function Combustivel() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Combustível</h1>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="card p-4"><span className="grid h-9 w-9 place-items-center rounded-xl bg-rose-100 text-rose-600"><Fuel className="h-4 w-4" /></span><p className="mt-2 text-xs text-navy-500">Consumo</p><p className="mt-0.5 font-display text-xl font-bold">{COMBUSTIVEL_DEMO.consumoKmL} km/L</p></div>
        <div className="card p-4"><span className="grid h-9 w-9 place-items-center rounded-xl bg-navy-100 text-navy-600"><Wallet className="h-4 w-4" /></span><p className="mt-2 text-xs text-navy-500">Gasto do mês</p><p className="mt-0.5 font-display text-xl font-bold">{formatBRL(COMBUSTIVEL_DEMO.gastoMes)}</p></div>
      </div>
      <p className="mt-3 text-sm text-navy-600">Último abastecimento: {COMBUSTIVEL_DEMO.ultimoAbastecimento}</p>
    </div>
  );
}
function Manutencao() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Manutenção</h1>
      <div className="mt-3 space-y-2">
        {MANUTENCAO_DEMO.map((m) => (
          <div key={m.item} className="card flex items-center justify-between p-3 text-sm">
            <span className="inline-flex items-center gap-2 text-navy-700"><Wrench className="h-4 w-4 text-navy-400" />{m.item}</span>
            <span className={cn('chip', m.status === 'ok' ? 'bg-mint-100 text-mint-800' : 'bg-amber-100 text-amber-800')}>{m.quando}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
function Documentacao() {
  const cor = (s: string) => s === 'aprovado' ? 'bg-mint-100 text-mint-800' : s === 'em_analise' ? 'bg-navy-100 text-navy-600' : 'bg-amber-100 text-amber-800';
  const txt = (s: string) => s === 'aprovado' ? 'Aprovado' : s === 'em_analise' ? 'Em análise' : 'Vence em breve';
  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Documentação</h1>
      <div className="mt-3 space-y-2">
        {DOCUMENTOS_DEMO.map((d) => (
          <div key={d.nome} className="card flex items-center justify-between p-3 text-sm">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-100 text-teal-600"><FileText className="h-4 w-4" /></span>
              <div><p className="font-semibold text-navy-900">{d.nome}</p><p className="text-xs text-navy-500">Validade: {d.validade}</p></div>
            </div>
            <span className={cn('chip', cor(d.status))}>{txt(d.status)}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-navy-400">Você só aparece às famílias com os documentos aprovados e válidos.</p>
    </div>
  );
}
function Perfil() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Perfil</h1>
      <div className="mt-3 card overflow-hidden p-0">
        <div className="bg-brand-gradient grain p-5 text-white">
          <div className="flex items-center gap-3">
            <Avatar nome={MOTORISTA_DEMO.nome} className="h-14 w-14 text-lg ring-2 ring-white/25" />
            <div>
              <p className="font-display text-lg font-bold">{MOTORISTA_DEMO.apelido}</p>
              <p className="inline-flex items-center gap-1 text-sm text-navy-200"><Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" /> {MOTORISTA_DEMO.nota.toFixed(1).replace('.', ',')} · {MOTORISTA_DEMO.cidade}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 p-5">
          <span className="chip bg-navy-50 text-navy-600"><School className="h-3.5 w-3.5" /> Fundamental e Médio</span>
          <span className="chip bg-navy-50 text-navy-600"><Bus className="h-3.5 w-3.5" /> {VAN_DEMO.modelo}</span>
          <span className="chip bg-navy-50 text-navy-600"><Users className="h-3.5 w-3.5" /> {VAN_DEMO.lugares} lugares</span>
        </div>
      </div>
    </div>
  );
}

function ListaSimples({ titulo, itens }: { titulo: string; itens: string[] }) {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold">{titulo}</h1>
      <div className="mt-3 space-y-2">
        {itens.map((t, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.03 * i, ease: EASE }}
            className="card p-3 text-sm text-navy-700">{t}</motion.div>
        ))}
      </div>
    </div>
  );
}
function VisaoFutura({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="card p-8 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-navy-100 to-navy-50 text-navy-400"><Sparkles className="h-7 w-7" /></span>
      <h1 className="mt-3 font-display text-lg font-bold">{titulo}</h1>
      <p className="mx-auto mt-2 max-w-sm text-navy-600">{texto}</p>
      <span className="mt-4 inline-block rounded-full bg-navy-100 px-3 py-1 text-xs font-medium text-navy-600">Visão de produto · fase futura</span>
    </div>
  );
}
