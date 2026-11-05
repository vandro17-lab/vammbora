import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, USE_SUPABASE } from '@/lib/supabase';

interface AuthState {
  /** Sessão atual (null = deslogado). */
  session: Session | null;
  /** Se o usuário logado tem papel de admin. */
  isAdmin: boolean;
  /** Carregando o estado inicial de autenticação. */
  carregando: boolean;
  entrar: (email: string, senha: string) => Promise<{ ok: boolean; erro?: string }>;
  cadastrar: (email: string, senha: string) => Promise<{ ok: boolean; erro?: string }>;
  /** Login social (OAuth). Redireciona o navegador para o provedor e volta. */
  entrarComProvedor: (provedor: ProvedorOAuth) => Promise<{ ok: boolean; erro?: string }>;
  sair: () => Promise<void>;
}

/** Provedores de login social suportados. Apple fica preparado para ligar depois. */
export type ProvedorOAuth = 'google' | 'apple';

const Ctx = createContext<AuthState>({
  session: null,
  isAdmin: false,
  carregando: true,
  entrar: async () => ({ ok: false, erro: 'Auth indisponível' }),
  cadastrar: async () => ({ ok: false, erro: 'Auth indisponível' }),
  entrarComProvedor: async () => ({ ok: false, erro: 'Auth indisponível' }),
  sair: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [carregando, setCarregando] = useState(true);

  async function checarAdmin(s: Session | null) {
    if (!s || !supabase) {
      setIsAdmin(false);
      return;
    }
    const { data, error } = await supabase.rpc('is_admin');
    setIsAdmin(!error && data === true);
  }

  useEffect(() => {
    if (!USE_SUPABASE || !supabase) {
      setCarregando(false);
      return;
    }
    let vivo = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!vivo) return;
      setSession(data.session);
      await checarAdmin(data.session);
      setCarregando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_evt, s) => {
      setSession(s);
      await checarAdmin(s);
    });
    return () => {
      vivo = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entrar = async (email: string, senha: string) => {
    if (!supabase) return { ok: false, erro: 'Banco não configurado neste ambiente.' };
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    return error ? { ok: false, erro: traduzErro(error.message) } : { ok: true };
  };

  const cadastrar = async (email: string, senha: string) => {
    if (!supabase) return { ok: false, erro: 'Banco não configurado neste ambiente.' };
    const { error } = await supabase.auth.signUp({ email, password: senha });
    return error ? { ok: false, erro: traduzErro(error.message) } : { ok: true };
  };

  const entrarComProvedor = async (provedor: ProvedorOAuth) => {
    if (!supabase) return { ok: false, erro: 'Banco não configurado neste ambiente.' };
    // Volta para o painel do motorista; o supabase-js lê a sessão da URL ao retornar.
    const redirectTo = `${window.location.origin}/painel`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: provedor,
      options: { redirectTo },
    });
    // Em caso de sucesso o navegador é redirecionado para o provedor (não retorna aqui).
    return error ? { ok: false, erro: traduzErro(error.message) } : { ok: true };
  };

  const sair = async () => {
    if (supabase) await supabase.auth.signOut();
    setSession(null);
    setIsAdmin(false);
  };

  return (
    <Ctx.Provider value={{ session, isAdmin, carregando, entrar, cadastrar, entrarComProvedor, sair }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);

function traduzErro(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login')) return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (m.includes('already registered')) return 'Este e-mail já tem cadastro. Faça login.';
  if (m.includes('password')) return 'Senha inválida (mínimo 6 caracteres).';
  if (m.includes('provider is not enabled') || m.includes('not enabled'))
    return 'O login com Google ainda não foi ativado no servidor. Configure o provedor no Supabase (Authentication → Providers).';
  if (m.includes('redirect')) return 'URL de redirecionamento não autorizada. Adicione o domínio em Authentication → URL Configuration no Supabase.';
  return msg;
}
