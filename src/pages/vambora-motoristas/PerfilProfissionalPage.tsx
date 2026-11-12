import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Circle, Loader2, MapPin, MessageCircle, Pencil, Eye, EyeOff, UserRound, ExternalLink, Info, Route as RouteIcon, Lock } from 'lucide-react';
import { Avatar } from '@/components/brand/Avatar';
import { VMShell } from '@/components/vm/VMShell';
import { Card, SubHeader, AvisoErro, EstadoVazio } from '@/components/vm/ui';
import { useMeuPerfil } from '@/lib/vm/useMeuPerfil';
import { salvarMeuPerfil, publicarMeuPerfil, definirContatoWhatsapp } from '@/data/perfil-motorista';
import { useAuth } from '@/lib/auth';
import { CIDADES, CIDADE_PADRAO } from '@/data/cidades';
import {
  ETAPAS_PERFIL, EXEMPLO_APRESENTACAO, APRESENTACAO_MAX, NOME_MAX,
  validarEtapa, primeiraEtapaComProblema, rascunhoInicial, mascararWhatsapp,
  itensDePublicacao, textoDaSituacao, textoDasRotas, type EtapaPerfil, type RascunhoPerfil,
} from '@/lib/perfil-motorista';
import { cn } from '@/lib/utils';

const nomeDaCidade = (id: string) => {
  const c = CIDADES.find((x) => x.id === id);
  return c ? `${c.nome} — ${c.uf}` : id;
};

