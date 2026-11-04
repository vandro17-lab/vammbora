import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useVitrine } from '@/data/VitrineProvider';
import { Avatar } from '@/components/brand/Avatar';
import { VanIllustration } from '@/components/brand/VanIllustration';
import { Stars } from '@/components/ui/Stars';
import { DemoBadge } from '@/components/ui/DemoBadge';
import { Reveal } from '@/components/motion/Reveal';

export function FeaturedDrivers() {
  const { motoristas, carregando } = useVitrine();
  const destaque = [...motoristas]
    .sort((a, b) => b.avaliacao.media - a.avaliacao.media)
    .slice(0, 3);

  return (
    <section id="motoristas" className="container-page py-16">
      <Reveal>
        <h2 className="font-display text-3xl font-bold sm:text-4xl">Motoristas em destaque</h2>
        <p className="mt-2 max-w-xl text-navy-600">
          Profissionais bem avaliados pela comunidade. Todos com perfil completo e contato direto.
        </p>
      </Reveal>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {carregando && destaque.length === 0
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card overflow-hidden">
                <div className="shimmer h-40 w-full bg-navy-100" />
                <div className="space-y-3 p-5">
                  <div className="shimmer h-11 w-11 rounded-full bg-navy-100" />
                  <div className="shimmer h-4 w-2/3 rounded bg-navy-100" />
                  <div className="shimmer h-3 w-full rounded bg-navy-100" />
                </div>
              </div>
            ))
          : destaque.map((m, i) => (
          <Reveal key={m.id} delay={i * 0.1}>
            <Link
              to={`/van/${m.slug}`}
              className="card card-interactive group block overflow-hidden"
            >
              <div className="relative overflow-hidden">
                <VanIllustration
                  seedKey={m.slug}
                  className="h-40 w-full transition-transform duration-700 ease-premium group-hover:scale-[1.07]"
                />
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
                  Ver perfil{' '}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
