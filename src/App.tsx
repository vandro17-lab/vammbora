import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { ScrollManager } from '@/components/ScrollManager';
import { PageTransition } from '@/components/motion/PageTransition';
import { VitrineProvider } from '@/data/VitrineProvider';
import { HomePage } from '@/pages/HomePage';
import { SearchResultsPage } from '@/pages/SearchResultsPage';
import { DriverProfilePage } from '@/pages/DriverProfilePage';
import { DriverLandingPage } from '@/pages/DriverLandingPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export default function App() {
  return (
    <BrowserRouter>
      <ScrollManager />
      <VitrineProvider>
        <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<PageTransition><HomePage /></PageTransition>} />
          <Route path="/resultados" element={<PageTransition><SearchResultsPage /></PageTransition>} />
          <Route path="/van/:slug" element={<PageTransition><DriverProfilePage /></PageTransition>} />
          <Route path="/motorista" element={<PageTransition><DriverLandingPage /></PageTransition>} />
          <Route path="*" element={<PageTransition><NotFoundPage /></PageTransition>} />
        </Route>
        </Routes>
      </VitrineProvider>
    </BrowserRouter>
  );
}
