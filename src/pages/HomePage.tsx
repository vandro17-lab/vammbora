import { Hero } from '@/components/home/Hero';
import { HowItWorks, FAQ, DriverCTA } from '@/components/home/Sections';

// A página inicial é focada na PESQUISA. A antiga vitrine de motoristas
// ("Conheça quem vai com você") foi removida por não ser necessária aqui.
export function HomePage() {
  return <><Hero /><HowItWorks /><FAQ /><DriverCTA /></>;
}
