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

export function PerfilMotoristaPage() {
  return (
    <ExigirMotorista>
      <EmBreve titulo="Meu perfil" Icone={User} voltar="/painel"
        texto="Aqui você vai dizer como costuma ser chamado, colocar sua foto e as etapas de ensino que atende. Em breve nesta parte." />
    </ExigirMotorista>
  );
}

export function DocumentosMotoristaPage() {
  return (
    <ExigirMotorista>
      <EmBreve titulo="Meus documentos" Icone={FileText} voltar="/painel"
        texto="O envio dos documentos pelo celular e o acompanhamento da análise entram na próxima parte. Lembrando: você só aparece às famílias depois que os documentos forem aprovados." />
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
