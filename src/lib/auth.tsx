import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, USE_SUPABASE, RETORNO_AUTH_INICIAL } from '@/lib/supabase';
import { mensagemErroLogin, urlSemErroDeAuth } from '@/lib/retorno-auth';

interface AuthState {
  /** Sessão atual (null = deslogado). */
  session: Session | null;
  /** Se o usuário logado tem papel de admin. */
  isAdmin: boolean;
  /** Verificação de admin em andamento (evita "sem permissão" piscando). */
  verificandoAdmin: boolean;
  /** Carregando o estado inicial de autenticação. */
  carregando: boolean;
  entrar: (email: string, senha: string) => Promise<{ ok: boolean; erro?: string }>;
  /** Cadastro. `sessao` indica se já ficou logado (confirmação de e-mail desligada). */
  /** `voltarPara`: caminho do app para o link de confirmação de e-mail (padrão: painel do motorista). */
  cadastrar: (email: string, senha: string, nome?: string, voltarPara?: string) => Promise<{ ok: boolean; erro?: string; sessao?: boolean }>;
  /** Login social (OAuth). Redireciona o navegador para o provedor e volta para
   *  `voltarPara` (padrão: painel do motorista). */
  entrarComProvedor: (provedor: ProvedorOAuth, voltarPara?: string) => Promise<{ ok: boolean; erro?: string }>;
  sair: () => Promise<void>;
  /** Falha no retorno do login (Google ou link de e-mail), em linguagem simples. */
  erroLogin: string | null;
  limparErroLogin: () => void;
}

/** Provedores de login social suportados. Apple fica preparado para ligar depois. */
export type ProvedorOAuth = 'google' | 'apple';

const Ctx = createContext<AuthState>({
  session: null,
  isAdmin: false,
  verificandoAdmin: false,
  carregando: true,
  entrar: async () => ({ ok: false, erro: 'Auth indisponível' }),
  cadastrar: async () => ({ ok: false, erro: 'Auth indisponível' }),
  entrarComProvedor: async () => ({ ok: false, erro: 'Auth indisponível' }),
  sair: async () => {},
  erroLogin: null,
  limparErroLogin: () => {},
});

