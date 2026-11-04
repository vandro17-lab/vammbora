import { nomeDestinoParaExibicao } from '@/lib/utils';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { paramsParaCriterios } from '@/lib/searchParams';
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
  Loader2,
} from 'lucide-react';
import { useVitrine } from '@/data/VitrineProvider';
import { solicitarContatoWhatsapp } from '@/data/source';
import { Avatar } from '@/components/brand/Avatar';
import { VanIllustration } from '@/components/brand/VanIllustration';
import { Stars } from '@/components/ui/Stars';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { montarLinkWhatsApp, montarMensagemWhatsApp } from '@/lib/whatsapp';
import { formatBRL, TURNO_LABEL, plural } from '@/lib/utils';

export function DriverProfilePage() {
  const { slug } = useParams();
  const [sp] = useSearchParams();
  const criterios = sp.size ? paramsParaCriterios(sp) : null;
  const busca = sp.size ? `?${sp.toString()}` : '';
  const { motoristas, destinosPorId, carregando } = useVitrine();
  const [abrindoZap, setAbrindoZap] = useState(false);
  const [erroZap, setErroZap] = useState(false);

  const m = slug ? motoristas.find((x) => x.slug === slug) : undefined;

  // Ainda carregando os dados da vitrine (do banco ou locais).
  if (!m && carregando) {
    return (
      <div className="container-page flex items-center justify-center py-32 text-navy-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!m) return <NotFoundPage />;

  const motorista = m;
  const destinos = motorista.destinosIds.map((id) => destinosPorId[id]).filter(Boolean);

  // Abre o WhatsApp de forma segura (popup aberto no clique) e registra o lead.
  // O telefone vem do banco via RPC quando o Supabase está ligado; senão, local.
  async function abrirWhatsApp() {
    setErroZap(false);
    setAbrindoZap(true);
    const janela = window.open('about:blank', '_blank');
    const fone = await solicitarContatoWhatsapp(motorista.slug, true, { destinoId: criterios?.destinoId, turno: criterios?.turno, contratacao: criterios?.contratacao });
    const link = fone
      ? montarLinkWhatsApp(fone, montarMensagemWhatsApp(motorista, criterios, criterios?.destinoId ? destinosPorId[criterios.destinoId] ?? null : null))
      : null;
    setAbrindoZap(false);
    if (link && janela) {
      janela.location.href = link;
    } else {
      janela?.close();
      setErroZap(true);
    }
  }

  const recursos = [
    m.recursos.arCondicionado && { Icone: Snowflake, label: 'Ar-condicionado' },
    m.recursos.monitor && { Icone: UserCheck, label: 'Monitor(a) a bordo' },
    m.recursos.cintoTresPontos && { Icone: ShieldCheck, label: 'Cinto de 3 pontos' },
    m.recursos.acessibilidade && { Icone: Accessibility, label: 'Acessibilidade' },
  ].filter(Boolean) as { Icone: typeof Snowflake; label: string }[];

  return (
    <div className="container-page pb-28 pt-8 lg:pb-12">
      <Link
        to={`/resultados${busca}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-500 hover:text-navy-800"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar aos resultados
      </Link>

      <div className="mt-4 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        {/* Coluna principal */}
        <div>
          <div className="card overflow-hidden">
            <div className="relative">
              <VanIllustration seedKey={m.slug} className="h-64 w-full sm:h-80" />
              <span className="absolute bottom-4 left-5 rounded-full bg-white/95 px-4 py-2 text-xs font-semibold text-navy-700">Escolar e universitário · Araçatuba</span>
            </div>
            <div className="p-6">
              <div className="flex items-start gap-4">
                <Avatar nome={m.nome} className="h-16 w-16 text-lg" />
                <div className="min-w-0 flex-1">
                  <h1 className="font-display text-2xl font-bold">{m.nome}</h1>
                  {!m.demo && m.avaliacao.quantidade > 0 && <Stars media={m.avaliacao.media} quantidade={m.avaliacao.quantidade} className="mt-1" />}
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
                  {nomeDestinoParaExibicao(d.nome)}
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
                  <Clock className="h-4 w-4" /> Horário informado
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
                  {m.janela.toleranciaAntesMin} min antes / {m.janela.toleranciaDepoisMin} min depois
                </dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={abrirWhatsApp}
              disabled={abrindoZap || m.demo}
              className="btn btn-sheen btn-lg btn-whatsapp mt-5 w-full"
            >
              {abrindoZap ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Abrindo…
                </>
              ) : (
                <>
                  <MessageCircle className="h-5 w-5" />
                  {m.demo ? 'Contato em breve' : 'Falar no WhatsApp'}
                </>
              )}
            </button>
            {erroZap && (
              <p className="mt-2 rounded-xl bg-red-50 p-2 text-center text-xs text-red-700" role="alert">
                Não foi possível abrir o contato agora. Tente novamente.
              </p>
            )}
            <p className="mt-3 text-center text-xs text-navy-400">
              {m.demo ? 'Explore o perfil e conheça a proposta de atendimento.' : 'Você revisa a mensagem antes de enviar. Sem compromisso.'}
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
                    Verificação documental pendente. Confira os documentos antes de contratar.
                  </span>
                </>
              )}
            </div>
          </div>

        </aside>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-navy-100 bg-white/95 px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-4 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{m.nome}</p><p className="text-xs text-navy-500">Converse sobre sua rota</p></div>
          <button type="button" onClick={abrirWhatsApp} disabled={abrindoZap || m.demo} className="btn btn-md btn-primary shrink-0">
            <MessageCircle className="h-4 w-4" />{m.demo ? 'Em breve' : abrindoZap ? 'Abrindo…' : 'Conversar'}
          </button>
        </div>
      </div>
    </div>
  );
}
