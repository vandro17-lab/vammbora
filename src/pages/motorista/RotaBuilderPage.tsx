import { ExigirMotorista } from './MotoristaShell';
import { ConstrutorRota } from './ConstrutorRotaPage';

export { rotaNova } from './ConstrutorRotaPage';

/** Criar/editar rota pelo painel (`/painel/rota/:id`): o construtor guiado, direto no mapa. */
export function RotaBuilderPage() {
  return (
    <ExigirMotorista>
      <ConstrutorRota voltarPara="/painel/rotas" />
    </ExigirMotorista>
  );
}
