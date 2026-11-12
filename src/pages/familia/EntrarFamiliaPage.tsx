import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { VMShell } from '@/components/vm/VMShell';
import { Card, SubHeader } from '@/components/vm/ui';
import { useAuth, caminhoSeguro } from '@/lib/auth';
import { USE_SUPABASE } from '@/lib/supabase';

/**
 * Entrada da FAMÍLIA — usa a MESMA autenticação do app (Supabase: Google ou
 * e-mail e senha). Só é pedida quando a família vai CONFIRMAR uma solicitação
 * ou acompanhar as suas; pesquisar não exige conta. Depois volta para `voltar`.
 */
export function EntrarFamiliaPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const voltar = caminhoSeguro(params.get('voltar'), '/familia/solicitacoes');
  const { session, carregando, entrar, cadastrar, entrarComProvedor } = useAuth();
  const [modo, setModo] = useState<'entrar' | 'criar'>('criar');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (!USE_SUPABASE || (!carregando && session)) return <Navigate to={voltar} replace />;

  async function google() {
    setErro(null); setEnviando(true);
    const r = await entrarComProvedor('google', voltar);
    if (!r.ok) { setEnviando(false); setErro(r.erro ?? 'Não foi possível entrar com o Google.'); }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null); setAviso(null); setEnviando(true);
    if (modo === 'entrar') {
      const r = await entrar(email, senha);
      setEnviando(false);
      if (!r.ok) { setErro(r.erro ?? 'Não foi possível entrar.'); return; }
      navigate(voltar, { replace: true });
      return;
    }
    const r = await cadastrar(email, senha, nome.trim(), voltar);
    if (!r.ok) { setEnviando(false); setErro(r.erro ?? 'Não foi possível criar a conta.'); return; }
    let logado = r.sessao === true;
    if (!logado) logado = (await entrar(email, senha)).ok;
    setEnviando(false);
    if (logado) { navigate(voltar, { replace: true }); return; }
    setAviso('Conta criada! Abra o link que enviamos para o seu e-mail e depois entre aqui.');
    setModo('entrar');
  }

  return (
    <VMShell nav={false}>
      <SubHeader titulo="Entrar na sua conta" onVoltar={() => navigate(-1)} />
      <div className="px-4 pt-4">
        <Card className="p-5">
          <h1 className="font-display text-xl font-bold text-navy-900">Entre para continuar</h1>
          <p className="mt-1 text-[15px] text-navy-600">Com a conta, você confirma e acompanha suas solicitações. Pesquisar continua livre, sem cadastro.</p>

          <button type="button" onClick={google} disabled={enviando}
            className="mt-5 flex h-14 w-full items-center justify-center gap-3 rounded-full bg-white text-base font-bold text-navy-900 ring-1 ring-navy-200 active:scale-[0.98] disabled:opacity-60">
            {enviando ? <Loader2 className="h-5 w-5 animate-spin" /> : <span aria-hidden="true" className="font-black text-[#4285F4]">G</span>} Entrar com o Google
          </button>

          <p className="my-4 text-center text-sm text-navy-500">ou com e-mail e senha</p>

          <form onSubmit={enviar} className="space-y-3">
            {modo === 'criar' && (
              <div>
                <label className="field-label" htmlFor="fam-nome">Seu nome</label>
                <input id="fam-nome" className="field-input text-base" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" required />
              </div>
            )}
            <div>
              <label className="field-label" htmlFor="fam-email">E-mail</label>
              <input id="fam-email" type="email" className="field-input text-base" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </div>
            <div>
              <label className="field-label" htmlFor="fam-senha">Senha {modo === 'criar' && <span className="font-normal text-navy-500">(mínimo 6 caracteres)</span>}</label>
              <input id="fam-senha" type="password" className="field-input text-base" value={senha} onChange={(e) => setSenha(e.target.value)} minLength={6}
                autoComplete={modo === 'criar' ? 'new-password' : 'current-password'} required />
            </div>
            {erro && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{erro}</p>}
            {aviso && <p role="status" className="rounded-xl bg-mint-50 p-3 text-sm text-navy-800">{aviso}</p>}
            <button type="submit" disabled={enviando}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-mint-500 text-base font-bold text-black shadow-float active:scale-[0.98] disabled:opacity-60">
              {enviando ? <><Loader2 className="h-5 w-5 animate-spin" /> Aguarde…</> : modo === 'criar' ? 'Criar conta' : 'Entrar'}
            </button>
          </form>
          <button type="button" onClick={() => { setModo(modo === 'criar' ? 'entrar' : 'criar'); setErro(null); setAviso(null); }}
            className="mt-3 w-full py-2 text-center text-[15px] font-semibold text-navy-700 underline">
            {modo === 'criar' ? 'Já tenho conta: entrar' : 'Ainda não tenho conta: criar'}
          </button>
        </Card>
      </div>
    </VMShell>
  );
}
