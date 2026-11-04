import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, Lock, ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { useAuth } from '@/lib/auth';
import { USE_SUPABASE } from '@/lib/supabase';

export function AdminLoginPage() {
  const navigate = useNavigate();
  const { entrar, cadastrar } = useAuth();
  const [modo, setModo] = useState<'entrar' | 'cadastrar'>('entrar');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    setEnviando(true);
    const r = modo === 'entrar' ? await entrar(email, senha) : await cadastrar(email, senha);
    setEnviando(false);
    if (!r.ok) {
      setErro(r.erro ?? 'Não foi possível concluir.');
      return;
    }
    if (modo === 'cadastrar') {
      setAviso(
        'Conta criada! Se o projeto exigir confirmação, verifique seu e-mail. Depois, peça para liberarem seu acesso de administrador.',
      );
      setModo('entrar');
      return;
    }
    navigate('/admin');
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-brand-gradient grain px-5">
      <div className="relative z-10 w-full max-w-sm">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-navy-200 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar ao site
        </Link>
        <div className="card p-7">
          <div className="flex flex-col items-center text-center">
            <Logo />
            <span className="mt-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-navy-900 text-white">
              <Lock className="h-5 w-5" />
            </span>
            <h1 className="mt-3 font-display text-xl font-bold">Administração</h1>
            <p className="mt-1 text-sm text-navy-500">Acesso restrito à equipe.</p>
          </div>

          {!USE_SUPABASE ? (
            <p className="mt-6 rounded-xl bg-amber-50 p-3 text-center text-sm text-amber-800">
              O painel de administração precisa do banco de dados configurado (Supabase). Neste
              ambiente de demonstração ele está desligado.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <label className="field-label" htmlFor="email">
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  className="field-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <div>
                <label className="field-label" htmlFor="senha">
                  Senha
                </label>
                <input
                  id="senha"
                  type="password"
                  className="field-input"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
                  minLength={6}
                  required
                />
              </div>

              {erro && (
                <p className="rounded-xl bg-red-50 p-2.5 text-sm text-red-700" role="alert">
                  {erro}
                </p>
              )}
              {aviso && (
                <p className="rounded-xl bg-mint-50 p-2.5 text-sm text-mint-800">{aviso}</p>
              )}

              <button
                type="submit"
                className="btn btn-sheen btn-lg btn-primary w-full"
                disabled={enviando}
              >
                {enviando ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" /> Aguarde…
                  </>
                ) : modo === 'entrar' ? (
                  'Entrar'
                ) : (
                  'Criar conta'
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setModo((v) => (v === 'entrar' ? 'cadastrar' : 'entrar'));
                  setErro(null);
                  setAviso(null);
                }}
                className="w-full text-center text-sm font-medium text-navy-500 hover:text-navy-800"
              >
                {modo === 'entrar' ? 'Não tem conta? Criar agora' : 'Já tenho conta — entrar'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
