import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { ScrollManager } from '@/components/ScrollManager';
import { PageTransition } from '@/components/motion/PageTransition';
import { VitrineProvider } from '@/data/VitrineProvider';
import { AuthProvider } from '@/lib/auth';
import { HomePage } from '@/pages/HomePage';
import { SearchResultsPage } from '@/pages/SearchResultsPage';
import { DriverProfilePage } from '@/pages/DriverProfilePage';
import { DriverLandingPage } from '@/pages/DriverLandingPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { AdminLoginPage } from '@/pages/admin/AdminLoginPage';
import { AdminPage } from '@/pages/admin/AdminPage';

export default function App() {
  return (
    <BrowserRouter>
      <ScrollManager />
      <AuthProvider>
        <VitrineProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<PageTransition><HomePage /></PageTransition>} />
              <Route path="/resultados" element={<PageTransition><SearchResultsPage /></PageTransition>} />
              <Route path="/van/:slug" element={<PageTransition><DriverProfilePage /></PageTransition>} />
              <Route path="/motorista" element={<PageTransition><DriverLandingPage /></PageTransition>} />
              <Route path="*" element={<PageTransition><NotFoundPage /></PageTransition>} />
            </Route>
            {/* Administração — fora do layout público, protegida por papel */}
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </VitrineProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
