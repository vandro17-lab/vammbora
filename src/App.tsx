import { PreLancamentoPage } from '@/pages/PreLancamentoPage';
import { InicioPage } from '@/pages/InicioPage';
import { HomePage } from '@/pages/HomePage';
import { EntrarFamiliaPage } from '@/pages/familia/EntrarFamiliaPage';
import { SolicitacoesPage, SolicitacaoPage } from '@/pages/familia/SolicitacoesPages';
import { NovaSolicitacaoPage, EditarSolicitacaoPage } from '@/pages/familia/SolicitacaoFormPage';
import { PrivacidadePage } from '@/pages/PrivacidadePage';
import { StartupExperience } from '@/components/brand/StartupExperience';
import { SearchLoadingScreen } from '@/components/search/SearchLoadingScreen';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { ExigirMotorista } from '@/pages/motorista/MotoristaShell';
import { DashboardPage } from '@/pages/vambora-motoristas/DashboardPage';
import { RotasPage, RotaDetalhePage } from '@/pages/vambora-motoristas/RotasPage';
import { MontarVoltaPage } from '@/pages/vambora-motoristas/MontarVoltaPage';
import { OportunidadesPage, SimularEncaixePage as VMSimularPage } from '@/pages/vambora-motoristas/OportunidadesPage';
import { InteligenciaPage } from '@/pages/vambora-motoristas/InteligenciaPage';
import { MinhaVanPage, CadastroVanPage } from '@/pages/vambora-motoristas/MinhaVanPage';
import { MaisPage, ModuloPage } from '@/pages/vambora-motoristas/MaisPage';
import { PerfilProfissionalPage, EditarPerfilProfissionalPage } from '@/pages/vambora-motoristas/PerfilProfissionalPage';
import { EditorMotoristasPage } from '@/pages/vambora-motoristas/EditorMotoristasPage';
import { CriarRotaPage } from '@/pages/vambora-motoristas/CriarRotaPage';
import { AparenciaPage } from '@/pages/vambora-motoristas/admin/AparenciaPage';
import { AppAssetsProvider } from '@/lib/vm/useAppAssets';
import { UiConfigProvider } from '@/lib/vm/useUiConfig';
import { EdicaoAparenciaProvider } from '@/lib/vm/useEdicaoAparencia';
import { Layout } from '@/components/layout/Layout';
import { ScrollManager } from '@/components/ScrollManager';
import { LimiteDeErro, AvisoErroLogin } from '@/components/ErroGeral';
import { PageTransition } from '@/components/motion/PageTransition';
import { VitrineProvider } from '@/data/VitrineProvider';
import { AuthProvider } from '@/lib/auth';
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
import { NavegacaoRotaRealPage } from '@/pages/motorista/NavegacaoRotaRealPage';
import { SimuladorEncaixePage } from '@/pages/motorista/SimuladorEncaixePage';
import { PerfilMotoristaPage, DocumentosMotoristaPage, ProcuraMotoristaPage } from '@/pages/motorista/PaginasSimples';
import { VamboraProPage } from '@/pages/vambora-pro/VamboraProPage';
import { LaboratorioEncaixePage } from '@/pages/vambora-pro/LaboratorioEncaixePage';
import { rotasRedirecionamentoMotorista } from '@/app/navegacao-motorista';

export default function App() {
  return (
    <BrowserRouter>
      <LimiteDeErro>
      <ScrollManager />
      <AuthProvider>
        <AvisoErroLogin />
        <AppAssetsProvider>
        <UiConfigProvider>
        <EdicaoAparenciaProvider>
        <VitrineProvider>
          <StartupExperience>
          <Routes>
            {/* Páginas públicas independentes, sem cabeçalho e rodapé do aplicativo */}
            <Route path="/" element={<InicioPage />} />
            <Route path="/pre-lancamento" element={<PreLancamentoPage />} />
            <Route path="/privacidade" element={<PrivacidadePage />} />
            {/* Família — solicitações de transporte (conta exigida só para confirmar e acompanhar) */}
            <Route path="/familia/entrar" element={<EntrarFamiliaPage />} />
            <Route path="/familia/solicitacoes" element={<SolicitacoesPage />} />
            <Route path="/familia/solicitacoes/nova" element={<NovaSolicitacaoPage />} />
            <Route path="/familia/solicitacoes/:id" element={<SolicitacaoPage />} />
            <Route path="/familia/solicitacoes/:id/editar" element={<EditarSolicitacaoPage />} />
            <Route element={<Layout />}>
              <Route path="/buscar" element={<PageTransition><HomePage /></PageTransition>} />
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
            <Route path="/painel/rota-real/:id" element={<NavegacaoRotaRealPage />} />
            <Route path="/painel/simulador" element={<SimuladorEncaixePage />} />
            {/* Vambora Motoristas — app visual (dados reais + cenário demo) */}
            <Route path="/app" element={<ExigirMotorista><Outlet /></ExigirMotorista>}>
              <Route index element={<DashboardPage />} />
              <Route path="rotas" element={<RotasPage />} />
              <Route path="rotas/nova" element={<CriarRotaPage />} />
              <Route path="rotas/:id" element={<RotaDetalhePage />} />
              <Route path="rotas/:id/volta" element={<MontarVoltaPage />} />
              <Route path="oportunidades" element={<OportunidadesPage />} />
              <Route path="oportunidades/:id" element={<VMSimularPage />} />
              <Route path="inteligencia" element={<InteligenciaPage />} />
              <Route path="van" element={<MinhaVanPage />} />
              <Route path="van/cadastro" element={<CadastroVanPage />} />
              <Route path="perfil" element={<PerfilProfissionalPage />} />
              <Route path="perfil/editar" element={<EditarPerfilProfissionalPage />} />
              <Route path="mais" element={<MaisPage />} />
              <Route path="mais/motoristas" element={<EditorMotoristasPage />} />
              <Route path="mais/:modulo" element={<ModuloPage />} />
              <Route path="admin/aparencia" element={<AparenciaPage />} />
            </Route>
            {/* Vambora Pro — PRÉVIA demonstrativa anterior (preservada como referência) */}
            <Route path="/pro" element={<VamboraProPage />} />
            <Route path="/pro/encaixe" element={<LaboratorioEncaixePage />} />
            {/* Aliases canônicos "Vambora Motoristas" (aditivos; preservam links antigos) */}
            {rotasRedirecionamentoMotorista()}
          </Routes>
          </StartupExperience>
          <SearchLoadingScreen />
        </VitrineProvider>
        </EdicaoAparenciaProvider>
        </UiConfigProvider>
        </AppAssetsProvider>
      </AuthProvider>
      </LimiteDeErro>
    </BrowserRouter>
  );
}
