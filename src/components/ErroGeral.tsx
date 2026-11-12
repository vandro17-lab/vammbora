import { Component, type ErrorInfo, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '@/lib/auth';

/**
 * Rede de segurança: um erro inesperado numa tela mostra uma mensagem com
 * saída (recarregar ou voltar ao início) em vez de uma tela branca.
 */
export class LimiteDeErro extends Component<{ children: ReactNode }, { erro: boolean }> {
  state = { erro: false };
  static getDerivedStateFromError() { return { erro: true }; }
  componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error('[app] erro inesperado na tela:', erro, info.componentStack);
  }
  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <main role="alert" className="flex min-h-dvh flex-col items-center justify-center bg-black px-6 text-center text-white">
        <h1 className="font-display text-2xl font-extrabold">Algo não saiu como esperado</h1>
        <p className="mt-2 max-w-sm text-[#F5F5F5]/85">A página teve um problema. Seus dados continuam salvos. Tente recarregar ou volte ao início.</p>
        <div className="mt-6 grid w-full max-w-xs gap-3">
          <button type="button" onClick={() => window.location.reload()}
            className="min-h-[3.25rem] rounded-2xl bg-[#FFC700] px-5 text-base font-extrabold text-black">Recarregar a página</button>
          <a href="/" className="flex min-h-[3.25rem] items-center justify-center rounded-2xl bg-white px-5 text-base font-extrabold text-black">Voltar ao início</a>
        </div>
      </main>
    );
  }
}

/** Aviso, em qualquer tela, quando o retorno do login (Google ou e-mail) falha. */
export function AvisoErroLogin() {
  const { erroLogin, limparErroLogin } = useAuth();
  if (!erroLogin) return null;
  return (
    <div role="alert" className="fixed inset-x-0 top-0 z-[2000] flex justify-center px-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
      <div className="flex w-full max-w-md items-start gap-3 rounded-2xl bg-white p-4 text-[15px] text-navy-900 shadow-float ring-1 ring-red-200">
        <p className="flex-1"><strong className="block text-red-700">Não foi possível entrar</strong>{erroLogin}</p>
        <button type="button" onClick={limparErroLogin} aria-label="Fechar aviso"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-navy-600 ring-1 ring-navy-200"><X className="h-5 w-5" /></button>
      </div>
    </div>
  );
}
