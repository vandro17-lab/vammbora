import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { ScrollManager } from '@/components/ScrollManager';
import { HomePage } from '@/pages/HomePage';
import { SearchResultsPage } from '@/pages/SearchResultsPage';
import { DriverProfilePage } from '@/pages/DriverProfilePage';
import { DriverLandingPage } from '@/pages/DriverLandingPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export default function App() {
  return (
    <BrowserRouter>
      <ScrollManager />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/resultados" element={<SearchResultsPage />} />
          <Route path="/van/:slug" element={<DriverProfilePage />} />
          <Route path="/motorista" element={<DriverLandingPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
