import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  MessageCircle,
  Snowflake,
  UserCheck,
  Accessibility,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Users,
  MapPin,
  CalendarCheck,
} from 'lucide-react';
import { MOTORISTAS_POR_SLUG } from '@/data/motoristas';
import { DESTINOS_POR_ID } from '@/data/destinos';
import { Avatar } from '@/components/brand/Avatar';
import { VanIllustration } from '@/components/brand/VanIllustration';
import { Stars } from '@/components/ui/Stars';
import { DemoBadge } from '@/components/ui/DemoBadge';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { montarLinkWhatsApp, montarMensagemWhatsApp } from '@/lib/whatsapp';
import { formatBRL, TURNO_LABEL, plural } from '@/lib/utils';

export function DriverProfilePage() {
  const { slug } = useParams();
  const m = slug ? MOTORISTAS_POR_SLUG[slug] : undefined;

  if (!m) return <NotFoundPage />;

  const destinos = m.destinosIds.map((id) => DESTINOS_POR_ID[id]).filter(Boolean);
  const mensagem = montarMensagemWhatsApp(m, null, null);
  const linkZap = montarLinkWhatsApp(m.whatsapp, mensagem);

  const recursos = [
    m.recursos.arCondicionado && { Icone: Snowflake, label: 'Ar-condicionado' },
    m.recursos.monitor && { Icone: UserCheck, label: 'Monitor(a) a bordo' },
    m.recursos.cintoTresPontos && { Icone: ShieldCheck, label: 'Cinto de 3 pontos' },
    m.recursos.acessibilidade && { Icone: Accessibility, label: 'Acessibilidade' },
  ].filter(Boolean) as { Icone: typeof Snowflake; label: string }[];

  return (
    <div className="container-page py-8">
      <Link
        to="/resultados"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-500 hover:text-navy-800"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar aos resultados
      </Link>

      <div className="mt-4 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        {/* Coluna principal */}
        <div>
          <div className="card overflow-hidden">
            <div className="relative">
              <VanIllustration seedKey={m.slug} className="h-56 w-full sm:h-64" />
              {m.demo && <DemoBadge className="absolute right-4 top-4" />}
            </div>
            <div className="p-6">
              <div className="flex items-start gap-4">
                <Avatar nome={m.nome} className="h-16 w-16 text-lg" />
                <div className="min-w-0 flex-1">
                  <h1 className="font-display text-2xl font-bold">{m.nome}</h1>
                  <Stars media={m.avaliacao.media} quantidade={m.avaliacao.quantidade} className="mt-1" />
                  <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-navy-500">
                    <MapPin className="h-4 w-4" /> Atende: {m.bairrosAtendidos.join(', ')}
                  </p>
                </div>
              </div>
              <p className="mt-4 leading-relaxed text-navy-700">{m.descricao}</p>
            </div>
          </div>

          {/* Destinos */}
          <div className="card mt-6 p-6">
            <h2 className="font-display text-lg font-bold">Escolas e destinos atendidos</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {destinos.map((d) => (
                <span key={d.id} className="chip bg-navy-50 text-navy-700">
                  {d.nome}
                </span>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {m.turnos.map((t) => (
                <span key={t} className="chip bg-mint-100 text-mint-800">
                  {TURNO_LABEL[t]}
                </span>
              ))}
            </div>
          </div>

          {/* Recursos */}
          <div className="card mt-6 p-6">
            <h2 className="font-display text-lg font-bold">Recursos do veículo</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {recursos.map((r) => (
                <div key={r.label} className="flex items-center gap-2.5 text-navy-700">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-navy-50 text-navy-600">
                    <r.Icone className="h-4 w-4" />
                  </span>
                  {r.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Coluna lateral — ações */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-navy-500">Valor mensal</span>
              <span className="font-display text-2xl font-bold text-navy-900">
                {m.preco.tipo === 'a_combinar'
                  ? 'A combinar'
                  : m.preco.tipo === 'dinamico'
                    ? `A partir de ${formatBRL(m.preco.mensal ?? 0)}`
                    : formatBRL(m.preco.mensal ?? 0)}
              </span>
            </div>
            {m.preco.avulso && (
              <p className="mt-1 text-right text-sm text-navy-500">
                Avulso: {formatBRL(m.preco.avulso)}/dia
              </p>
            )}

            <dl className="mt-5 space-y-3 border-t border-navy-100 pt-5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="inline-flex items-center gap-2 text-navy-500">
                  <Clock className="h-4 w-4" /> Passa por volta de
                </dt>
                <dd className="font-semibold text-navy-900">{m.janela.horario}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="inline-flex items-center gap-2 text-navy-500">
                  <Users className="h-4 w-4" /> Vagas
                </dt>
                <dd className="font-semibold text-navy-900">
                  {m.vagasDisponiveis > 0 ? plural(m.vagasDisponiveis, 'vaga', 'vagas') : 'Sem vaga'}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="inline-flex items-center gap-2 text-navy-500">
                  <CalendarCheck className="h-4 w-4" /> Janela
                </dt>
                <dd className="font-semibold text-navy-900">
                  −{m.janela.toleranciaAntesMin}/+{m.janela.toleranciaDepoisMin} min
                </dd>
              </div>
            </dl>

            {linkZap ? (
              <a
                href={linkZap}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sheen btn-lg btn-whatsapp mt-5 w-full"
              >
                <MessageCircle className="h-5 w-5" />
                Falar no WhatsApp
              </a>
            ) : (
              <p className="mt-5 rounded-xl bg-navy-50 p-3 text-center text-sm text-navy-500">
                Contato indisponível no momento.
              </p>
            )}
            <p className="mt-3 text-center text-xs text-navy-400">
              Abrimos o WhatsApp com uma mensagem pronta. Você revisa antes de enviar.
            </p>

            {/* Status de verificação — honesto */}
            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-navy-100 p-3 text-sm">
              {m.documentacaoVerificada ? (
                <>
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-mint-600" />
                  <span className="text-navy-700">Documentação verificada pela equipe.</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                  <span className="text-navy-600">
                    Documentação ainda <strong>não verificada</strong>. Confira os documentos
                    diretamente com o motorista.
                  </span>
                </>
              )}
            </div>
          </div>

          {m.demo && (
            <p className="mt-4 text-center text-xs text-navy-400">
              Perfil de demonstração. Telefone fictício — o WhatsApp abrirá, mas não há motorista
              real do outro lado.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
