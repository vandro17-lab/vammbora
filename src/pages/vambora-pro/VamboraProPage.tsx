import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Home, Route as RouteIcon, Sparkles, Wallet, LayoutGrid, Users, CalendarDays, Bell, Fuel,
  Wrench, FileText, BarChart3, Gift, Car, User, ChevronRight, ArrowLeft, Clock, CheckCircle2,
  AlertTriangle, TrendingUp, Bus, School, MapPin,
} from 'lucide-react';
import { Avatar } from '@/components/brand/Avatar';
import { VanMark } from '@/components/brand/Logo';
import { montarEntradaMotor, avaliarRotaCandidata } from '@/lib/rota-para-motor';
import { minutosParaTextoHora, formatBRL, cn } from '@/lib/utils';
import {
  MOTORISTA_DEMO, VAN_DEMO, ALUNOS_DEMO, INDICADORES_DEMO, OPORTUNIDADES_DEMO, FINANCEIRO_DEMO,
  AVISOS_DEMO, CALENDARIO_DEMO, COMBUSTIVEL_DEMO, MANUTENCAO_DEMO, DOCUMENTOS_DEMO,
  rotaDemoManha, rotaComOportunidade, VEICULO_DEMO, type OportunidadeDemo,
} from '@/data/motorista-demo';

type Aba = 'inicio' | 'rotas' | 'oportunidades' | 'financeiro' | 'mais';

