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

/* ---------------- Benefícios ---------------- */
const BENEFICIOS = [
  {
    Icone: Route,
    titulo: 'Rota que faz sentido',
    texto: 'Mostramos só vans cujo trajeto realmente passa perto de você — não a distância no mapa.',
  },
  {
    Icone: Clock,
    titulo: 'Chega a tempo',
    texto: 'Consideramos horário de aula, janela de embarque e o pior caso de trânsito.',
  },
  {
    Icone: Users,
    titulo: 'Vaga de verdade',
    texto: 'Capacidade por trecho: a vaga que aparece respeita quem já está na van.',
  },
  {
    Icone: MessageCircle,
    titulo: 'Contato direto',
    texto: 'Você fala com o motorista pelo WhatsApp, com uma mensagem já preparada.',
  },
];

export function Benefits() {
  return (
    <section className="container-page py-16">
      <h2 className="font-display text-3xl font-bold">Por que o Vambora é diferente</h2>
      <p className="mt-2 max-w-xl text-navy-600">
        Procurar van não precisa ser um sufoco de grupos de WhatsApp e tentativa e erro.
      </p>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {BENEFICIOS.map((b) => (
          <div key={b.titulo} className="card p-6">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-mint-100 text-mint-700">
              <b.Icone className="h-6 w-6" />
            </span>
            <h3 className="mt-4 font-display text-lg font-bold">{b.titulo}</h3>
            <p className="mt-2 text-sm leading-relaxed text-navy-600">{b.texto}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Como funciona ---------------- */
const PASSOS = [
  { Icone: Search, titulo: 'Diga para onde', texto: 'Informe endereço, escola/faculdade, turno e se é mensal ou avulso.' },
  { Icone: MousePointerClick, titulo: 'Compare as vans', texto: 'Veja só as compatíveis, com horário aproximado, vagas e avaliações.' },
  { Icone: HeartHandshake, titulo: 'Combine direto', texto: 'Chame o motorista no WhatsApp e acerte os detalhes com quem dirige.' },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="bg-white py-16">
      <div className="container-page">
        <h2 className="font-display text-3xl font-bold">Como funciona</h2>
        <p className="mt-2 max-w-xl text-navy-600">Três passos. Sem login, sem complicação.</p>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {PASSOS.map((p, i) => (
            <div key={p.titulo} className="relative rounded-2xl bg-navy-50 p-6">
              <span className="absolute right-5 top-4 font-display text-5xl font-extrabold text-navy-100">
                {i + 1}
              </span>
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-navy-900 text-white">
                <p.Icone className="h-6 w-6" />
              </span>
              <h3 className="mt-4 font-display text-lg font-bold">{p.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-navy-600">{p.texto}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Confiança ---------------- */
export function Trust() {
  return (
    <section className="container-page py-16">
      <div className="card grid gap-8 p-8 lg:grid-cols-2 lg:p-10">
        <div>
          <h2 className="font-display text-3xl font-bold">Transparência em primeiro lugar</h2>
          <p className="mt-3 text-navy-600">
            Preferimos um protótipo honesto a promessas vazias. Só marcamos “documentação
            verificada” quando existe verificação de verdade — e dados de exemplo são sempre
            identificados.
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
        <div className="rounded-2xl bg-brand-gradient p-8 text-white">
          <p className="font-display text-xl font-bold leading-snug">
            “Quero preencher assentos sem destruir a rota de quem já está na van.”
          </p>
          <p className="mt-3 text-sm text-navy-200">
            É isso que o motor de compatibilidade do Vambora protege — para a família e para o
            motorista.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---------------- FAQ ---------------- */
const PERGUNTAS = [
  {
    q: 'Preciso criar conta para buscar?',
    a: 'Não. A busca é pública e aberta. Conta só será necessária no futuro, para áreas pessoais.',
  },
  {
    q: 'O Vambora cobra pela viagem?',
    a: 'Não. Neste momento a negociação e o pagamento acontecem direto entre você e o motorista, pelo WhatsApp.',
  },
  {
    q: 'As vans são verificadas?',
    a: 'Mostramos o selo de documentação apenas quando há verificação real registrada. Caso contrário, informamos que não foi verificada.',
  },
  {
    q: 'Os dados que vejo agora são reais?',
    a: 'Este é um protótipo acadêmico (Ideathon Fatec 2026). Os motoristas exibidos são exemplos de demonstração, sempre identificados.',
  },
];

export function FAQ() {
  return (
    <section id="duvidas" className="bg-white py-16">
      <div className="container-page max-w-3xl">
        <h2 className="font-display text-3xl font-bold">Dúvidas frequentes</h2>
        <div className="mt-8 space-y-3">
          {PERGUNTAS.map((p) => (
            <details key={p.q} className="group card p-5 [&_summary]:cursor-pointer">
              <summary className="flex items-center justify-between gap-4 font-semibold text-navy-900 marker:content-['']">
                {p.q}
                <ChevronDown className="h-5 w-5 shrink-0 text-navy-400 transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-navy-600">{p.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Chamada para motoristas ---------------- */
export function DriverCTA() {
  return (
    <section className="container-page py-16">
      <div className="overflow-hidden rounded-3xl bg-brand-gradient p-8 text-white sm:p-12">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Você dirige uma van?</h2>
          <p className="mt-3 text-lg text-navy-100">
            Preencha os assentos vazios com alunos cuja rota combina com a sua. Cadastre-se e apareça
            para as famílias certas.
          </p>
          <Link to="/motorista" className="btn btn-lg btn-primary mt-6">
            Quero cadastrar minha van
          </Link>
        </div>
      </div>
    </section>
  );
}
