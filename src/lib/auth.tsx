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
  sair: () => Promise<void>;
}

const Ctx = createContext<AuthState>({
  session: null,
  isAdmin: false,
  carregando: true,
  entrar: async () => ({ ok: false, erro: 'Auth indisponível' }),
  cadastrar: async () => ({ ok: false, erro: 'Auth indisponível' }),
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

  const sair = async () => {
    if (supabase) await supabase.auth.signOut();
    setSession(null);
    setIsAdmin(false);
  };

  return (
    <Ctx.Provider value={{ session, isAdmin, carregando, entrar, cadastrar, sair }}>
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
  return msg;
}
