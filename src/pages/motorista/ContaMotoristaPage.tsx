import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, ArrowLeft, Bus } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { useAuth } from '@/lib/auth';
import { supabase, USE_SUPABASE } from '@/lib/supabase';
import { CIDADE_PADRAO } from '@/data/cidades';

export function ContaMotoristaPage() {
  const navigate = useNavigate();
  const { entrar, cadastrar } = useAuth();
  const [modo, setModo] = useState<'entrar' | 'criar'>('criar');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [whats, setWhats] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    // Modo demonstração: entra direto no painel (dados ficam no navegador).
    if (!USE_SUPABASE) {
      navigate('/painel');
      return;
    }
    setEnviando(true);
    const r = modo === 'criar' ? await cadastrar(email, senha) : await entrar(email, senha);
    if (r.ok && modo === 'criar' && supabase) {
      // Guarda nome e WhatsApp no perfil (melhor esforço).
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        await supabase.from('profiles').update({ full_name: nome, phone: whats }).eq('id', data.user.id);
      }
    }
    setEnviando(false);
    if (!r.ok) {
      setErro(r.erro ?? 'Não foi possível concluir.');
      return;
    }
    if (modo === 'criar') {
      setAviso('Conta criada! Se pedir confirmação, verifique seu e-mail. Depois é só entrar.');
      setModo('entrar');
      return;
    }
    navigate('/painel');
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
              {modo === 'criar' ? 'Criar minha conta' : 'Entrar'}
            </h1>
            <p className="mt-1 text-sm text-navy-500">Para motoristas de van.</p>
          </div>

          {!USE_SUPABASE && (
            <p className="mt-5 rounded-xl bg-amber-50 p-3 text-center text-sm text-amber-800">
              Modo demonstração: você pode explorar o painel sem criar conta. Os dados ficam só neste
              navegador.
            </p>
          )}

          <form onSubmit={onSubmit} className="mt-5 space-y-3.5">
            {USE_SUPABASE && modo === 'criar' && (
              <div>
                <label className="field-label" htmlFor="nome">Seu nome completo</label>
                <input id="nome" className="field-input" value={nome} onChange={(e) => setNome(e.target.value)} required />
              </div>
            )}
            {USE_SUPABASE && (
              <>
                <div>
                  <label className="field-label" htmlFor="email">E-mail</label>
                  <input id="email" type="email" className="field-input" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div>
                  <label className="field-label" htmlFor="senha">Senha</label>
                  <input id="senha" type="password" className="field-input" value={senha} onChange={(e) => setSenha(e.target.value)} minLength={6} required />
                </div>
              </>
            )}
            {USE_SUPABASE && modo === 'criar' && (
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

            {erro && <p className="rounded-xl bg-red-50 p-2.5 text-sm text-red-700">{erro}</p>}
            {aviso && <p className="rounded-xl bg-mint-50 p-2.5 text-sm text-mint-800">{aviso}</p>}

            <button type="submit" className="btn btn-sheen btn-lg btn-primary w-full" disabled={enviando}>
              {enviando ? <><Loader2 className="h-5 w-5 animate-spin" /> Aguarde…</> : !USE_SUPABASE ? 'Entrar no painel' : modo === 'criar' ? 'Criar conta' : 'Entrar'}
            </button>
          </form>

          {USE_SUPABASE && (
            <button
              className="mt-3 w-full text-center text-sm font-medium text-navy-500 hover:text-navy-800"
              onClick={() => { setModo((v) => (v === 'criar' ? 'entrar' : 'criar')); setErro(null); setAviso(null); }}
            >
              {modo === 'criar' ? 'Já tenho conta — entrar' : 'Criar uma conta'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
