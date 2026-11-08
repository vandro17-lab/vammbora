import { Link } from 'react-router-dom';
import {
  Route,
  Clock,
  Users,
  MessageCircle,
  Search,
  MousePointerClick,
  HeartHandshake,
  ShieldCheck,
  Eye,
  ChevronDown,
} from 'lucide-react';
import { Reveal } from '@/components/motion/Reveal';

/* ---------------- Benefícios ---------------- */
const BENEFICIOS = [
  {
    Icone: Route,
    titulo: 'Rota que faz sentido',
    texto: 'Encontre opções para seu destino e confirme o ponto de embarque.',
  },
  {
    Icone: Clock,
    titulo: 'Chega a tempo',
    texto: 'Converse sobre o horário da aula e a rotina de embarque.',
  },
  {
    Icone: Users,
    titulo: 'Vaga de verdade',
    texto: 'Consulte os lugares informados e confirme a disponibilidade.',
  },
  {
    Icone: MessageCircle,
    titulo: 'Contato direto',
    texto: 'Você fala com o motorista pelo WhatsApp, com uma mensagem já preparada.',
  },
];

export function Benefits() {
  return (
    <section className="container-page py-20">
      <Reveal>
        <h2 className="font-display text-3xl font-bold sm:text-4xl">Por que o VanBora é diferente</h2>
        <p className="mt-2 max-w-xl text-navy-600">
          Procurar van não precisa ser um sufoco de grupos de WhatsApp e tentativa e erro.
        </p>
      </Reveal>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {BENEFICIOS.map((b, i) => (
          <Reveal key={b.titulo} delay={i * 0.08}>
            <div className="card card-interactive h-full p-6">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-mint-100 text-mint-700 ring-1 ring-mint-200/60">
                <b.Icone className="h-6 w-6" />
              </span>
              <h3 className="mt-4 font-display text-lg font-bold">{b.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-navy-600">{b.texto}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Como funciona ---------------- */
const PASSOS = [
  { Icone: Search, titulo: 'Diga para onde', texto: 'Escolha sua região, escola ou faculdade e os horários da sua rotina.' },
  { Icone: MousePointerClick, titulo: 'Compare as vans', texto: 'Conheça os perfis, os recursos da van e os valores informados.' },
  { Icone: HeartHandshake, titulo: 'Combine direto', texto: 'Chame o motorista no WhatsApp e acerte os detalhes com quem dirige.' },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="bg-white py-20">
      <div className="container-page">
        <Reveal>
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Como funciona</h2>
          <p className="mt-2 max-w-xl text-navy-600">Três passos. Sem login, sem complicação.</p>
        </Reveal>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {PASSOS.map((p, i) => (
            <Reveal key={p.titulo} delay={i * 0.1}>
              <div className="relative h-full overflow-hidden rounded-3xl bg-navy-50 p-7 ring-1 ring-navy-100 transition-all duration-500 ease-premium hover:-translate-y-1.5 hover:shadow-card">
                <span className="absolute right-5 top-3 font-display text-6xl font-extrabold text-navy-100">
                  {i + 1}
                </span>
                <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-900 text-white">
                  <p.Icone className="h-6 w-6" />
                </span>
                <h3 className="relative mt-4 font-display text-lg font-bold">{p.titulo}</h3>
                <p className="relative mt-2 text-sm leading-relaxed text-navy-600">{p.texto}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Confiança ---------------- */
export function Trust() {
  return (
    <section className="container-page py-20">
      <Reveal>
        <div className="card grid gap-8 p-8 lg:grid-cols-2 lg:p-12">
          <div>
            <h2 className="font-display text-3xl font-bold sm:text-4xl">Transparência em primeiro lugar</h2>
            <p className="mt-3 text-navy-600">
              Preferimos clareza a promessas vazias. Só marcamos “documentação verificada”
              quando existe verificação de verdade.
            </p>
            <ul className="mt-6 space-y-4">
              <li className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-mint-600" />
                <span className="text-sm text-navy-700">
                  <strong>Verificação real:</strong> selos só aparecem com evidência registrada (quem
                  verificou, quando e validade).
                </span>
              </li>
              <li className="flex items-start gap-3">
                <Eye className="mt-0.5 h-5 w-5 shrink-0 text-mint-600" />
                <span className="text-sm text-navy-700">
                  <strong>Privacidade:</strong> não publicamos endereço completo de nenhum aluno, nunca.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <Route className="mt-0.5 h-5 w-5 shrink-0 text-mint-600" />
                <span className="text-sm text-navy-700">
                  <strong>Compatibilidade real:</strong> se faltam dados para garantir a rota, dizemos
                  “sob consulta” em vez de prometer.
                </span>
              </li>
            </ul>
          </div>
          <div className="relative overflow-hidden rounded-3xl bg-brand-gradient grain p-8 text-white">
            <p className="relative font-display text-2xl font-bold leading-snug">
              “Quero preencher assentos sem destruir a rota de quem já está na van.”
            </p>
            <p className="relative mt-3 text-sm text-navy-200">
              É isso que o motor de compatibilidade do VanBora protege — para a família e para o
              motorista.
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ---------------- FAQ ---------------- */
const PERGUNTAS = [
  {
    q: 'Preciso criar conta para buscar?',
    a: 'Não. Você pode pesquisar e conhecer os perfis sem criar uma conta.',
  },
  {
    q: 'O VanBora cobra pela viagem?',
    a: 'Não. Neste momento a negociação e o pagamento acontecem direto entre você e o motorista, pelo WhatsApp.',
  },
  {
    q: 'As vans são verificadas?',
    a: 'Mostramos o selo de documentação apenas quando há verificação real registrada. Caso contrário, informamos que não foi verificada.',
  },
  {
    q: 'Posso procurar uma viagem avulsa?',
    a: 'Sim. Selecione Avulso na busca e informe a data. A disponibilidade precisa ser confirmada com o motorista para aquele dia.',
  },
];

export function FAQ() {
  return (
    <section id="duvidas" className="bg-white py-20">
      <div className="container-page max-w-3xl">
        <Reveal>
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Dúvidas frequentes</h2>
        </Reveal>
        <div className="mt-8 space-y-3">
          {PERGUNTAS.map((p, i) => (
            <Reveal key={p.q} delay={i * 0.06}>
              <details className="group card p-5 transition-colors [&_summary]:cursor-pointer hover:ring-navy-200">
                <summary className="flex items-center justify-between gap-4 font-semibold text-navy-900 marker:content-['']">
                  {p.q}
                  <ChevronDown className="h-5 w-5 shrink-0 text-navy-400 transition-transform duration-300 group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-navy-600">{p.a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Chamada para motoristas ---------------- */
export function DriverCTA() {
  return (
    <section className="container-page py-20">
      <Reveal>
        <div className="relative overflow-hidden rounded-[2rem] bg-brand-gradient grain p-8 text-white sm:p-14">
          <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-mint-500/20 blur-3xl" />
          <div className="relative max-w-2xl">
            <h2 className="font-display text-3xl font-bold sm:text-4xl">Você dirige uma van?</h2>
            <p className="mt-3 text-lg text-navy-100">
              Preencha os assentos vazios com alunos cuja rota combina com a sua. Conheça uma forma mais simples de
              organizar sua presença e receber novos interessados.
            </p>
            <Link to="/motorista" className="btn btn-sheen btn-lg btn-primary mt-7">
              Conhecer a área do motorista
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
