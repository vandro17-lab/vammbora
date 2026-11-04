import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Bus,
  Route,
  Inbox,
  Sparkles,
  CheckCircle2,
  Clock,
  Construction,
} from 'lucide-react';
import { DemoBadge } from '@/components/ui/DemoBadge';

/**
 * Entrada "Sou motorista" + prévia do painel.
 * A Etapa 1 entrega a porta de entrada e a estrutura do dashboard (preparação).
 * O onboarding completo, cadastro de veículo/rotas e o simulador do motor real
 * entram na Etapa 3 — e isso é dito com honestidade na própria tela.
 */
export function DriverLandingPage() {
  return (
    <div>
      <section className="bg-brand-gradient">
        <div className="container-page py-14 text-white">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-200 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <div className="mt-6 max-w-2xl">
            <span className="chip w-fit bg-white/10 text-mint-200 ring-1 ring-white/15">
              Para quem dirige
            </span>
            <h1 className="mt-4 font-display text-4xl font-extrabold leading-tight sm:text-5xl">
              Preencha os assentos vazios com os alunos certos.
            </h1>
            <p className="mt-4 text-lg text-navy-100">
              O Vambora mostra sua van para famílias cuja rota realmente combina com a sua — sem
              bagunçar o trajeto de quem já viaja com você.
            </p>
            <button className="btn btn-lg btn-primary mt-6" disabled>
              Começar cadastro (em breve)
            </button>
          </div>
        </div>
      </section>

      {/* Como funciona para o motorista */}
      <section className="container-page py-14">
        <h2 className="font-display text-3xl font-bold">Como vai funcionar para você</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {[
            { Icone: Bus, t: 'Cadastre sua van', d: 'Capacidade, recursos, fotos e documentos — com autosave e passos simples.' },
            { Icone: Route, t: 'Monte suas rotas', d: 'Escolas, horários e paradas. Sem precisar percorrer a rota com GPS.' },
            { Icone: Sparkles, t: 'Receba alunos compatíveis', d: 'Veja oportunidades por região e turno, sem expor dados das famílias.' },
          ].map((p) => (
            <div key={p.t} className="card p-6">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-navy-900 text-white">
                <p.Icone className="h-6 w-6" />
              </span>
              <h3 className="mt-4 font-display text-lg font-bold">{p.t}</h3>
              <p className="mt-2 text-sm text-navy-600">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Prévia do painel */}
      <section className="bg-white py-14">
        <div className="container-page">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-3xl font-bold">Prévia do seu painel</h2>
            <DemoBadge texto="Prévia — Etapa 3" />
          </div>
          <p className="mt-2 max-w-xl text-navy-600">
            É assim que o painel do motorista está sendo construído. Os números abaixo são apenas
            ilustrativos.
          </p>

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <PainelCard titulo="Minhas vans" Icone={Bus}>
              <LinhaMock texto="Van 01 — 15 lugares" chip="Ativa" ok />
              <LinhaMock texto="Van 02 — 18 lugares" chip="Em cadastro" />
            </PainelCard>
            <PainelCard titulo="Minhas rotas" Icone={Route}>
              <LinhaMock texto="Centro → Colégio Paineiras" chip="Manhã" ok />
              <LinhaMock texto="Vila Mendonça → Inst. São João" chip="Tarde" ok />
            </PainelCard>
            <PainelCard titulo="Solicitações" Icone={Inbox}>
              <LinhaMock texto="Nova família — Jd. Nova Iorque" chip="Pendente" />
              <LinhaMock texto="Avulso — 12/11" chip="Pendente" />
            </PainelCard>
          </div>

          {/* Simulador */}
          <div className="card mt-6 p-6">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-display text-lg font-bold">Simulador “e se eu aceitar este aluno?”</h3>
              <DemoBadge texto="Depende do motor real" />
            </div>
            <p className="mt-2 text-sm text-navy-600">
              Mostrará o antes/depois no seu tempo, capacidade e horários ao aceitar um novo aluno —
              usando o motor de encaixe oficial do Van Bora.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-navy-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">Antes</p>
                <p className="mt-2 inline-flex items-center gap-2 text-navy-700">
                  <Clock className="h-4 w-4" /> Chega 7 min antes da aula
                </p>
              </div>
              <div className="rounded-xl bg-mint-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-mint-600">Depois</p>
                <p className="mt-2 inline-flex items-center gap-2 text-navy-700">
                  <Clock className="h-4 w-4" /> Chega 3 min antes — ainda dentro da margem
                </p>
              </div>
            </div>
            <p className="mt-4 inline-flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
              <Construction className="mt-0.5 h-4 w-4 shrink-0" />
              Esta simulação é ilustrativa. O cálculo real será ligado ao motor de compatibilidade na
              Etapa 3.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function PainelCard({
  titulo,
  Icone,
  children,
}: {
  titulo: string;
  Icone: typeof Bus;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-6">
      <div className="flex items-center gap-2.5">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-navy-50 text-navy-700">
          <Icone className="h-5 w-5" />
        </span>
        <h3 className="font-display font-bold">{titulo}</h3>
      </div>
      <div className="mt-4 space-y-2">{children}</div>
    </div>
  );
}

function LinhaMock({ texto, chip, ok }: { texto: string; chip: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-navy-50 px-3 py-2.5 text-sm">
      <span className="flex items-center gap-2 text-navy-700">
        {ok && <CheckCircle2 className="h-4 w-4 text-mint-500" />}
        {texto}
      </span>
      <span className="chip bg-white text-navy-500 ring-1 ring-navy-100">{chip}</span>
    </div>
  );
}
