import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw } from 'lucide-react';

/**
 * Aviso discreto quando há uma nova versão do app (service worker versionado).
 * Estratégia segura: o usuário decide quando atualizar; nada quebra em segundo plano.
 */
export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 mx-auto w-[min(92%,26rem)] animate-fade-up">
      <div className="card flex items-center gap-3 p-4">
        <RefreshCw className="h-5 w-5 shrink-0 text-mint-600" />
        <p className="flex-1 text-sm text-navy-700">Há uma nova versão do Vambora disponível.</p>
        <button className="btn btn-sm btn-primary" onClick={() => updateServiceWorker(true)}>
          Atualizar
        </button>
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => setNeedRefresh(false)}
          aria-label="Dispensar aviso de atualização"
        >
          Agora não
        </button>
      </div>
    </div>
  );
}
