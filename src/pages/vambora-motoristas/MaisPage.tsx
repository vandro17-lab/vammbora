import { useParams, useNavigate } from 'react-router-dom';
import {
  FileText, CalendarDays, Wrench, Fuel, BarChart3, Gift, HelpCircle, Settings,
  ChevronRight, CheckCircle2, Clock, AlertTriangle, Gauge, Coins, Route as RouteIcon, Tag, LogOut, User, Bus,
} from 'lucide-react';
import { Avatar } from '@/components/brand/Avatar';
import { VMShell } from '@/components/vm/VMShell';
import { Card, SubHeader, LinhaValor, DemoChip } from '@/components/vm/ui';
import { useDadosMotorista, lerPrefs } from '@/lib/vm/useDadosMotorista';
import { MOTORISTA_DEMO, MANUTENCAO_DEMO, DOCUMENTOS_DEMO, CALENDARIO_DEMO } from '@/data/motorista-demo';
import { useAuth } from '@/lib/auth';
import { formatBRL, cn } from '@/lib/utils';

const MODULOS = [
  { k: 'documentacao', Icone: FileText, label: 'Documentação', cor: 'vm-ico-teal' },
  { k: 'calendario', Icone: CalendarDays, label: 'Calendário escolar', cor: 'vm-ico-purple' },
  { k: 'manutencao', Icone: Wrench, label: 'Manutenção', cor: 'vm-ico-slate' },
  { k: 'combustivel', Icone: Fuel, label: 'Combustível', cor: 'vm-ico-rose' },
  { k: 'relatorios', Icone: BarChart3, label: 'Relatórios', cor: 'vm-ico-blue' },
  { k: 'clube', Icone: Gift, label: 'Clube do Motorista', cor: 'vm-ico-green' },
  { k: 'ajuda', Icone: HelpCircle, label: 'Ajuda e Suporte', cor: 'vm-ico-amber' },
  { k: 'config', Icone: Settings, label: 'Configurações', cor: 'vm-ico-navy' },
] as const;

/* ============================== TELA 10 — Mais ============================== */
export function MaisPage() {
  const navigate = useNavigate();
  const { sair, session } = useAuth();
  return (
    <VMShell>
      <SubHeader titulo="Mais" />
      <div className="space-y-3.5 px-4 pt-4">
        <Card className="flex items-center gap-3 p-4">
          <Avatar nome={MOTORISTA_DEMO.nome} className="h-12 w-12 text-base" />
          <div className="flex-1">
            <p className="font-display font-bold text-navy-900">{MOTORISTA_DEMO.apelido}</p>
            <p className="inline-flex items-center gap-1 text-xs font-medium text-mint-700"><CheckCircle2 className="h-3.5 w-3.5" /> Motorista verificado</p>
          </div>
          <ChevronRight className="h-5 w-5 text-navy-300" />
        </Card>

        {/* Minha Van em destaque (antes acessível só pela aba; agora vive no hub) */}
        <button onClick={() => navigate('/app/van')} className="w-full text-left">
          <Card className="vm-press flex items-center gap-3 p-4">
            <span className="vm-chip-ico vm-ico-green"><Bus className="h-5 w-5" /></span>
            <div className="flex-1">
              <p className="font-display font-bold text-navy-900">Minha Van</p>
              <p className="text-xs text-navy-500">Veículo, consumo, custos e documentos</p>
            </div>
            <ChevronRight className="h-5 w-5 text-navy-300" />
          </Card>
        </button>

        <div className="grid grid-cols-2 gap-3">
          {MODULOS.map(({ k, Icone, label, cor }) => (
            <button key={k} onClick={() => navigate(`/app/mais/${k}`)} className="vm-card flex items-center gap-2.5 p-3.5 text-left active:scale-[0.98]">
              <span className={cn('vm-chip-ico', cor)}><Icone className="h-5 w-5" /></span>
              <span className="text-sm font-semibold leading-tight text-navy-900">{label}</span>
            </button>
          ))}
        </div>

        {session && (
          <button onClick={sair} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-sm font-semibold text-red-600 shadow-card ring-1 ring-navy-100">
            <LogOut className="h-4 w-4" /> Sair da conta
          </button>
        )}
      </div>
    </VMShell>
  );
}

/* ====================== Sub-módulos (acessados por /app/mais/:modulo) ====================== */
export function ModuloPage() {
  const { modulo } = useParams();
  const navigate = useNavigate();
  const titulo = (MODULOS.find((m) => m.k === modulo)?.label) ?? 'Módulo';
  return (
    <VMShell nav={false}>
      <SubHeader titulo={titulo} onVoltar={() => navigate('/app/mais')} />
      <div className="space-y-3.5 px-4 pt-4">
        {modulo === 'documentacao' && <Documentacao />}
        {modulo === 'manutencao' && <Manutencao />}
        {modulo === 'combustivel' && <Combustivel />}
        {modulo === 'calendario' && <Calendario />}
        {modulo === 'clube' && <Clube />}
        {(modulo === 'relatorios' || modulo === 'ajuda' || modulo === 'config') && <EmBreve titulo={titulo} />}
      </div>
    </VMShell>
  );
}

