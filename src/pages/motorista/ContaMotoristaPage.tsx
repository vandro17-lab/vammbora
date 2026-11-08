import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, ArrowLeft, Bus } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { useAuth } from '@/lib/auth';
import { supabase, USE_SUPABASE, DEMO_MOTORISTA } from '@/lib/supabase';
import { CIDADE_PADRAO } from '@/data/cidades';

// Login demonstrativo: entra direto no painel, sem verificação (não trava).
const DEMO_LOGIN = !USE_SUPABASE || DEMO_MOTORISTA;

export function ContaMotoristaPage() {
  const navigate = useNavigate();
  const { entrar, cadastrar, entrarComProvedor } = useAuth();
  const [modo, setModo] = useState<'entrar' | 'criar'>('criar');
  const [nome, setNome] = useState('');
  // No modo demo já vem preenchido com um e-mail/senha de fachada.
  const [email, setEmail] = useState(DEMO_LOGIN ? 'motoristaesperto@vanbora.com' : '');
  const [senha, setSenha] = useState(DEMO_LOGIN ? 'vanbora1' : '');
  const [whats, setWhats] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [emailAberto, setEmailAberto] = useState(false);

  async function entrarGoogle() {
    setErro(null);
    setAviso(null);
    if (DEMO_LOGIN) {
      navigate('/app');
      return;
    }
    setEnviando(true);
    const r = await entrarComProvedor('google');
    // Em caso de sucesso o navegador é redirecionado; só tratamos o erro.
    if (!r.ok) {
      setEnviando(false);
      setErro(r.erro ?? 'Não foi possível entrar com o Google.');
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    // Modo demonstração: entra direto no painel (dados ficam no navegador),
    // sem verificar e-mail/senha — a demonstração nunca trava no login.
    if (DEMO_LOGIN) {
      navigate('/app');
      return;
    }
    setEnviando(true);

    if (modo === 'entrar') {
      const r = await entrar(email, senha);
      setEnviando(false);
      if (!r.ok) { setErro(r.erro ?? 'Não foi possível entrar.'); return; }
      navigate('/app');
      return;
    }

    // CADASTRO simples: criar a conta e já entrar, sem etapa extra de aprovação.
    const r = await cadastrar(email, senha, nome);
    if (!r.ok) {
      setEnviando(false);
      setErro(r.erro ?? 'Não foi possível criar a conta.');
      return;
    }
    // Se a confirmação de e-mail estiver desligada, o cadastro já vem logado.
    // Senão, tentamos entrar na hora (funciona quando a confirmação está off).
    let logado = r.sessao === true;
    if (!logado) {
      const e = await entrar(email, senha);
      logado = e.ok;
    }
    // Perfil (nome/WhatsApp) em melhor esforço — nunca bloqueia a entrada.
    if (logado) { void salvarPerfil(nome, whats); }
    setEnviando(false);

    if (logado) { navigate('/app'); return; }
    // Confirmação de e-mail ligada no servidor: orienta e troca para "entrar".
    setAviso('Conta criada! Confirme seu e-mail pelo link que enviamos e depois é só entrar.');
    setModo('entrar');
  }

  /** Atualiza o perfil sem travar o fluxo (ignora falhas de RLS/conexão). */
  async function salvarPerfil(nomeCompleto: string, whatsapp: string) {
    if (!supabase) return;
    try {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        await supabase.from('profiles').update({ full_name: nomeCompleto, phone: whatsapp }).eq('id', data.user.id);
      }
    } catch { /* melhor esforço */ }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-brand-gradient grain px-5 py-10">
      <div className="relative z-10 w-full max-w-sm">
        <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-navy-200 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Voltar ao site
        </Link>
        <div className="card p-7">
          <div className="flex flex-col items-center text-center">
            <Logo />
            <span className="mt-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-mint-500 text-white">
              <Bus className="h-6 w-6" />
            </span>
            <h1 className="mt-3 font-display text-xl font-bold">
              {DEMO_LOGIN ? 'Área do motorista' : modo === 'criar' ? 'Criar minha conta' : 'Entrar'}
            </h1>
            <p className="mt-1 text-sm text-navy-500">
              {DEMO_LOGIN ? 'Para motoristas de van.' : 'Entre com o Google para gerenciar suas rotas.'}
            </p>
          </div>

          {/* ---- Login DEMONSTRATIVO: e-mail/senha de fachada, entra sem verificar ---- */}
          {DEMO_LOGIN && (
            <form onSubmit={onSubmit} className="mt-6 space-y-3.5">
              <div>
                <label className="field-label" htmlFor="email">E-mail</label>
                <input id="email" type="email" className="field-input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
              </div>
              <div>
                <label className="field-label" htmlFor="senha">Senha</label>
                <input id="senha" type="password" className="field-input" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" />
              </div>
              <button type="submit" className="btn btn-sheen btn-lg btn-primary w-full">
                Entrar no painel
              </button>
            </form>
          )}

          {/* CTA principal: entrar com o Google (login social do motorista). */}
          {!DEMO_LOGIN && (
            <button
              type="button"
              onClick={entrarGoogle}
              disabled={enviando}
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-navy-200 bg-white px-4 py-3 text-sm font-semibold text-navy-800 shadow-sm transition hover:bg-navy-50 disabled:opacity-60"
            >
              {enviando ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <GoogleIcon className="h-5 w-5" />
              )}
              Entrar com o Google
            </button>
          )}

          {!DEMO_LOGIN && erro && <p className="mt-3 rounded-xl bg-red-50 p-2.5 text-sm text-red-700" role="alert">{erro}</p>}
          {!DEMO_LOGIN && aviso && <p className="mt-3 rounded-xl bg-mint-50 p-2.5 text-sm text-mint-800">{aviso}</p>}

          {!DEMO_LOGIN && (
            <>
              <div className="my-5 flex items-center gap-3 text-xs text-navy-400">
                <span className="h-px flex-1 bg-navy-100" /> ou com e-mail <span className="h-px flex-1 bg-navy-100" />
              </div>

              {!emailAberto ? (
                <button
                  type="button"
                  onClick={() => { setEmailAberto(true); setErro(null); setAviso(null); }}
                  className="w-full text-center text-sm font-medium text-navy-500 hover:text-navy-800"
                >
                  Usar e-mail e senha
                </button>
              ) : (
                <>
                  <form onSubmit={onSubmit} className="space-y-3.5">
                    {modo === 'criar' && (
                      <div>
                        <label className="field-label" htmlFor="nome">Seu nome completo</label>
                        <input id="nome" className="field-input" value={nome} onChange={(e) => setNome(e.target.value)} required />
                      </div>
                    )}
                    <div>
                      <label className="field-label" htmlFor="email">E-mail</label>
                      <input id="email" type="email" className="field-input" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div>
                      <label className="field-label" htmlFor="senha">Senha</label>
                      <input id="senha" type="password" className="field-input" value={senha} onChange={(e) => setSenha(e.target.value)} minLength={6} required />
                    </div>
                    {modo === 'criar' && (
                      <>
                        <div>
                          <label className="field-label" htmlFor="whats">WhatsApp</label>
                          <input id="whats" className="field-input" placeholder="(18) 99999-0000" value={whats} onChange={(e) => setWhats(e.target.value)} inputMode="tel" />
                        </div>
                        <div>
                          <label className="field-label" htmlFor="cidade">Cidade</label>
                          <input id="cidade" className="field-input" defaultValue={`${CIDADE_PADRAO.nome} — ${CIDADE_PADRAO.uf}`} />
                        </div>
                      </>
                    )}
                    <button type="submit" className="btn btn-sheen btn-lg btn-primary w-full" disabled={enviando}>
                      {enviando ? <><Loader2 className="h-5 w-5 animate-spin" /> Aguarde…</> : modo === 'criar' ? 'Criar conta' : 'Entrar'}
                    </button>
                  </form>
                  <button
                    className="mt-3 w-full text-center text-sm font-medium text-navy-500 hover:text-navy-800"
                    onClick={() => { setModo((v) => (v === 'criar' ? 'entrar' : 'criar')); setErro(null); setAviso(null); }}
                  >
                    {modo === 'criar' ? 'Já tenho conta — entrar' : 'Criar uma conta'}
                  </button>
                </>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}

/** Logotipo "G" do Google (multicolorido), para o botão de login social. */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.82-.07-1.6-.21-2.36H12v4.46h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.73z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.26v3.09A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.26a12 12 0 0 0 0 10.76l4.01-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.26 6.62l4.01 3.1C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}
