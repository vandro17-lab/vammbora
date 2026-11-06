import { Link } from 'react-router-dom';
import { Users, Armchair, Route as RouteIcon, School, Fuel, Coins, Bell, Star, Sparkles, ChevronRight } from 'lucide-react';
import { Avatar } from '@/components/brand/Avatar';
import { VMShell } from '@/components/vm/VMShell';
import { StatTile, Card, Barra, DemoChip } from '@/components/vm/ui';
import { VanEscolar } from '@/components/vm/VanEscolar';
import { useDadosMotorista } from '@/lib/vm/useDadosMotorista';
import { MOTORISTA_DEMO } from '@/data/motorista-demo';
import { formatBRL } from '@/lib/utils';

export function DashboardPage() {
  const { dados, indicadores: ind, carregando } = useDadosMotorista();
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const kmDia = Math.round(ind.distanciaDiaKm);

  return (
    <VMShell>
      {/* Cabeçalho */}
      <header className="vm-grad px-5 pb-16 pt-[calc(env(safe-area-inset-top)+1rem)] text-white">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar nome={MOTORISTA_DEMO.nome} className="h-12 w-12 text-base ring-2 ring-white/30" />
            <div>
              <p className="text-xs font-medium text-mint-100/90">{saudacao},</p>
              <p className="font-display text-xl font-extrabold leading-tight">{MOTORISTA_DEMO.apelido} 👋</p>
              <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-mint-50/90">
                <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" /> {MOTORISTA_DEMO.nota.toFixed(1).replace('.', ',')}
                <span className="text-mint-100/70">· {MOTORISTA_DEMO.avaliacoes} avaliações</span>
              </p>
            </div>
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-full bg-white/15 ring-1 ring-white/20" aria-label="Avisos">
            <Bell className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Stat tiles sobrepostos */}
      <div className="-mt-12 px-4">
        <div className="grid grid-cols-4 gap-2.5">
          <StatTile icon={Users} valor={ind.alunos} rotulo="alunos" cor="blue" />
          <StatTile icon={Armchair} valor={ind.vagas} rotulo="vagas" cor="green" />
          <StatTile icon={RouteIcon} valor={ind.rotas} rotulo="rotas" cor="purple" />
          <StatTile icon={School} valor={ind.escolas} rotulo="escolas" cor="amber" />
        </div>
      </div>

      <div className="space-y-3.5 px-4 pt-4">
        {dados.demo && <div className="flex justify-end"><DemoChip /></div>}

        {/* Ocupação da van */}
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy-600"><Users className="h-4 w-4 vm-accent" /> Ocupação da van</p>
              <p className="mt-1 font-display text-4xl font-extrabold text-navy-900">{ind.ocupacaoPct}%</p>
              <p className="text-xs text-navy-500">{ind.capacidade - ind.vagas} de {ind.capacidade} lugares</p>
            </div>
            <VanEscolar className="w-28 shrink-0" />
          </div>
          <Barra pct={ind.ocupacaoPct} className="mt-3" />
        </Card>

        {/* Diesel + custo por dia */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <span className="vm-chip-ico vm-ico-rose"><Fuel className="h-5 w-5" /></span>
            <p className="mt-2 text-xs text-navy-500">Diesel por dia</p>
            <p className="font-display text-2xl font-extrabold text-navy-900">{ind.dieselDiaL.toFixed(1).replace('.', ',')} L</p>
            <p className="text-[11px] text-navy-400">(= {kmDia} km)</p>
          </Card>
          <Card className="p-4">
            <span className="vm-chip-ico vm-ico-amber"><Coins className="h-5 w-5" /></span>
            <p className="mt-2 text-xs text-navy-500">Custo por dia</p>
            <p className="font-display text-2xl font-extrabold text-navy-900">{formatBRL(ind.custoDiaBRL)}</p>
            <p className="text-[11px] text-navy-400">(estimado)</p>
          </Card>
        </div>

        {/* Oportunidade na rota */}
        <Link to="/app/oportunidades" className="block">
          <Card className="flex items-center gap-3 p-4">
            <span className="vm-chip-ico vm-ico-green"><Sparkles className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-navy-900">Oportunidade na sua rota</p>
              <p className="truncate text-xs text-navy-500">1 nova família compatível com a sua rota da manhã</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-navy-300" />
          </Card>
        </Link>

        {carregando && <p className="pt-2 text-center text-xs text-navy-400">Atualizando…</p>}
      </div>
    </VMShell>
  );
}