/* ======================= Meu perfil profissional (resumo) ======================= */
export function PerfilProfissionalPage() {
  const navigate = useNavigate();
  const { carregando, erro, perfil, recarregar } = useMeuPerfil();
  const [publicando, setPublicando] = useState(false);
  const [erroPub, setErroPub] = useState<string | null>(null);

  const [mudandoContato, setMudandoContato] = useState(false);
  async function alternarContato() {
    if (!perfil) return;
    setErroPub(null);
    setMudandoContato(true);
    try {
      await definirContatoWhatsapp(!perfil.contatoWhatsappAtivo);
      recarregar();
    } catch (e) {
      setErroPub((e as Error).message);
    } finally {
      setMudandoContato(false);
    }
  }

  async function alternarPublicacao() {
    if (!perfil) return;
    setErroPub(null);
    setPublicando(true);
    try {
      await publicarMeuPerfil(!perfil.anuncioAtivo);
      recarregar();
    } catch (e) {
      setErroPub((e as Error).message);
    } finally {
      setPublicando(false);
    }
  }

  const situacao = perfil ?? { temPerfil: false, anuncioAtivo: false, rotasDisponiveis: 0, suspenso: false, visivel: false };

  return (
    <VMShell>
      <SubHeader titulo="Meu perfil profissional" onVoltar={() => navigate('/app/mais')} />
      <div className="space-y-3 px-4 pt-4">
        {carregando && (
          <div className="flex justify-center py-16 text-navy-400" aria-live="polite">
            <Loader2 className="h-6 w-6 animate-spin" /><span className="sr-only">Carregando…</span>
          </div>
        )}
        {!carregando && erro && <AvisoErro mensagem={erro} onTentar={recarregar} />}

        {!carregando && !erro && !perfil && (
          <EstadoVazio
            icon={UserRound}
            titulo="Crie seu perfil profissional"
            texto="É o que as famílias vão ver: como você gosta de ser chamado e uma apresentação curta. Leva poucos minutos."
            acao={<Link to="/app/perfil/editar" className="flex h-14 w-full items-center justify-center rounded-full bg-mint-500 text-base font-bold text-white shadow-float">Criar meu perfil</Link>}
          />
        )}

        {!carregando && !erro && perfil && (
          <>
            <Card className="flex items-start gap-3">
              <Avatar nome={perfil.nome} className="h-14 w-14 text-lg" />
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-bold leading-tight text-navy-900">{perfil.nome}</p>
                <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-navy-500"><MapPin className="h-4 w-4" /> {nomeDaCidade(perfil.cidadeId)}</p>
                {perfil.descricao && <p className="mt-2 line-clamp-3 text-sm text-navy-700">{perfil.descricao}</p>}
              </div>
            </Card>

            <Card>
              <p className="font-display font-bold text-navy-900">Para as famílias verem seu perfil</p>
              <ul className="mt-2 space-y-2">
                {itensDePublicacao(situacao).map((i) => (
                  <li key={i.id} className="flex items-center gap-2.5 text-[15px]">
                    {i.feito
                      ? <span className="grid h-6 w-6 place-items-center rounded-full bg-mint-500 text-white"><Check className="h-4 w-4" /></span>
                      : <Circle className="h-6 w-6 text-navy-300" />}
                    <span className={i.feito ? 'text-navy-800' : 'text-navy-600'}>{i.texto}</span>
                  </li>
                ))}
              </ul>
              <p className={cn('mt-3 rounded-xl p-3 text-sm', perfil.visivel ? 'bg-mint-50 text-mint-800' : 'bg-navy-50 text-navy-700')} role="status">
                {textoDaSituacao(situacao)}
              </p>
              {perfil.local && <p className="mt-2 text-xs text-navy-500">Modo demonstração: o perfil fica só neste aparelho e não aparece na vitrine.</p>}
            </Card>

            <Card className="flex items-start gap-3">
              <RouteIcon className="mt-0.5 h-5 w-5 shrink-0 text-navy-400" />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] text-navy-700" data-testid="rotas-oferecidas">{textoDasRotas(perfil.rotasDisponiveis)}</p>
                <Link to="/app/rotas" className="mt-1 inline-block text-sm font-semibold text-mint-700 underline">Minhas rotas</Link>
              </div>
            </Card>

            <Card>
              <ContatoWhatsapp ativo={perfil.contatoWhatsappAtivo} ocupado={mudandoContato} onAlternar={alternarContato} />
            </Card>

            {erroPub && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{erroPub}</p>}

            {!perfil.suspenso && (
              <button type="button" onClick={alternarPublicacao} disabled={publicando}
                className={cn('flex h-14 w-full items-center justify-center gap-2 rounded-full text-base font-bold transition active:scale-[0.98] disabled:opacity-60',
                  perfil.anuncioAtivo ? 'bg-white text-navy-800 ring-1 ring-navy-200' : 'bg-mint-500 text-white shadow-float')}>
                {publicando ? <Loader2 className="h-5 w-5 animate-spin" /> : perfil.anuncioAtivo ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                {perfil.anuncioAtivo ? 'Ocultar perfil' : 'Publicar perfil'}
              </button>
            )}
            <div className="grid grid-cols-2 gap-2.5">
              <Link to="/app/perfil/editar" className="flex h-12 items-center justify-center gap-2 rounded-full bg-white text-[15px] font-semibold text-navy-800 ring-1 ring-navy-200">
                <Pencil className="h-4 w-4" /> Editar perfil
              </Link>
              {perfil.visivel ? (
                <Link to={`/van/${perfil.slug}`} className="flex h-12 items-center justify-center gap-2 rounded-full bg-white text-[15px] font-semibold text-navy-800 ring-1 ring-navy-200">
                  <ExternalLink className="h-4 w-4" /> Ver perfil público
                </Link>
              ) : (
                <span className="flex h-12 items-center justify-center gap-2 rounded-full bg-navy-50 text-[15px] font-semibold text-navy-400" aria-disabled="true">
                  <ExternalLink className="h-4 w-4" /> Perfil não visível
                </span>
              )}
            </div>
            <p className="inline-flex gap-1.5 pb-2 text-xs text-navy-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              O VanBora não pede envio de documentos e não mostra selo de verificação. Avaliações só aparecem quando forem reais.
            </p>
          </>
        )}
      </div>
    </VMShell>
  );
}