export function VamboraProPage() {
  const [aba, setAba] = useState<Aba>('inicio');
  const [modulo, setModulo] = useState<string | null>(null);

  return (
    <div className="min-h-dvh bg-navy-50 pb-28">
      {/* Faixa de identificação (protótipo) */}
      <div className="bg-navy-900 text-center text-[11px] text-navy-200">
        <div className="container-page py-1">Vambora Pro · protótipo acadêmico — dados demonstrativos</div>
      </div>

      <main className="container-page max-w-xl py-5">
        {modulo ? (
          <ModuloDetalhe modulo={modulo} onVoltar={() => setModulo(null)} />
        ) : aba === 'inicio' ? (
          <Inicio onVerOportunidades={() => setAba('oportunidades')} />
        ) : aba === 'rotas' ? (
          <Rotas />
        ) : aba === 'oportunidades' ? (
          <Oportunidades />
        ) : aba === 'financeiro' ? (
          <Financeiro />
        ) : (
          <Mais onAbrir={setModulo} />
        )}
      </main>

      {/* Navegação inferior */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-navy-100 bg-white/95 backdrop-blur">
        <div className="container-page flex max-w-xl items-stretch justify-between">
          {([
            ['inicio', Home, 'Início'],
            ['rotas', RouteIcon, 'Rotas'],
            ['oportunidades', Sparkles, 'Vagas'],
            ['financeiro', Wallet, 'Financeiro'],
            ['mais', LayoutGrid, 'Mais'],
          ] as const).map(([k, Icone, label]) => (
            <button key={k} onClick={() => { setAba(k); setModulo(null); }}
              className={cn('flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                aba === k && !modulo ? 'text-mint-600' : 'text-navy-400')}>
              <Icone className="h-5 w-5" /> {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

/* --------------------------------- Início --------------------------------- */
function Inicio({ onVerOportunidades }: { onVerOportunidades: () => void }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2"><VanMark className="h-8 w-8" /><span className="font-display font-extrabold tracking-tightest">Vam<span className="text-mint-500">bora</span> Pro</span></Link>
      </div>

      {/* Cartão do motorista */}
      <div className="card overflow-hidden">
        <div className="bg-brand-gradient grain p-5 text-white">
          <div className="flex items-center gap-3">
            <Avatar nome={MOTORISTA_DEMO.nome} className="h-14 w-14 text-lg" />
            <div>
              <p className="font-display text-lg font-bold">{MOTORISTA_DEMO.apelido}</p>
              <p className="text-sm text-navy-200">{MOTORISTA_DEMO.cidade} · desde {MOTORISTA_DEMO.desde}</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 divide-x divide-navy-100">
          <Indicador valor={INDICADORES_DEMO.alunos} rotulo="alunos" />
          <Indicador valor={INDICADORES_DEMO.vagas} rotulo="vagas" destaque />
          <Indicador valor={INDICADORES_DEMO.rotas} rotulo="rotas" />
          <Indicador valor={INDICADORES_DEMO.escolas} rotulo="escolas" />
        </div>
      </div>

      <Link to="/pro/encaixe" className="flex items-center justify-between rounded-2xl border border-mint-200 bg-mint-50 p-4 text-mint-900 transition hover:bg-mint-100">
        <div><p className="font-display font-bold">Testar encaixe inteligente</p><p className="mt-1 text-xs">Ida, volta e horários de chegada em casa · simulação</p></div>
        <ChevronRight className="h-5 w-5 shrink-0" />
      </Link>

      {/* Próxima rota */}
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold">Rota de hoje</h2>
          <span className="chip bg-mint-100 text-mint-800">Manhã · ida</span>
        </div>
        <div className="mt-3 flex items-center gap-3 rounded-xl bg-navy-50 p-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-navy-900 text-white"><Bus className="h-5 w-5" /></span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-navy-900">{VAN_DEMO.modelo}</p>
            <p className="text-xs text-navy-500">Saída por volta de 06h20 · {INDICADORES_DEMO.alunos} alunos</p>
          </div>
          <ChevronRight className="h-5 w-5 text-navy-300" />
        </div>
      </div>

      {/* Avisos */}
      <div className="card p-5">
        <h2 className="font-display font-bold">Avisos</h2>
        <div className="mt-3 space-y-2">
          {AVISOS_DEMO.map((a) => (
            <div key={a.id} className="flex items-start gap-2.5 rounded-xl bg-navy-50 p-3 text-sm">
              <Bell className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div className="flex-1"><p className="text-navy-700">{a.texto}</p><p className="text-xs text-navy-400">{a.quando}</p></div>
            </div>
          ))}
        </div>
      </div>

      <button onClick={onVerOportunidades} className="btn btn-lg btn-primary w-full">
        <Sparkles className="h-5 w-5" /> Ver oportunidades
      </button>
    </div>
  );
}

function Indicador({ valor, rotulo, destaque }: { valor: number; rotulo: string; destaque?: boolean }) {
  return (
    <div className="p-3 text-center">
      <p className={cn('font-display text-2xl font-bold', destaque ? 'text-mint-600' : 'text-navy-900')}>{valor}</p>
      <p className="text-[11px] text-navy-500">{rotulo}</p>
    </div>
  );
}

/* --------------------------------- Rotas --------------------------------- */
function Rotas() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Minhas rotas</h1>
      {['Rota da manhã — ida', 'Rota da manhã — volta'].map((nome, i) => (
        <div key={nome} className="card p-5">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-navy-900">{nome}</p>
            <span className="chip bg-mint-100 text-mint-800">concluída</span>
          </div>
          <p className="mt-1 text-sm text-navy-500">{i === 0 ? INDICADORES_DEMO.alunos : INDICADORES_DEMO.alunos} alunos · 2 escolas · Seg a Sex</p>
        </div>
      ))}
      <Link to="/painel/rota/nova" className="btn btn-lg btn-primary flex w-full">
        <RouteIcon className="h-5 w-5" /> Montar uma rota de verdade (construtor visual)
      </Link>
      <p className="text-center text-xs text-navy-400">As rotas acima são demonstrativas. O construtor visual grava uma rota real.</p>
    </div>
  );
}

/* ----------------------------- Oportunidades ----------------------------- */
function Oportunidades() {
  const [sel, setSel] = useState<OportunidadeDemo | null>(null);
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Oportunidades</h1>
      <p className="text-sm text-navy-600">Famílias procurando van na sua região. Toque para simular o impacto de aceitar — calculado pelo motor.</p>
      {OPORTUNIDADES_DEMO.map((op) => (
        <button key={op.id} onClick={() => setSel(op)} className="card card-interactive flex w-full items-center gap-3 p-4 text-left">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-mint-100 text-mint-700"><MapPin className="h-5 w-5" /></span>
          <div className="flex-1">
            <p className="font-semibold text-navy-900">{op.regiao} → {op.escola}</p>
            <p className="text-xs text-navy-500">{op.turno} · {op.quando}</p>
          </div>
          <ChevronRight className="h-5 w-5 text-navy-300" />
        </button>
      ))}
      <p className="text-center text-xs text-navy-400">Procura demonstrativa, sem dados pessoais das famílias.</p>
      {sel && <SimuladorImpacto op={sel} onFechar={() => setSel(null)} />}
    </div>
  );
}

/** Traduz os motivos técnicos do motor para linguagem simples (sem mudar o resultado). */
function motivoAmigavel(m: string): string {
  if (m.includes('tempo a bordo')) return 'Cabe nos horários. Falta só confirmar o tempo máximo a bordo (regra do transporte escolar).';
  if (m.includes('Nenhum horário de saída')) return 'Essa região fica fora da rota atual — encaixar atrasaria os outros alunos.';
  if (m.includes('Sequência compatível')) return 'Encaixa na rota sem atrasar os outros alunos.';
  if (m.toLowerCase().includes('capacidade') || m.includes('ocupa')) return 'A van ficaria sem vaga nesse trecho.';
  return m;
}

function SimuladorImpacto({ op, onFechar }: { op: OportunidadeDemo; onFechar: () => void }) {
  const resultado = useMemo(() => {
    const base = rotaDemoManha();
    const baseEntrada = montarEntradaMotor(base, VEICULO_DEMO);
    const candidata = montarEntradaMotor(rotaComOportunidade(base, op), VEICULO_DEMO);
    return avaliarRotaCandidata(baseEntrada, candidata, base.limiteAntecipacaoMin ?? 0);
  }, [op]);

  const cor = resultado.nivel === 'disponivel' ? 'mint' : resultado.nivel === 'sob_consulta' ? 'amber' : 'red';
  const Icone = resultado.nivel === 'indisponivel' ? AlertTriangle : CheckCircle2;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 p-0 sm:items-center sm:p-5" onClick={onFechar}>
      <div className="w-full max-w-md rounded-t-3xl bg-white p-6 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-navy-100 sm:hidden" />
        <h2 className="font-display text-lg font-bold">E se eu aceitar este aluno?</h2>
        <p className="mt-1 text-sm text-navy-500">{op.regiao} → {op.escola} · {op.turno}</p>

        <div className={cn('mt-4 rounded-2xl p-4',
          cor === 'mint' ? 'bg-mint-50' : cor === 'amber' ? 'bg-amber-50' : 'bg-red-50')}>
          <p className={cn('inline-flex items-center gap-2 font-display font-bold',
            cor === 'mint' ? 'text-mint-800' : cor === 'amber' ? 'text-amber-800' : 'text-red-700')}>
            <Icone className="h-5 w-5" />
            {resultado.nivel === 'disponivel' ? 'Cabe na rota' : resultado.nivel === 'sob_consulta' ? 'Dá para encaixar (sob consulta)' : 'Não cabe sem prejudicar os outros'}
          </p>
          <ul className="mt-2 space-y-1 text-sm text-navy-700">
            {resultado.motivos.map((m, i) => <li key={i}>• {motivoAmigavel(m)}</li>)}
          </ul>
          {resultado.plano.valido && resultado.plano.saida != null && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-navy-700">
              <Clock className="h-4 w-4 text-navy-400" /> Nova saída sugerida: <strong>{minutosParaTextoHora(resultado.plano.saida)}</strong>
              {typeof resultado.antecipacaoMin === 'number' && resultado.antecipacaoMin > 0 && (
                <span className="text-navy-500"> ({resultado.antecipacaoMin} min mais cedo)</span>
              )}
            </p>
          )}
        </div>

        <p className="mt-3 text-xs text-navy-400">Cálculo real do motor de compatibilidade, sobre a rota demonstrativa. Não reserva vaga nem substitui a aprovação dos documentos.</p>
        <button className="btn btn-lg btn-navy mt-4 w-full" onClick={onFechar}>Entendi</button>
      </div>
    </div>
  );
}

/* ----------------------------- Financeiro ----------------------------- */
function Financeiro() {
  const max = Math.max(...FINANCEIRO_DEMO.porMes.map((m) => m.valor));
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Financeiro</h1>
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4"><p className="text-xs text-navy-500">Receita do mês</p><p className="mt-1 font-display text-2xl font-bold text-navy-900">{formatBRL(INDICADORES_DEMO.receitaMes)}</p></div>
        <div className="card p-4"><p className="text-xs text-navy-500">A receber</p><p className="mt-1 font-display text-2xl font-bold text-amber-600">{formatBRL(INDICADORES_DEMO.aReceber)}</p></div>
      </div>
      <div className="card p-5">
        <div className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-mint-600" /><h2 className="font-display font-bold">Últimos meses</h2></div>
        <div className="mt-4 flex items-end justify-between gap-2">
          {FINANCEIRO_DEMO.porMes.map((m) => (
            <div key={m.mes} className="flex flex-1 flex-col items-center justify-end gap-1.5">
              <span className="text-[10px] font-medium text-navy-400">{(m.valor / 1000).toFixed(1)}k</span>
              <div className="w-full rounded-t-lg bg-mint-400" style={{ height: `${Math.round((m.valor / max) * 120)}px` }} />
              <span className="text-[11px] text-navy-400">{m.mes}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="card p-5">
        <h2 className="font-display font-bold">Mensalidades</h2>
        <div className="mt-3 flex gap-3 text-sm">
          <span className="chip bg-mint-100 text-mint-800">{FINANCEIRO_DEMO.pagos} pagas</span>
          <span className="chip bg-amber-100 text-amber-800">{FINANCEIRO_DEMO.emAtraso} em atraso</span>
          <span className="chip bg-navy-50 text-navy-600">{formatBRL(FINANCEIRO_DEMO.mensalidade)}/aluno</span>
        </div>
      </div>
      <p className="text-center text-xs text-navy-400">Valores demonstrativos. Não representam cobrança real.</p>
    </div>
  );
}

/* -------------------------------- Mais -------------------------------- */
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
        {itens.map(([k, Icone, label]) => (
          <button key={k} onClick={() => onAbrir(k)} className="card card-interactive flex flex-col items-start gap-2 p-4 text-left">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-navy-50 text-navy-700"><Icone className="h-5 w-5" /></span>
            <span className="text-sm font-semibold text-navy-900">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* --------------------------- Detalhe de módulo --------------------------- */
function ModuloDetalhe({ modulo, onVoltar }: { modulo: string; onVoltar: () => void }) {
  return (
    <div className="space-y-4">
      <button onClick={onVoltar} className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-500 hover:text-navy-800">
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
        {ALUNOS_DEMO.map((a) => (
          <div key={a.id} className="card flex items-center gap-3 p-3">
            <Avatar nome={a.nome} className="h-9 w-9 text-xs" />
            <div className="flex-1"><p className="text-sm font-semibold text-navy-900">{a.nome}</p><p className="text-xs text-navy-500">{a.escola} · {a.regiao}</p></div>
            <span className="text-xs text-navy-400">{a.embarque}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-navy-400">Identificações curtas (apelidos). Dados demonstrativos, sem informações pessoais reais.</p>
    </div>
  );
}

function Vagas() {
  // ocupação por trecho simplificada (demonstrativa, coerente com 12 alunos / 16 lugares)
  const trechos = [
    { onde: 'Centro → V. Mendonça', ocupados: 4 }, { onde: 'V. Mendonça → J. Nova Iorque', ocupados: 7 },
    { onde: 'J. Nova Iorque → Água Branca', ocupados: 9 }, { onde: 'Água Branca → Escola', ocupados: 12 },
  ];
  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Vagas por trecho</h1>
      <p className="mt-1 text-sm text-navy-600">A van enche ao longo da rota. A vaga de verdade depende do trecho.</p>
      <div className="mt-3 space-y-2">
        {trechos.map((t) => (
          <div key={t.onde} className="card p-3">
            <div className="flex items-center justify-between text-sm"><span className="text-navy-700">{t.onde}</span><span className="font-semibold text-navy-900">{VAN_DEMO.lugares - t.ocupados} livre(s)</span></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-navy-100"><div className="h-full bg-mint-400" style={{ width: `${(t.ocupados / VAN_DEMO.lugares) * 100}%` }} /></div>
          </div>
        ))}
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
        <div className="card p-4"><p className="text-xs text-navy-500">Consumo</p><p className="mt-1 font-display text-xl font-bold">{COMBUSTIVEL_DEMO.consumoKmL} km/L</p></div>
        <div className="card p-4"><p className="text-xs text-navy-500">Gasto do mês</p><p className="mt-1 font-display text-xl font-bold">{formatBRL(COMBUSTIVEL_DEMO.gastoMes)}</p></div>
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
            <span className="text-navy-700">{m.item}</span>
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
            <div><p className="font-semibold text-navy-900">{d.nome}</p><p className="text-xs text-navy-500">Validade: {d.validade}</p></div>
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
      <div className="mt-3 card p-5">
        <div className="flex items-center gap-3">
          <Avatar nome={MOTORISTA_DEMO.nome} className="h-14 w-14 text-lg" />
          <div><p className="font-display text-lg font-bold">{MOTORISTA_DEMO.apelido}</p><p className="text-sm text-navy-500">{MOTORISTA_DEMO.cidade}</p></div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="chip bg-navy-50 text-navy-600"><School className="h-3.5 w-3.5" /> Fundamental e Médio</span>
          <span className="chip bg-navy-50 text-navy-600"><Bus className="h-3.5 w-3.5" /> {VAN_DEMO.modelo}</span>
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
        {itens.map((t, i) => <div key={i} className="card p-3 text-sm text-navy-700">{t}</div>)}
      </div>
    </div>
  );
}
function VisaoFutura({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="card p-8 text-center">
      <Sparkles className="mx-auto h-10 w-10 text-navy-300" />
      <h1 className="mt-3 font-display text-lg font-bold">{titulo}</h1>
      <p className="mx-auto mt-2 max-w-sm text-navy-600">{texto}</p>
      <span className="mt-4 inline-block rounded-full bg-navy-100 px-3 py-1 text-xs font-medium text-navy-600">Visão de produto · fase futura</span>
    </div>
  );
}
