import { Link } from 'react-router-dom';
import { Snowflake, UserCheck, Accessibility, ShieldCheck, Users, Clock } from 'lucide-react';
import type { ResultadoCompatibilidade } from '@/types';
import { Avatar } from '@/components/brand/Avatar';
import { VanIllustration } from '@/components/brand/VanIllustration';
import { Stars } from '@/components/ui/Stars';
import { CompatBadge } from '@/components/ui/CompatBadge';
import { DemoBadge } from '@/components/ui/DemoBadge';
import { formatBRL, plural } from '@/lib/utils';

function textoPreco(r: ResultadoCompatibilidade): string {
  const { preco } = r.motorista;
  if (preco.tipo === 'a_combinar') return 'A combinar';
  if (preco.tipo === 'dinamico') return `A partir de ${formatBRL(preco.mensal ?? 0)}/mês`;
  return `${formatBRL(preco.mensal ?? 0)}/mês`;
}

export function ResultCard({ resultado }: { resultado: ResultadoCompatibilidade }) {
  const m = resultado.motorista;
  const recursos = [
    m.recursos.arCondicionado && { Icone: Snowflake, label: 'Ar-condicionado' },
    m.recursos.monitor && { Icone: UserCheck, label: 'Monitor(a)' },
    m.recursos.acessibilidade && { Icone: Accessibility, label: 'Acessível' },
  ].filter(Boolean) as { Icone: typeof Snowflake; label: string }[];

  return (
    <article className="card group overflow-hidden transition-shadow hover:shadow-card-hover">
      <div className="relative">
        <VanIllustration seedKey={m.slug} className="h-40 w-full" />
        <div className="absolute left-3 top-3 flex gap-2">
          <CompatBadge nivel={resultado.nivel} />
        </div>
        {m.demo && <DemoBadge className="absolute right-3 top-3" />}
      </div>

      <div className="p-5">
        <div className="flex items-start gap-3">
          <Avatar nome={m.nome} className="h-12 w-12 text-sm" />
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-lg font-bold text-navy-900">{m.nome}</h3>
            <Stars media={m.avaliacao.media} quantidade={m.avaliacao.quantidade} className="mt-0.5" />
          </div>
        </div>

        <p className="mt-3 line-clamp-2 text-sm text-navy-600">{m.descricao}</p>

        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2 text-navy-700">
            <Clock className="h-4 w-4 text-navy-400" />
            <span>Passa ~{resultado.passagemAproximada}</span>
          </div>
          <div className="flex items-center gap-2 text-navy-700">
            <Users className="h-4 w-4 text-navy-400" />
            <span>
              {m.vagasDisponiveis > 0
                ? plural(m.vagasDisponiveis, 'vaga', 'vagas')
                : 'Sem vaga aberta'}
            </span>
          </div>
        </div>

        {recursos.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {recursos.map((r) => (
              <span key={r.label} className="chip bg-navy-50 text-navy-600">
                <r.Icone className="h-3.5 w-3.5" />
                {r.label}
              </span>
            ))}
          </div>
        )}

        <p className="mt-3 text-sm text-navy-500">{resultado.resumo}</p>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-navy-100 pt-4">
          <div>
            <p className="font-display text-lg font-bold text-navy-900">{textoPreco(resultado)}</p>
            {m.documentacaoVerificada ? (
              <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-mint-700">
                <ShieldCheck className="h-3.5 w-3.5" /> Documentação verificada
              </span>
            ) : (
              <span className="mt-0.5 text-xs text-navy-400">Documentação não verificada</span>
            )}
          </div>
          <Link to={`/van/${m.slug}`} className="btn btn-md btn-navy shrink-0">
            Ver perfil
          </Link>
        </div>
      </div>
    </article>
  );
}

/** Esqueleto de carregamento do card. */
export function ResultCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="shimmer h-40 w-full bg-navy-100" />
      <div className="space-y-3 p-5">
        <div className="flex items-center gap-3">
          <div className="shimmer h-12 w-12 rounded-full bg-navy-100" />
          <div className="flex-1 space-y-2">
            <div className="shimmer h-4 w-2/3 rounded bg-navy-100" />
            <div className="shimmer h-3 w-1/2 rounded bg-navy-100" />
          </div>
        </div>
        <div className="shimmer h-3 w-full rounded bg-navy-100" />
        <div className="shimmer h-3 w-4/5 rounded bg-navy-100" />
        <div className="shimmer h-10 w-full rounded-xl bg-navy-100" />
      </div>
    </div>
  );
}