function Documentacao() {
  const cor = (s: string) => (s === 'aprovado' ? 'bg-mint-100 text-mint-800' : s === 'em_analise' ? 'bg-navy-100 text-navy-600' : 'bg-amber-100 text-amber-800');
  const txt = (s: string) => (s === 'aprovado' ? 'Aprovado' : s === 'em_analise' ? 'Em análise' : 'Vence em breve');
  return (
    <>
      <DemoChip />
      {DOCUMENTOS_DEMO.map((d) => (
        <Card key={d.nome} className="flex items-center gap-3 p-3.5">
          <span className="vm-chip-ico vm-ico-teal"><FileText className="h-5 w-5" /></span>
          <div className="flex-1"><p className="text-sm font-semibold text-navy-900">{d.nome}</p><p className="text-xs text-navy-500">Validade: {d.validade}</p></div>
          <span className={cn('chip', cor(d.status))}>{txt(d.status)}</span>
        </Card>
      ))}
      <p className="text-center text-[11px] text-navy-400">Você só aparece às famílias com os documentos aprovados e válidos.</p>
    </>
  );
}

function Manutencao() {
  return (
    <>
      <DemoChip />
      {MANUTENCAO_DEMO.map((m) => (
        <Card key={m.item} className="flex items-center gap-3 p-3.5">
          <span className={cn('vm-chip-ico', m.status === 'ok' ? 'vm-ico-green' : 'vm-ico-amber')}>{m.status === 'ok' ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}</span>
          <span className="flex-1 text-sm text-navy-700">{m.item}</span>
          <span className="chip bg-navy-50 text-navy-500">{m.quando}</span>
        </Card>
      ))}
    </>
  );
}

function Combustivel() {
  const { indicadores: ind, dados } = useDadosMotorista();
  const prefs = lerPrefs();
  return (
    <>
      {dados.demo && <DemoChip />}
      <Card className="px-4 py-1">
        <div className="divide-y divide-navy-50">
          <LinhaValor icon={Gauge} cor="green" label="Consumo médio" valor={`${prefs.consumoKmL.toFixed(1).replace('.', ',')} km/l`} />
          <LinhaValor icon={RouteIcon} cor="blue" label="Distância por dia" valor={`${Math.round(ind.distanciaDiaKm)} km`} />
          <LinhaValor icon={Fuel} cor="rose" label="Diesel por dia" valor={`${ind.dieselDiaL.toFixed(1).replace('.', ',')} L`} />
          <LinhaValor icon={Coins} cor="amber" label="Gasto por dia" valor={formatBRL(ind.custoDiaBRL)} />
          <LinhaValor icon={Coins} cor="amber" label="Gasto estimado no mês" valor={formatBRL(ind.custoCombustivelMesBRL)} />
        </div>
      </Card>
      <p className="text-center text-[11px] text-navy-400">Cálculo: distância da rota ÷ rendimento × preço do diesel. Ajuste em Minha Van.</p>
    </>
  );
}

function Calendario() {
  const corMap: Record<string, string> = { mint: 'vm-ico-green', amber: 'vm-ico-amber', red: 'vm-ico-rose' };
  return (
    <>
      <DemoChip />
      {CALENDARIO_DEMO.map((c) => (
        <Card key={c.dia} className="flex items-center gap-3 p-3.5">
          <span className={cn('vm-chip-ico', corMap[c.cor] ?? 'vm-ico-slate')}><CalendarDays className="h-5 w-5" /></span>
          <div><p className="text-sm font-semibold text-navy-900">{c.dia}</p><p className="text-xs text-navy-500">{c.evento}</p></div>
        </Card>
      ))}
    </>
  );
}

const CLUBE = [
  { cat: 'Postos', nome: 'Rede de combustível parceira', oferta: 'Condição especial para motoristas escolares', Icone: Fuel, cor: 'vm-ico-rose' },
  { cat: 'Oficinas', nome: 'Oficina mecânica', oferta: 'Revisão com prioridade de agenda', Icone: Wrench, cor: 'vm-ico-slate' },
  { cat: 'Pneus', nome: 'Centro automotivo', oferta: 'Alinhamento + balanceamento', Icone: RouteIcon, cor: 'vm-ico-navy' },
  { cat: 'Seguro', nome: 'Seguro veicular', oferta: 'Cotação para transporte escolar', Icone: Tag, cor: 'vm-ico-green' },
];
function Clube() {
  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-navy-600">Vantagens para motoristas escolares de Araçatuba.</p>
        <DemoChip />
      </div>
      {CLUBE.map((c) => (
        <Card key={c.nome} className="flex items-center gap-3 p-3.5">
          <span className={cn('vm-chip-ico', c.cor)}><c.Icone className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-navy-400">{c.cat}</p>
            <p className="truncate text-sm font-semibold text-navy-900">{c.nome}</p>
            <p className="truncate text-xs text-navy-500">{c.oferta}</p>
          </div>
          <span className="chip bg-mint-50 text-mint-700">consultar</span>
        </Card>
      ))}
      <p className="text-center text-[11px] text-navy-400">Ofertas ilustrativas — parcerias comerciais a confirmar. Estrutura pronta para ofertas reais.</p>
    </>
  );
}

function EmBreve({ titulo }: { titulo: string }) {
  return (
    <Card className="p-8 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-navy-50 text-navy-400"><User className="h-7 w-7" /></span>
      <p className="mt-3 font-display text-lg font-bold">{titulo}</p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-navy-500">Em breve neste protótipo. A estrutura de navegação já está pronta para receber o conteúdo real.</p>
      <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-navy-100 px-3 py-1 text-xs font-medium text-navy-600"><Clock className="h-3.5 w-3.5" /> fase futura</span>
    </Card>
  );
}
