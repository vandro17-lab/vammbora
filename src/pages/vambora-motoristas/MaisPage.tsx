import { useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
// Ícones premium (duotone) para o hub — Phosphor:
import {
  SquaresFour, Van, CalendarBlank, Wrench, GasPump, ChartBar, FileText as FileDoc,
  Headset, GearSix, Crown, Gift, CaretRight, Percent,
  PencilSimpleLine, ListBullets, Bell, UserCircle,
} from '@phosphor-icons/react';
// Ícones das telas de detalhe (ModuloPage) — lucide (mantidos):
import {
  FileText, CalendarDays, Wrench as WrenchL, Fuel, Gauge, Coins, Route as RouteIcon, Tag,
  CheckCircle2, Clock, AlertTriangle, LogOut, User,
} from 'lucide-react';
import { Avatar } from '@/components/brand/Avatar';
import { VMShell } from '@/components/vm/VMShell';
import { VMSectionHeader } from '@/components/vm/VMHeader';
import { Card, SubHeader, LinhaValor, DemoChip } from '@/components/vm/ui';
import { SlotIlustracao, SlotIcone } from '@/components/vm/SlotImagem';
import { useEdicaoAparencia } from '@/lib/vm/useEdicaoAparencia';
import { useDadosMotorista, lerPrefs } from '@/lib/vm/useDadosMotorista';
import { MOTORISTA_DEMO, MANUTENCAO_DEMO, DOCUMENTOS_DEMO, CALENDARIO_DEMO } from '@/data/motorista-demo';
import { useAuth } from '@/lib/auth';
import { formatBRL, cn } from '@/lib/utils';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
// Banners do Clube EMBUTIDOS no bundle (webp otimizado). Antes vinham do banco
// (Supabase Storage), o que exigia uma consulta + download a cada carregamento.
// Incorporados ao código, carregam instantaneamente e ficam em cache.
import bannerCombustivel from '@/assets/clube/combustivel.webp';
import bannerCentroAutomotivo from '@/assets/clube/centro-automotivo.webp';
import bannerAcai from '@/assets/clube/acai.webp';
import bannerSeguro from '@/assets/clube/seguro.webp';

/** Atalhos do hub (grade de 2 colunas, fiel à referência). */
interface Atalho { to: string; slot: string; label: string; descr: string; Icone: PhosphorIcon; cor: string }
const ATALHOS: Atalho[] = [
  { to: '/app/van', slot: 'icon.minhaVan', label: 'Minha Van', descr: 'Veículo, consumo e documentos', Icone: Van, cor: 'vm-ico-green' },
  { to: '/app/mais/calendario', slot: 'icon.calendario', label: 'Calendário escolar', descr: 'Datas, eventos e planejamento', Icone: CalendarBlank, cor: 'vm-ico-purple' },
  { to: '/app/mais/manutencao', slot: 'icon.manutencao', label: 'Manutenção', descr: 'Revisões, histórico e lembretes', Icone: Wrench, cor: 'vm-ico-slate' },
  { to: '/app/mais/combustivel', slot: 'icon.combustivel', label: 'Combustível', descr: 'Consumo, preços e estimativas', Icone: GasPump, cor: 'vm-ico-rose' },
  { to: '/app/mais/relatorios', slot: 'icon.relatorios', label: 'Relatórios', descr: 'Desempenho, rotas e resultados', Icone: ChartBar, cor: 'vm-ico-blue' },
  { to: '/app/mais/documentacao', slot: 'icon.documentacao', label: 'Documentação', descr: 'Licenças e órgãos obrigatórios', Icone: FileDoc, cor: 'vm-ico-teal' },
  { to: '/app/mais/ajuda', slot: 'icon.ajuda', label: 'Ajuda e Suporte', descr: 'Tire suas dúvidas e fale conosco', Icone: Headset, cor: 'vm-ico-amber' },
  { to: '/app/mais/config', slot: 'icon.config', label: 'Configurações', descr: 'Preferências, conta e notificações', Icone: GearSix, cor: 'vm-ico-navy' },
];

/** Títulos das telas de detalhe (ModuloPage). */
const MODULO_TITULOS: Record<string, string> = {
  documentacao: 'Documentação', calendario: 'Calendário escolar', manutencao: 'Manutenção',
  combustivel: 'Combustível', relatorios: 'Relatórios', clube: 'Clube do Motorista',
  ajuda: 'Ajuda e Suporte', config: 'Configurações',
};

/* ============================== TELA 10 — Mais ============================== */
export function MaisPage() {
  const navigate = useNavigate();
  const { sair, session } = useAuth();
  const { disponivel, ativar } = useEdicaoAparencia();
  const { dados } = useDadosMotorista();

  const meta = session?.user?.user_metadata ?? {};
  const nomeReal = (meta.full_name || meta.name || session?.user?.email?.split('@')[0]) as string | undefined;
  const nome = dados.demo ? MOTORISTA_DEMO.apelido : (nomeReal || 'Motorista');

  return (
    <VMShell>
      <VMSectionHeader
        icon={SquaresFour}
        titulo="Mais"
        subtitulo="Recursos e serviços para o seu dia a dia como motorista escolar."
        tituloKey="mais.header.titulo"
        subtituloKey="mais.header.subtitulo"
      />

      <div className="space-y-3 px-4 pt-4">
        {/* Cartão do motorista → perfil profissional (sem selo: o VanBora não verifica documentos) */}
        <button onClick={() => navigate('/app/perfil')} className="w-full text-left">
          <Card className="vm-press flex items-center gap-3 p-3.5">
            <Avatar nome={dados.demo ? MOTORISTA_DEMO.nome : nome} className="h-12 w-12 text-base" />
            <div className="flex-1">
              <p className="font-display text-[17px] font-bold text-navy-900">{nome}</p>
              <p className="inline-flex items-center gap-1 text-sm font-semibold text-mint-700">
                <UserCircle size={16} weight="fill" /> Meu perfil profissional
              </p>
            </div>
            <CaretRight size={18} weight="bold" className="text-navy-300" />
          </Card>
        </button>

        {/* Banner — Clube do Motorista */}
        <button onClick={() => navigate('/app/mais/clube')} className="w-full text-left">
          <div className="vm-press relative overflow-hidden rounded-[1.25rem] p-4 text-white shadow-card"
            style={{ background: 'linear-gradient(135deg,#17306b 0%,#0b1f3a 62%)' }}>
            {/* Arte do Clube — slot editável (fallback: presente vetorial) */}
            <div className="pointer-events-none absolute -right-2 -top-1 h-28 w-28">
              <SlotIlustracao slot="clube.art" alt="Clube do Motorista"
                fallback={<Gift size={96} weight="duotone" className="absolute right-1 top-1 text-amber-300/80" />} />
            </div>
            <span className="pointer-events-none absolute right-5 top-[4.5rem] grid h-8 w-8 place-items-center rounded-full bg-mint-500 text-white shadow-md ring-4 ring-[#0b1f3a]">
              <Percent size={16} weight="bold" />
            </span>
            <div className="relative max-w-[70%]">
              <p className="inline-flex items-center gap-1.5 font-display text-lg font-extrabold">
                <Crown size={22} weight="fill" className="text-amber-300" /> Clube do Motorista
              </p>
              <p className="mt-0.5 text-[13px] leading-snug text-white/80">Descontos, benefícios e parcerias exclusivas.</p>
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-300 px-4 py-2 text-sm font-bold text-navy-900">
                Ver vantagens <CaretRight size={16} weight="bold" />
              </span>
            </div>
          </div>
        </button>

        {/* Grade de atalhos */}
        <div className="grid grid-cols-2 gap-3">
          {ATALHOS.map(({ to, slot, label, descr, Icone, cor }) => (
            <button key={to} onClick={() => navigate(to)} className="h-full w-full text-left">
              <Card className="vm-press relative flex h-full items-start gap-2.5 p-3.5">
                <CaretRight size={14} weight="bold" className="absolute right-2.5 top-3.5 text-navy-300" />
                <span className={cn('vm-chip-ico shrink-0 overflow-hidden', cor)}>
                  <SlotIcone slot={slot} fallback={<Icone size={20} weight="duotone" />} />
                </span>
                <div className="min-w-0 flex-1 pr-3.5">
                  <p className="font-display text-[13px] font-bold leading-tight tracking-tight text-navy-900">{label}</p>
                  <p className="mt-1 text-[11px] leading-snug text-navy-500">{descr}</p>
                </div>
              </Card>
            </button>
          ))}
        </div>

        {disponivel && (
          <div className="space-y-2">
            <button onClick={ativar} className="vm-press flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-card ring-1 ring-navy-100">
              <span className="vm-chip-ico vm-ico-navy"><PencilSimpleLine size={20} weight="duotone" /></span>
              <div className="flex-1">
                <p className="font-display text-[14px] font-bold text-navy-900">Editar aparência</p>
                <p className="text-[11px] text-navy-500">Personalize as imagens direto nas telas reais (admin)</p>
              </div>
              <CaretRight size={16} weight="bold" className="text-navy-300" />
            </button>
            <button onClick={() => navigate('/app/admin/aparencia')} className="flex w-full items-center justify-center gap-1.5 py-1 text-[12px] font-semibold text-navy-500">
              <ListBullets size={14} weight="bold" /> Abrir lista completa de espaços
            </button>
          </div>
        )}

        {session && (
          <button onClick={sair} className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-sm font-semibold text-red-600 shadow-card ring-1 ring-navy-100 active:scale-[0.99]">
            <LogOut className="h-4 w-4" /> Sair da conta
          </button>
        )}

        {/* Acesso DISFARÇADO ao editor de motoristas da demonstração (admin). */}
        <button
          onClick={() => navigate('/app/mais/motoristas')}
          aria-label="Editar motoristas (demonstração)"
          title="Editar motoristas"
          className="mx-auto mt-2 flex h-8 w-8 items-center justify-center rounded-full text-navy-200 transition hover:text-navy-500 active:scale-90"
        >
          <UserCircle size={18} weight="duotone" />
        </button>
      </div>
    </VMShell>
  );
}

/* ====================== Sub-módulos (acessados por /app/mais/:modulo) ====================== */
export function ModuloPage() {
  const { modulo } = useParams();
  const navigate = useNavigate();
  const titulo = (modulo && MODULO_TITULOS[modulo]) ?? 'Módulo';
  return (
    <VMShell nav={false}>
      <SubHeader titulo={titulo} onVoltar={() => navigate('/app/mais')} />
      <div className="space-y-3.5 px-4 pt-4">
        {modulo === 'documentacao' && <Documentacao />}
        {modulo === 'manutencao' && <Manutencao />}
        {modulo === 'combustivel' && <Combustivel />}
        {modulo === 'calendario' && <Calendario />}
        {modulo === 'clube' && <Clube />}
        {(modulo === 'relatorios' || modulo === 'ajuda') && <EmBreve titulo={titulo} />}
        {modulo === 'config' && <Config />}
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

// Banners do Clube — imagem embutida (bundle) + rótulos de fallback caso a
// imagem não carregue. Ordem = ordem de exibição na tela.
const CLUBE = [
  { img: bannerCombustivel, cat: 'Combustível', nome: 'Rede de postos parceira', oferta: 'Desconto no abastecimento', Icone: Fuel, cor: 'vm-ico-rose' },
  { img: bannerCentroAutomotivo, cat: 'Manutenção', nome: 'Centro automotivo', oferta: 'Revisão e manutenção da van', Icone: WrenchL, cor: 'vm-ico-slate' },
  { img: bannerAcai, cat: 'Alimentação', nome: 'Açaí e lanches', oferta: 'Energia para seguir a rota', Icone: RouteIcon, cor: 'vm-ico-purple' },
  { img: bannerSeguro, cat: 'Seguro', nome: 'Seguro auto escolar', oferta: 'Condições especiais', Icone: Tag, cor: 'vm-ico-green' },
];
function Clube() {
  return (
    <>
      {/* Topo do Clube — ilustração/banner editável (fallback: coroa vetorial). */}
      <div className="relative overflow-hidden rounded-[1.25rem] p-4 text-white shadow-card"
        style={{ background: 'linear-gradient(135deg,#17306b 0%,#0b1f3a 62%)' }}>
        <div className="pointer-events-none absolute -right-2 -top-1 h-24 w-32">
          <SlotIlustracao slot="clube.hero" alt="Clube do Motorista"
            fallback={<Crown size={84} weight="duotone" className="absolute right-2 top-2 text-amber-300/80" />} />
        </div>
        <div className="relative max-w-[72%]">
          <p className="inline-flex items-center gap-1.5 font-display text-base font-extrabold">
            <Crown size={18} weight="fill" className="text-amber-300" /> Clube do Motorista
          </p>
          <p className="mt-0.5 text-[12px] leading-snug text-white/80">Benefícios e parcerias para a sua operação escolar.</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-navy-600">Vantagens para motoristas escolares de Araçatuba.</p>
        <DemoChip />
      </div>
      {CLUBE.map((c) => {
        const Icone = c.Icone;
        return (
          <div key={c.nome} className="relative aspect-[3/1] w-full overflow-hidden rounded-[1.25rem] bg-white shadow-card ring-1 ring-navy-100">
            {/* Fallback vetorial — visível só se a imagem embutida falhar (raro). */}
            <div className="absolute inset-0 flex items-center gap-3 px-3.5">
              <span className={cn('vm-chip-ico shrink-0 overflow-hidden', c.cor)}><Icone className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-navy-400">{c.cat}</p>
                <p className="truncate text-sm font-semibold text-navy-900">{c.nome}</p>
                <p className="truncate text-xs text-navy-500">{c.oferta}</p>
              </div>
              <span className="chip shrink-0 bg-mint-50 text-mint-700">consultar</span>
            </div>
            {/* Banner embutido (bundle) — carrega instantâneo, sem ida ao banco. */}
            <img
              src={c.img}
              alt={`Benefício do Clube — ${c.cat}: ${c.nome}`}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
        );
      })}
      <p className="text-center text-[11px] text-navy-400">Ofertas ilustrativas — parcerias comerciais a confirmar. Estrutura pronta para ofertas reais.</p>
    </>
  );
}

/* ---- Configurações: inclui o ATALHO OCULTO para o modo "Editar aparência" ----
   Toque 7 vezes seguidas na linha da versão (rodapé) para abrir o modo de edição,
   sem precisar de um botão de admin à vista. Publicar/salvar continua protegido
   pelo banco (só admin autenticado grava de verdade). */
function Config() {
  const navigate = useNavigate();
  const { ativarOculto } = useEdicaoAparencia();
  const toquesRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function tocarVersao() {
    toquesRef.current += 1;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { toquesRef.current = 0; }, 1200);
    if (toquesRef.current >= 7) {
      toquesRef.current = 0;
      ativarOculto();
      navigate('/app/mais'); // começa a editar pela tela Mais; a barra do modo aparece
    }
  }

  return (
    <>
      <Card className="divide-y divide-navy-50 p-0">
        {[
          [Bell, 'Notificações', 'Avisos de documentos e oportunidades'],
          [UserCircle, 'Conta', 'E-mail, telefone e cidade'],
          [GearSix, 'Preferências', 'Idioma, aparência e privacidade'],
        ].map(([Ico, t, d]) => {
          const I = Ico as PhosphorIcon;
          return (
            <div key={t as string} className="flex items-center gap-3 p-4">
              <span className="vm-chip-ico vm-ico-navy"><I size={18} weight="duotone" /></span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-navy-900">{t as string}</p>
                <p className="text-[11px] text-navy-500">{d as string}</p>
              </div>
              <span className="chip bg-navy-50 text-navy-400">em breve</span>
            </div>
          );
        })}
      </Card>

      {/* Rodapé com a versão — também é o atalho oculto (toque 7×). */}
      <button
        type="button"
        onClick={tocarVersao}
        className="mx-auto mt-5 block w-full select-none py-3 text-center text-[11px] text-navy-400"
        aria-label="Versão do aplicativo"
      >
        VanBora Motoristas · versão 0.1.0
      </button>
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
