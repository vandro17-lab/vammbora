import { Hero } from '@/components/home/Hero';
import { FeaturedDrivers } from '@/components/home/FeaturedDrivers';
import { Benefits, HowItWorks, Trust, FAQ, DriverCTA } from '@/components/home/Sections';
import { DemoBadge } from '@/components/ui/DemoBadge';

export function HomePage() {
  return (
    <>
      <div className="bg-amber-50 text-amber-900">
        <div className="container-page flex items-center justify-center gap-2 py-2 text-center text-xs sm:text-sm">
          <DemoBadge texto="Protótipo acadêmico" />
          <span>Ideathon Fatec 2026 — dados de motoristas são exemplos de demonstração.</span>
        </div>
      </div>
      <Hero />
      <Benefits />
      <HowItWorks />
      <FeaturedDrivers />
      <Trust />
      <FAQ />
      <DriverCTA />
    </>
  );
}
