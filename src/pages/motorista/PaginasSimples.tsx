import { Navigate } from 'react-router-dom';
import { FileText, User, Search } from 'lucide-react';
import { MotoristaShell, ExigirMotorista } from './MotoristaShell';

/**
 * Páginas em construção desta etapa (perfil, documentos, procura).
 * O banco e as regras já existem (migração 0007); a interface completa destas
 * partes entra nas próximas entregas. Nada aqui finge estar pronto.
 */
function EmBreve({ titulo, Icone, texto, voltar }: { titulo: string; Icone: typeof User; texto: string; voltar: string }) {
  return (
    <MotoristaShell titulo={titulo} voltarPara={voltar}>
      <div className="card p-8 text-center">
        <Icone className="mx-auto h-10 w-10 text-navy-300" />
        <h2 className="mt-3 font-display text-lg font-bold">{titulo}</h2>
        <p className="mx-auto mt-2 max-w-sm text-navy-600">{texto}</p>
        <span className="mt-4 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">Em construção nesta parte</span>
      </div>
    </MotoristaShell>
  );
}

/** O perfil profissional agora existe de verdade: leva para a tela nova. */
export function PerfilMotoristaPage() {
  return (
    <ExigirMotorista>
      <Navigate to="/app/perfil" replace />
    </ExigirMotorista>
  );
}

export function DocumentosMotoristaPage() {
  return (
    <ExigirMotorista>
      <EmBreve titulo="Meus documentos" Icone={FileText} voltar="/painel"
        texto="O VanBora não exige envio de documentos para você aparecer às famílias. Um espaço privado e opcional para lembrar vencimentos poderá entrar depois." />
    </ExigirMotorista>
  );
}

export function ProcuraMotoristaPage() {
  return (
    <ExigirMotorista>
      <EmBreve titulo="Onde estão procurando" Icone={Search} voltar="/painel"
        texto="Você vai ver a procura por região, escola e turno — sem dados pessoais das famílias. Por enquanto não há procura registrada para mostrar." />
    </ExigirMotorista>
  );
}