/** Resolve a promessa com um valor de fallback se estourar o tempo (evita UI presa). */
function comTimeout<T>(p: PromiseLike<T>, ms: number, aoEstourar: () => T): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((resolve) => setTimeout(() => resolve(aoEstourar()), ms)),
  ]);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [verificandoAdmin, setVerificandoAdmin] = useState(USE_SUPABASE);
  const [carregando, setCarregando] = useState(true);
  const [erroLogin, setErroLogin] = useState<string | null>(
    RETORNO_AUTH_INICIAL?.tipo === 'erro' ? mensagemErroLogin(RETORNO_AUTH_INICIAL) : null,
  );

  // Tira o erro do login da URL (recarregar não repete o aviso). O detalhe
  // técnico fica só no console.
  useEffect(() => {
    if (RETORNO_AUTH_INICIAL?.tipo !== 'erro') return;
    console.warn('[auth] retorno com erro:', RETORNO_AUTH_INICIAL.codigo, RETORNO_AUTH_INICIAL.descricao);
    try { window.history.replaceState(window.history.state, '', urlSemErroDeAuth(window.location.href)); } catch { /* ignora */ }
  }, []);

  // Verifica o papel de admin SEM nunca travar a UI: tem timeout e engole erros.
  async function checarAdmin(s: Session | null) {
    if (!s || !supabase) {
      setIsAdmin(false);
      setVerificandoAdmin(false);
      return;
    }
    setVerificandoAdmin(true);
    try {
      const { data, error } = await comTimeout(
        supabase.rpc('is_admin'),
        8000,
        () => ({ data: false, error: null } as { data: unknown; error: unknown }),
      );
      setIsAdmin(!error && data === true);
    } catch {
      setIsAdmin(false);
    } finally {
      setVerificandoAdmin(false);
    }
  }

  useEffect(() => {
    if (!USE_SUPABASE || !supabase) {
      setCarregando(false);
      return;
    }
    let vivo = true;
    // O carregamento inicial NÃO espera o check de admin (ele roda em segundo
    // plano). Assim o app libera assim que a sessão é conhecida, mesmo que o
    // banco esteja "frio" e a RPC demore.
    supabase.auth.getSession().then(({ data, error }) => {
      if (!vivo) return;
      setSession(data.session);
      setCarregando(false);
      // Voltou do login com sessão na URL, mas ela não pôde ser lida/salva.
      if (error && RETORNO_AUTH_INICIAL) {
        console.warn('[auth] sessão do retorno não foi aceita:', error.message);
        setErroLogin((atual) => atual ?? mensagemErroLogin({ tipo: 'erro', codigo: (error as { code?: string }).code, descricao: error.message }));
      }
      void checarAdmin(data.session);
    }).catch(() => {
      // Nunca fica "carregando" para sempre.
      if (!vivo) return;
      setCarregando(false);
      if (RETORNO_AUTH_INICIAL) setErroLogin((atual) => atual ?? 'Não foi possível entrar. Tente de novo em instantes.');
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      // IMPORTANTE: não chamar funções do Supabase (ex.: rpc) de forma
      // síncrona/awaited aqui dentro — isso trava o cliente de auth (deadlock),
      // deixando o login "pensando". Atualizamos a sessão na hora e adiamos
      // qualquer chamada ao banco para fora do callback.
      setSession(s);
      setCarregando(false);
      setTimeout(() => { if (vivo) void checarAdmin(s); }, 0);
    });
    return () => {
      vivo = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entrar = async (email: string, senha: string) => {
    if (!supabase) return { ok: false, erro: 'Banco não configurado neste ambiente.' };
    try {
      type RespEntrar = Awaited<ReturnType<NonNullable<typeof supabase>['auth']['signInWithPassword']>>;
      const { error } = await comTimeout(
        supabase.auth.signInWithPassword({ email: email.trim(), password: senha }),
        20000,
        () => ({ data: { user: null, session: null }, error: { message: 'timeout' } } as unknown as RespEntrar),
      );
      return error ? { ok: false, erro: traduzErro(error.message) } : { ok: true };
    } catch {
      return { ok: false, erro: 'Falha de conexão. Tente novamente.' };
    }
  };

  const cadastrar = async (email: string, senha: string, nome?: string, voltarPara = '/painel') => {
    if (!supabase) return { ok: false, erro: 'Banco não configurado neste ambiente.' };
    try {
      type RespCadastro = Awaited<ReturnType<NonNullable<typeof supabase>['auth']['signUp']>>;
      const { data, error } = await comTimeout(
        supabase.auth.signUp({
          email: email.trim(),
          password: senha,
          // Guarda o nome já no cadastro: o gatilho handle_new_user cria o
          // perfil com esse full_name, independe de a tela conseguir atualizar.
          options: { data: { full_name: nome ?? '' }, emailRedirectTo: `${window.location.origin}${caminhoSeguro(voltarPara)}` },
        }),
        20000,
        () => ({ data: { user: null, session: null }, error: { message: 'timeout' } } as unknown as RespCadastro),
      );
      if (error) return { ok: false, erro: traduzErro(error.message) };
      return { ok: true, sessao: !!data.session };
    } catch {
      return { ok: false, erro: 'Falha de conexão. Tente novamente.' };
    }
  };

  const entrarComProvedor = async (provedor: ProvedorOAuth, voltarPara = '/painel') => {
    if (!supabase) return { ok: false, erro: 'Banco não configurado neste ambiente.' };
    // Volta para o caminho pedido (padrão: painel do motorista); o supabase-js lê a sessão da URL ao retornar.
    const redirectTo = `${window.location.origin}${caminhoSeguro(voltarPara)}`;
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
    <Ctx.Provider value={{ session, isAdmin, verificandoAdmin, carregando, entrar, cadastrar, entrarComProvedor, sair, erroLogin, limparErroLogin: () => setErroLogin(null) }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);

/** Só caminhos INTERNOS do app (evita redirecionar para outro site). */
export function caminhoSeguro(caminho: string | null | undefined, padrao = '/painel'): string {
  return typeof caminho === 'string' && /^\/(?!\/)[^\s\\]*$/.test(caminho) ? caminho : padrao;
}

function traduzErro(msg: string): string {
  const m = msg.toLowerCase();
  if (m === 'timeout' || m.includes('timeout'))
    return 'O servidor demorou a responder. Verifique a conexão e tente novamente.';
  if (m.includes('invalid login')) return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (m.includes('already registered')) return 'Este e-mail já tem cadastro. Faça login.';
  if (m.includes('password')) return 'Senha inválida (mínimo 6 caracteres).';
  if (m.includes('provider is not enabled') || m.includes('not enabled'))
    return 'O login com Google ainda não foi ativado no servidor. Configure o provedor no Supabase (Authentication → Providers).';
  if (m.includes('redirect')) return 'URL de redirecionamento não autorizada. Adicione o domínio em Authentication → URL Configuration no Supabase.';
  return msg;
}
