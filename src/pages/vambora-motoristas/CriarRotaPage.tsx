import { ConstrutorRota } from '@/pages/motorista/ConstrutorRotaPage';

/**
 * Criar rota pelo app do motorista (`/app/rotas/nova`).
 * É o MESMO construtor guiado do painel — um só cadastro, um só conjunto de
 * regras (edição, ocupação, horários e gravação continuam nas bibliotecas).
 */
export function CriarRotaPage() {
  return <ConstrutorRota voltarPara="/app/rotas" />;
}