/* ================== Criar / editar perfil — formulário em etapas ================== */
const K_RASCUNHO = 'vanbora.perfil.rascunho.v2';
function lerRascunho(chave: string): RascunhoPerfil | null {
  try {
    const raw = sessionStorage.getItem(K_RASCUNHO);
    const v = raw ? (JSON.parse(raw) as { chave: string; r: RascunhoPerfil }) : null;
    return v && v.chave === chave ? v.r : null;
  } catch { return null; }
}
function gravarRascunho(chave: string, r: RascunhoPerfil) {
  try { sessionStorage.setItem(K_RASCUNHO, JSON.stringify({ chave, r })); } catch { /* sem armazenamento: segue em memória */ }
}
function limparRascunho() {
  try { sessionStorage.removeItem(K_RASCUNHO); } catch { /* ignora */ }
}

export function EditarPerfilProfissionalPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { carregando, erro: erroCarga, perfil, recarregar } = useMeuPerfil();
  const [etapa, setEtapa] = useState<EtapaPerfil>('nome');
  const [r, setR] = useState<RascunhoPerfil | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const titulo = useRef<HTMLHeadingElement>(null);
  const chave = perfil?.id ?? 'novo';

  // Rascunho: o que já foi digitado nesta sessão; senão o perfil salvo; senão a conta.
  useEffect(() => {
    if (carregando || erroCarga || r) return;
    const meta = session?.user?.user_metadata ?? {};
    setR(lerRascunho(chave) ?? rascunhoInicial(perfil, { nome: (meta.full_name || meta.name) as string | undefined, cidadeId: CIDADE_PADRAO.id }));
  }, [carregando, erroCarga, perfil, session, chave, r]);

  useEffect(() => { titulo.current?.focus({ preventScroll: true }); }, [etapa]);

  const indice = ETAPAS_PERFIL.findIndex((e) => e.id === etapa);
  const ultima = indice === ETAPAS_PERFIL.length - 1;
  const mudar = (m: Partial<RascunhoPerfil>) => { setErro(null); setR((atual) => {
    if (!atual) return atual;
    const novo = { ...atual, ...m };
    gravarRascunho(chave, novo);
    return novo;
  }); };
  const irPara = (e: EtapaPerfil) => { setErro(null); setEtapa(e); };
  const voltar = () => (indice > 0 ? irPara(ETAPAS_PERFIL[indice - 1].id) : navigate('/app/perfil'));

  async function continuar() {
    if (!r) return;
    if (!ultima) {
      const problema = validarEtapa(etapa, r);
      if (problema) { setErro(problema); return; }
      irPara(ETAPAS_PERFIL[indice + 1].id);
      return;
    }
    const pendente = primeiraEtapaComProblema(r);
    if (pendente) { setEtapa(pendente.etapa); setErro(pendente.erro); return; }
    setErro(null);
    setSalvando(true);
    try {
      await salvarMeuPerfil(r);
      limparRascunho();
      navigate('/app/perfil', { replace: true });
    } catch (e) {
      setErro((e as Error).message); // falha real aparece; o rascunho continua guardado
    } finally {
      setSalvando(false);
    }
  }

  return (
    <VMShell nav={false} className="pb-0">
      <div className="flex min-h-dvh flex-col">
        <SubHeader
          titulo={perfil ? 'Editar perfil' : 'Criar perfil'}
          onVoltar={voltar}
          acao={<button type="button" onClick={() => navigate('/app/perfil')} className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold">Cancelar</button>}
        />

        {/* Progresso */}
        <div className="px-4 pt-3" aria-label="Progresso">
          <p className="text-sm font-semibold text-navy-600">Etapa {indice + 1} de {ETAPAS_PERFIL.length} · {ETAPAS_PERFIL[indice].nome}</p>
          <div className="mt-1.5 grid grid-cols-4 gap-1.5">
            {ETAPAS_PERFIL.map((e, i) => <span key={e.id} className={cn('h-1.5 rounded-full', i <= indice ? 'bg-mint-500' : 'bg-navy-100')} />)}
          </div>
        </div>

        <main className="flex-1 overflow-y-auto px-4 pb-24 pt-3">
          {carregando && <div className="flex justify-center py-16 text-navy-400"><Loader2 className="h-6 w-6 animate-spin" /></div>}
          {!carregando && erroCarga && <AvisoErro mensagem={erroCarga} onTentar={recarregar} />}

          {r && !erroCarga && (
            <Card className="p-4 sm:p-5">
              {etapa === 'nome' && (
                <Etapa tituloRef={titulo} titulo="Como as famílias vão chamar você?" texto="Pode ser “Tio João”, “Tia Ana” ou só o seu nome.">
                  <label className="field-label" htmlFor="perfil-nome">Nome de apresentação</label>
                  <input id="perfil-nome" className="field-input text-base" value={r.nome} maxLength={NOME_MAX} autoComplete="nickname"
                    placeholder="Ex.: Tio João" onChange={(e) => mudar({ nome: e.target.value })} />
                  <label className="field-label mt-4" htmlFor="perfil-cidade">Cidade onde você atende</label>
                  <select id="perfil-cidade" className="field-input text-base" value={r.cidadeId} onChange={(e) => mudar({ cidadeId: e.target.value })}>
                    {CIDADES.map((c) => <option key={c.id} value={c.id}>{c.nome} — {c.uf}</option>)}
                  </select>
                </Etapa>
              )}

              {etapa === 'apresentacao' && (
                <Etapa tituloRef={titulo} titulo="Conte um pouco sobre você" texto="Opcional. Escreva do seu jeito: há quanto tempo trabalha, onde atende, como cuida dos alunos.">
                  <label className="field-label" htmlFor="perfil-apresentacao">Apresentação (opcional)</label>
                  <textarea id="perfil-apresentacao" className="field-input min-h-[9rem] text-base" rows={6} maxLength={APRESENTACAO_MAX}
                    placeholder={EXEMPLO_APRESENTACAO} value={r.apresentacao} onChange={(e) => mudar({ apresentacao: e.target.value })} />
                  <p className="mt-1 text-right text-xs text-navy-500">{r.apresentacao.length}/{APRESENTACAO_MAX}</p>
                  <p className="text-xs text-navy-500">O texto em cinza é só um exemplo e não será salvo.</p>
                </Etapa>
              )}

              {etapa === 'contato' && (
                <Etapa tituloRef={titulo} titulo="Seu WhatsApp" texto="Obrigatório. Informe o número com DDD.">
                  <label className="field-label" htmlFor="perfil-whatsapp">WhatsApp</label>
                  <input id="perfil-whatsapp" className="field-input text-base" inputMode="tel" autoComplete="tel-national" required
                    placeholder="(18) 99999-0000" value={r.whatsapp} onChange={(e) => mudar({ whatsapp: mascararWhatsapp(e.target.value) })} />
                  <div className="mt-4 border-t border-navy-100 pt-3">
                    <ContatoWhatsapp ativo={r.contatoDireto} onAlternar={() => mudar({ contatoDireto: !r.contatoDireto })} />
                  </div>
                </Etapa>
              )}

              {etapa === 'revisao' && (
                <Etapa tituloRef={titulo} titulo="Confira antes de salvar" texto="Salvar não publica o perfil. Você decide quando publicar.">
                  <dl className="divide-y divide-navy-50">
                    <LinhaRevisao rotulo="Nome" valor={r.nome.trim() || '—'} onAlterar={() => irPara('nome')} />
                    <LinhaRevisao rotulo="Cidade" valor={nomeDaCidade(r.cidadeId)} onAlterar={() => irPara('nome')} />
                    <LinhaRevisao rotulo="Apresentação" valor={r.apresentacao.trim() || 'Sem apresentação'} onAlterar={() => irPara('apresentacao')} />
                    <LinhaRevisao rotulo="WhatsApp" valor={`${r.whatsapp || '—'} · contatos ${r.contatoDireto ? 'ativados' : 'desativados'}`} onAlterar={() => irPara('contato')} />
                  </dl>
                </Etapa>
              )}

              {erro && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{erro}</p>}
            </Card>
          )}
        </main>

        {/* Ações sempre visíveis */}
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-navy-100 bg-white/95 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur">
          <div className="vm-screen grid grid-cols-[1fr_1.6fr] gap-2.5">
            <button type="button" onClick={voltar} className="h-14 rounded-full bg-white text-base font-bold text-navy-800 ring-1 ring-navy-200 active:scale-[0.98]">
              Voltar
            </button>
            <button type="button" onClick={continuar} disabled={!r || salvando || carregando}
              className="flex h-14 items-center justify-center gap-2 rounded-full bg-mint-500 text-base font-bold text-white shadow-float active:scale-[0.98] disabled:opacity-60">
              {salvando ? <><Loader2 className="h-5 w-5 animate-spin" /> Salvando…</> : ultima ? 'Salvar perfil' : 'Continuar'}
            </button>
          </div>
        </div>
      </div>
    </VMShell>
  );
}

