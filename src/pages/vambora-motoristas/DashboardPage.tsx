import { Link } from 'react-router-dom';
import { Users, Armchair, Route as RouteIcon, School, Fuel, Coins, Bell, Star, Sparkles, ChevronRight } from 'lucide-react';
import { Avatar } from '@/components/brand/Avatar';
import { VMShell } from '@/components/vm/VMShell';
import { StatTile, Card, Barra, DemoChip } from '@/components/vm/ui';
import { VanEscolar } from '@/components/vm/VanEscolar';
import { SlotIlustracao } from '@/components/vm/SlotImagem';
import { useDadosMotorista } from '@/lib/vm/useDadosMotorista';
import { useAuth } from '@/lib/auth';
import { MOTORISTA_DEMO } from '@/data/motorista-demo';
import { formatBRL } from '@/lib/utils';

export function DashboardPage() {
  const { dados, indicadores: ind, carregando } = useDadosMotorista();
  const { session } = useAuth();
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const kmDia = Math.round(ind.distanciaDiaKm);

  // Identidade: nome real da sessão (OAuth/e-mail) fora do cenário demo.
  const meta = session?.user?.user_metadata ?? {};
  const nomeReal = (meta.full_name || meta.name || session?.user?.email?.split('@')[0]) as string | undefined;
  const nome = dados.demo ? MOTORISTA_DEMO.nome : (nomeReal || 'Motorista');
  const apelido = dados.demo ? MOTORISTA_DEMO.apelido : nome.split(' ')[0];

  return (
    <VMShell>
      {/* Cabeçalho */}
      <header className="vm-grad px-5 pb-16 pt-[calc(env(safe-area-inset-top)+1rem)] text-white">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar nome={nome} className="h-12 w-12 text-base ring-2 ring-white/30" />
            <div>
              <p className="text-xs font-medium text-mint-100/90">{saudacao},</p>
              <p className="font-display text-xl font-extrabold leading-tight">{apelido} 👋</p>
              {dados.demo ? (
                <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-mint-50/90">
                  <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" /> {MOTORISTA_DEMO.nota.toFixed(1).replace('.', ',')}
                  <span className="text-mint-100/70">· {MOTORISTA_DEMO.avaliacoes} avaliações</span>
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-mint-50/90">Motorista escolar</p>
              )}
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

        {/* Primeiros passos (dados reais, ainda incompletos) */}
        {!dados.demo && (!dados.veiculo || ind.rotas === 0) && (
          <Card className="p-5 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center overflow-hidden rounded-2xl bg-mint-50 text-mint-600">
              <SlotIlustracao slot="dash.primeirosPassos" alt="" fallback={<Sparkles className="h-7 w-7" />} />
            </span>
            <p className="mt-3 font-display text-lg font-bold text-navy-900">Vamos preparar o seu app</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-navy-500">
              {!dados.veiculo
                ? 'Cadastre a sua van para calcularmos ocupação, custos e oportunidades.'
                : 'Monte a sua primeira rota para ver alunos, vagas e horários aqui.'}
            </p>
            <Link
              to={!dados.veiculo ? '/app/van/cadastro' : '/painel/rota/nova'}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-mint-500 font-semibold text-white shadow-float active:scale-[0.98]"
            >
              {!dados.veiculo ? 'Cadastrar van' : 'Montar primeira rota'} <ChevronRight className="h-5 w-5" />
            </Link>
          </Card>
        )}

        {/* Ocupação da van */}
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy-600"><Users className="h-4 w-4 vm-accent" /> Ocupação da van</p>
              <p className="mt-1 font-display text-4xl font-extrabold tabular-nums text-navy-900">{ind.ocupacaoPct}%</p>
              <p className="text-xs text-navy-500">{ind.capacidade - ind.vagas} de {ind.capacidade} lugares</p>
            </div>
            <div className="w-28 shrink-0">
              <SlotIlustracao slot="dash.van" alt="Van escolar" fallback={<VanEscolar className="w-full" />} />
            </div>
          </div>
          <Barra pct={ind.ocupacaoPct} className="mt-3" />
        </Card>

        {/* Diesel + custo por dia (só quando há rota para custear) */}
        {(dados.demo || ind.rotas > 0) && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-4">
                <span className="vm-chip-ico vm-ico-rose"><Fuel className="h-5 w-5" /></span>
                <p className="mt-2 text-xs text-navy-500">Diesel por dia</p>
                <p className="font-display text-2xl font-extrabold tabular-nums text-navy-900">{ind.dieselDiaL.toFixed(1).replace('.', ',')} L</p>
                <p className="text-[11px] text-navy-400">(= {kmDia} km)</p>
              </Card>
              <Card className="p-4">
                <span className="vm-chip-ico vm-ico-amber"><Coins className="h-5 w-5" /></span>
                <p className="mt-2 text-xs text-navy-500">Custo por dia</p>
                <p className="font-display text-2xl font-extrabold tabular-nums text-navy-900">{formatBRL(ind.custoDiaBRL)}</p>
                <p className="text-[11px] text-navy-400">(estimado)</p>
              </Card>
            </div>

            {/* Oportunidade na rota (ilustrativa no cenário demo) */}
            <Link to="/app/oportunidades" className="block">
              <Card className="vm-press flex items-center gap-3 p-4">
                <span className="vm-chip-ico vm-ico-green"><Sparkles className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-navy-900">Oportunidades para a sua rota</p>
                  <p className="truncate text-xs text-navy-500">Veja famílias compatíveis e simule o encaixe sem alterar a rota.</p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-navy-300" />
              </Card>
            </Link>
          </>
        )}

        {carregando && <p className="pt-2 text-center text-xs text-navy-400">Atualizando…</p>}
      </div>
    </VMShell>
  );
}
