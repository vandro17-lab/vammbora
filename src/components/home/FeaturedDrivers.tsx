import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { MOTORISTAS } from '@/data/motoristas';
import { Avatar } from '@/components/brand/Avatar';
import { VanIllustration } from '@/components/brand/VanIllustration';
import { Stars } from '@/components/ui/Stars';
import { DemoBadge } from '@/components/ui/DemoBadge';

export function FeaturedDrivers() {
  const destaque = [...MOTORISTAS]
    .sort((a, b) => b.avaliacao.media - a.avaliacao.media)
    .slice(0, 3);

  return (
    <section id="motoristas" className="container-page py-16">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-bold">Motoristas em destaque</h2>
          <p className="mt-2 max-w-xl text-navy-600">
            Profissionais bem avaliados pela comunidade. Todos com perfil completo e contato direto.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {destaque.map((m) => (
          <Link
            key={m.id}
            to={`/van/${m.slug}`}
            className="card group overflow-hidden transition-shadow hover:shadow-card-hover"
          >
            <div className="relative">
              <VanIllustration seedKey={m.slug} className="h-36 w-full" />
              {m.demo && <DemoBadge className="absolute right-3 top-3" />}
            </div>
            <div className="p-5">
              <div className="flex items-center gap-3">
                <Avatar nome={m.nome} className="h-11 w-11 text-sm" />
                <div>
                  <h3 className="font-display font-bold text-navy-900">{m.nome}</h3>
                  <Stars media={m.avaliacao.media} quantidade={m.avaliacao.quantidade} />
                </div>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-navy-600">{m.descricao}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-mint-700">
                Ver perfil <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
