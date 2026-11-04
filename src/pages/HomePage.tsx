import { Hero } from '@/components/home/Hero';
import { FeaturedDrivers } from '@/components/home/FeaturedDrivers';
import { HowItWorks, FAQ, DriverCTA } from '@/components/home/Sections';

export function HomePage() {
  return <><Hero /><FeaturedDrivers /><HowItWorks /><FAQ /><DriverCTA /></>;
}