/* ------------------------------- auxiliares ------------------------------- */
function Etapa({ titulo, texto, tituloRef, children }: { titulo: string; texto: string; tituloRef: React.RefObject<HTMLHeadingElement>; children: ReactNode }) {
  return (
    <section>
      <h2 ref={tituloRef} tabIndex={-1} className="font-display text-xl font-bold leading-snug text-navy-900 outline-none">{titulo}</h2>
      <p className="mt-1 text-[15px] text-navy-600">{texto}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Permissão de contato pelo WhatsApp: opcional, começa desativada, muda quando quiser. */
function ContatoWhatsapp({ ativo, ocupado = false, onAlternar }: { ativo: boolean; ocupado?: boolean; onAlternar: () => void }) {
  return (
    <section aria-labelledby="titulo-contato-whatsapp">
      <p id="titulo-contato-whatsapp" className="font-display text-[17px] font-bold text-navy-900">Permitir contato pelo WhatsApp</p>
      <p className="mt-0.5 text-[15px] text-navy-600">As famílias poderão entrar em contato com você pelo WhatsApp. Você pode ativar essa opção quando quiser.</p>
      <button type="button" role="switch" aria-checked={ativo} onClick={onAlternar} disabled={ocupado}
        className="mt-2.5 flex min-h-[3.25rem] w-full items-center justify-between gap-3 rounded-2xl bg-white px-4 text-left text-base font-semibold text-navy-900 ring-1 ring-navy-200 active:scale-[0.99] disabled:opacity-60">
        <span className="inline-flex items-center gap-2"><MessageCircle className="h-5 w-5 text-navy-500" /> Receber contatos pelo WhatsApp</span>
        <span aria-hidden="true" className={cn('relative h-7 w-12 shrink-0 rounded-full transition', ativo ? 'bg-mint-500' : 'bg-navy-200')}>
          <span className={cn('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all', ativo ? 'left-[1.375rem]' : 'left-0.5')} />
        </span>
      </button>
      <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-navy-600"><Lock className="h-4 w-4 shrink-0" /> Seu número não será exibido publicamente.</p>
    </section>
  );
}

function LinhaRevisao({ rotulo, valor, onAlterar }: { rotulo: string; valor: string; onAlterar: () => void }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-semibold uppercase tracking-wide text-navy-500">{rotulo}</dt>
        <dd className="mt-0.5 line-clamp-2 break-words text-[15px] text-navy-900">{valor}</dd>
      </div>
      <button type="button" onClick={onAlterar} className="shrink-0 rounded-full px-3 py-2 text-sm font-semibold text-mint-700 ring-1 ring-mint-200">Alterar</button>
    </div>
  );
}
