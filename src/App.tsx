import { StartupExperience } from '@/components/brand/StartupExperience';
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
import { ContaMotoristaPage } from '@/pages/motorista/ContaMotoristaPage';
import { PainelMotoristaPage } from '@/pages/motorista/PainelMotoristaPage';
import { VeiculosPage } from '@/pages/motorista/VeiculosPage';
import { RotasListPage } from '@/pages/motorista/RotasListPage';
import { RotaBuilderPage } from '@/pages/motorista/RotaBuilderPage';
import { SimuladorEncaixePage } from '@/pages/motorista/SimuladorEncaixePage';
import { PerfilMotoristaPage, DocumentosMotoristaPage, ProcuraMotoristaPage } from '@/pages/motorista/PaginasSimples';
import { VamboraProPage } from '@/pages/vambora-pro/VamboraProPage';
import { LaboratorioEncaixePage } from '@/pages/vambora-pro/LaboratorioEncaixePage';
import { rotasRedirecionamentoMotorista } from '@/app/navegacao-motorista';

export default function App() {
  return (
    <BrowserRouter>
      <ScrollManager />
      <AuthProvider>
        <VitrineProvider>
          <StartupExperience>
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
            {/* Motorista — conta e painel (chrome próprio) */}
            <Route path="/motorista/conta" element={<ContaMotoristaPage />} />
            <Route path="/painel" element={<PainelMotoristaPage />} />
            <Route path="/painel/veiculos" element={<VeiculosPage />} />
            <Route path="/painel/perfil" element={<PerfilMotoristaPage />} />
            <Route path="/painel/documentos" element={<DocumentosMotoristaPage />} />
            <Route path="/painel/procura" element={<ProcuraMotoristaPage />} />
            <Route path="/painel/rotas" element={<RotasListPage />} />
            <Route path="/painel/rota/:id" element={<RotaBuilderPage />} />
            <Route path="/painel/simulador" element={<SimuladorEncaixePage />} />
            {/* Vambora Pro — PRÉVIA demonstrativa (não substitui o app real /painel) */}
            <Route path="/pro" element={<VamboraProPage />} />
            <Route path="/pro/encaixe" element={<LaboratorioEncaixePage />} />
            {/* Aliases canônicos "Vambora Motoristas" (aditivos; preservam links antigos) */}
            {rotasRedirecionamentoMotorista()}
          </Routes>
          </StartupExperience>
        </VitrineProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
