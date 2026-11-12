import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import {
  CAMPO_ISCA, DADOS_VAZIOS, ORDEM_CAMPOS, PERIODOS, TIPOS_TRANSPORTE, ROTAS_PRE_LANCAMENTO, CIDADE_LANCAMENTO,
  mascararWhatsApp, validarInteresse,
  type CampoInteresse, type DadosInteresse, type ErrosInteresse, type TipoInteresse,
} from '@/lib/interesse';
import { enviarInteresse } from '@/lib/interesse-cliente';
import { useVitrine } from '@/data/VitrineProvider';
import { PaginaPublica } from './PaginaPublica';

const TEXTOS: Record<TipoInteresse, {
  titulo: string; descricao: string; subtitulo?: string; rotuloNome: string; botao: string;
  consentimento: ReactNode; confirmacao: string;
}> = {
  motorista: {
    titulo: 'Motorista, o VanBora está chegando!',
    descricao: 'Em breve, você poderá cadastrar gratuitamente sua van e suas rotas para ser encontrado por famílias que procuram transporte escolar.',
    subtitulo: 'Deixe seu contato e seja avisado quando o cadastro estiver disponível.',
    rotuloNome: 'Nome completo',
    botao: 'Quero ser avisado',
    consentimento: <>Concordo em fornecer meus dados ao VanBora para receber informações sobre o lançamento e o futuro cadastro pelo WhatsApp ou e-mail informado. Li a <LinkPolitica />.</>,
    confirmacao: 'Obrigado por querer fazer parte do VanBora! Quando o cadastro de vans e rotas estiver disponível, nossa equipe poderá entrar em contato pelo WhatsApp ou e-mail informado.',
  },
  familia: {
    titulo: 'Procurando transporte escolar?',
    descricao: 'O VanBora está chegando a Araçatuba! Conte para nós o que você precisa e deixe seu contato para receber novidades sobre a disponibilidade do serviço.',
    rotuloNome: 'Nome completo do responsável',
    botao: 'Registrar meu interesse',
    consentimento: <>Concordo em fornecer meus dados (contato, endereço de embarque, escola e período) ao VanBora para registrar meu interesse em transporte escolar e receber novidades sobre a disponibilidade do serviço pelo WhatsApp ou e-mail informado. Li a <LinkPolitica />.</>,
    confirmacao: 'Obrigado pelo interesse! Estamos preparando o VanBora para Araçatuba. Nossa equipe poderá entrar em contato pelo WhatsApp ou e-mail informado quando tivermos novidades.',
  },
};

function LinkPolitica() {
  return (
    <Link to={ROTAS_PRE_LANCAMENTO.privacidade} target="_blank" rel="noopener" className="font-semibold underline underline-offset-2">
      Política de Privacidade
    </Link>
  );
}

/**
 * Formulário de interesse (motorista ou família) + tela de confirmação.
 * A confirmação só aparece depois de o servidor confirmar a gravação; em caso
 * de erro os dados digitados permanecem na tela para nova tentativa.
 */
export function FormularioInteresse({ tipo }: { tipo: TipoInteresse }) {
  const t = TEXTOS[tipo];
  const familia = tipo === 'familia';
  const uid = useId();
  const id = (campo: string) => `${uid}-${campo}`;

  const [dados, setDados] = useState<DadosInteresse>(DADOS_VAZIOS);
  const [erros, setErros] = useState<ErrosInteresse>({});
  const [isca, setIsca] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const [concluido, setConcluido] = useState(false);
  const formulario = useRef<HTMLFormElement>(null);
  const tituloSucesso = useRef<HTMLHeadingElement>(null);
  const avisoFalha = useRef<HTMLDivElement>(null);

  // Sugestões de escolas do cadastro existente (digitação livre continua valendo).
  const { destinos } = useVitrine();
  const escolas = useMemo(
    () => (familia ? [...new Set(destinos.filter((d) => d.tipo === 'escola').map((d) => d.nome))].sort((a, b) => a.localeCompare(b, 'pt-BR')) : []),
    [destinos, familia],
  );

  useEffect(() => { document.title = `${t.titulo} — VanBora`; }, [t.titulo]);
  useEffect(() => {
    if (!concluido) return;
    window.scrollTo(0, 0);
    tituloSucesso.current?.focus();
  }, [concluido]);

  function mudar<C extends CampoInteresse>(campo: C, valor: DadosInteresse[C]) {
    setDados((d) => ({ ...d, [campo]: valor }));
    if (erros[campo]) setErros((e) => ({ ...e, [campo]: undefined }));
  }

  function focarPrimeiroErro(e: ErrosInteresse) {
    const primeiro = ORDEM_CAMPOS.find((c) => e[c]);
    if (!primeiro) return;
    const alvo = formulario.current?.querySelector<HTMLElement>(`[data-campo="${primeiro}"]`);
    alvo?.focus();
    alvo?.scrollIntoView({ block: 'center' });
  }

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    if (enviando) return; // evita envio duplo
    setFalha(null);

    const v = validarInteresse(tipo, dados);
    if (!v.ok) { setErros(v.erros); focarPrimeiroErro(v.erros); return; }
    setErros({});

    setEnviando(true);
    const r = await enviarInteresse(tipo, dados, isca);
    setEnviando(false);

    if (r.ok) { setConcluido(true); return; }
    if (r.motivo === 'validacao' && r.campos && Object.keys(r.campos).length > 0) {
      setErros(r.campos);
      focarPrimeiroErro(r.campos);
    }
    setFalha(r.mensagem);
    requestAnimationFrame(() => avisoFalha.current?.focus());
  }

  if (concluido) {
    return (
      <PaginaPublica>
        <section className="mx-auto w-full max-w-xl px-5 py-10 sm:py-14">
          <div className="rounded-3xl bg-white p-7 text-center shadow-[0_10px_30px_rgb(0_0_0/0.08)] ring-1 ring-black/5 sm:p-10">
            <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#FFC700]">
              <CheckCircle2 className="h-11 w-11 text-black" aria-hidden="true" />
            </span>
            <h1 ref={tituloSucesso} tabIndex={-1} className="mt-6 font-display text-2xl font-extrabold leading-tight tracking-tight outline-none sm:text-3xl">
              Prontinho! Seu interesse foi registrado.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-neutral-700">{t.confirmacao}</p>
            <p className="mt-6 font-semibold">VanBora — Mais vagas, mais conexões.</p>
            <Link to={ROTAS_PRE_LANCAMENTO.inicio} className="mt-7 inline-flex min-h-14 w-full items-center justify-center rounded-full bg-black px-6 text-base font-bold text-white hover:bg-neutral-800 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FFC700]">
              Voltar ao início
            </Link>
          </div>
        </section>
      </PaginaPublica>
    );
  }

  const entrada = 'h-14 w-full rounded-2xl border bg-white px-4 text-base text-black placeholder:text-neutral-400 focus:outline-none focus:ring-4 focus:ring-[#FFC700]/40 disabled:bg-neutral-100';
  const borda = (campo: CampoInteresse) => (erros[campo] ? 'border-red-600 focus:border-red-600' : 'border-neutral-300 focus:border-black');
  const aria = (campo: CampoInteresse, ajuda?: boolean) => ({
    'data-campo': campo,
    'aria-invalid': erros[campo] ? true : undefined,
    'aria-describedby': [erros[campo] ? id(`${campo}-erro`) : '', ajuda ? id(`${campo}-ajuda`) : ''].filter(Boolean).join(' ') || undefined,
  });
  const Erro = ({ campo }: { campo: CampoInteresse }) => erros[campo]
    ? <p id={id(`${campo}-erro`)} className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{erros[campo]}</p>
    : null;
  const rotulo = 'mb-1.5 block text-sm font-bold text-black';
  const opcional = <span className="font-normal text-neutral-500"> (opcional)</span>;

  return (
    <PaginaPublica voltar>
      <section className="mx-auto w-full max-w-xl px-5 py-8 sm:py-12">
        <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{t.titulo}</h1>
        <p className="mt-3 text-base leading-relaxed text-neutral-700">{t.descricao}</p>
        {t.subtitulo && <p className="mt-3 text-base font-semibold leading-relaxed">{t.subtitulo}</p>}

        <form ref={formulario} onSubmit={aoEnviar} noValidate aria-busy={enviando} className="mt-7 rounded-3xl bg-white p-5 shadow-[0_10px_30px_rgb(0_0_0/0.08)] ring-1 ring-black/5 sm:p-7">
          <p className="text-sm text-neutral-600">Campos sem a indicação “opcional” são obrigatórios.</p>

          <div className="mt-5 space-y-5">
            <div>
              <label htmlFor={id('nome')} className={rotulo}>{t.rotuloNome}</label>
              <input id={id('nome')} name="nome" type="text" autoComplete="name" autoCapitalize="words" maxLength={120} required
                value={dados.nome} onChange={(e) => mudar('nome', e.target.value)} disabled={enviando}
                className={`${entrada} ${borda('nome')}`} {...aria('nome')} />
              <Erro campo="nome" />
            </div>

            <div>
              <label htmlFor={id('whatsapp')} className={rotulo}>WhatsApp</label>
              <input id={id('whatsapp')} name="whatsapp" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="(18) 99999-9999" maxLength={20} required
                value={dados.whatsapp} onChange={(e) => mudar('whatsapp', mascararWhatsApp(e.target.value))} disabled={enviando}
                className={`${entrada} ${borda('whatsapp')}`} {...aria('whatsapp', true)} />
              <p id={id('whatsapp-ajuda')} className="mt-1.5 text-sm text-neutral-600">Celular com DDD.</p>
              <Erro campo="whatsapp" />
            </div>

            <div>
              <label htmlFor={id('email')} className={rotulo}>E-mail{opcional}</label>
              <input id={id('email')} name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={254} placeholder="voce@exemplo.com"
                value={dados.email} onChange={(e) => mudar('email', e.target.value)} disabled={enviando}
                className={`${entrada} ${borda('email')}`} {...aria('email')} />
              <Erro campo="email" />
            </div>

            {familia && (
              <>
                <fieldset className="space-y-5 border-t border-neutral-200 pt-5">
                  <legend className="float-left mb-1 w-full font-display text-lg font-extrabold">Endereço de embarque</legend>
                  <p className="clear-both text-sm text-neutral-600">Onde a criança precisará ser buscada, em {CIDADE_LANCAMENTO.cidade}/{CIDADE_LANCAMENTO.uf}.</p>

                  <div>
                    <label htmlFor={id('rua')} className={rotulo}>Rua ou avenida</label>
                    <input id={id('rua')} name="rua" type="text" autoComplete="address-line1" maxLength={120} required
                      value={dados.rua} onChange={(e) => mudar('rua', e.target.value)} disabled={enviando}
                      className={`${entrada} ${borda('rua')}`} {...aria('rua')} />
                    <Erro campo="rua" />
                  </div>

                  <div className="grid grid-cols-[7.5rem_1fr] gap-3">
                    <div>
                      <label htmlFor={id('numero')} className={rotulo}>Número</label>
                      <input id={id('numero')} name="numero" type="text" inputMode="text" autoComplete="off" maxLength={8} required
                        value={dados.numero} onChange={(e) => mudar('numero', e.target.value)} disabled={enviando}
                        className={`${entrada} ${borda('numero')}`} {...aria('numero')} />
                    </div>
                    <div>
                      <label htmlFor={id('bairro')} className={rotulo}>Bairro</label>
                      <input id={id('bairro')} name="bairro" type="text" autoComplete="address-level3" maxLength={80} required
                        value={dados.bairro} onChange={(e) => mudar('bairro', e.target.value)} disabled={enviando}
                        className={`${entrada} ${borda('bairro')}`} {...aria('bairro')} />
                    </div>
                    <div className="col-span-2 -mt-1.5 empty:hidden"><Erro campo="numero" /><Erro campo="bairro" /></div>
                  </div>

                  <div>
                    <label htmlFor={id('complemento')} className={rotulo}>Complemento{opcional}</label>
                    <input id={id('complemento')} name="complemento" type="text" autoComplete="address-line2" maxLength={80} placeholder="Apto, bloco, ponto de referência"
                      value={dados.complemento} onChange={(e) => mudar('complemento', e.target.value)} disabled={enviando}
                      className={`${entrada} ${borda('complemento')}`} {...aria('complemento')} />
                    <Erro campo="complemento" />
                  </div>
                </fieldset>

                <div className="space-y-5 border-t border-neutral-200 pt-5">
                  <div>
                    <label htmlFor={id('escola')} className={rotulo}>Escola de destino</label>
                    <input id={id('escola')} name="escola" type="text" autoComplete="off" list={escolas.length ? id('escolas') : undefined} maxLength={120} required
                      value={dados.escola} onChange={(e) => mudar('escola', e.target.value)} disabled={enviando}
                      className={`${entrada} ${borda('escola')}`} {...aria('escola', true)} />
                    {escolas.length > 0 && <datalist id={id('escolas')}>{escolas.map((n) => <option key={n} value={n} />)}</datalist>}
                    <p id={id('escola-ajuda')} className="mt-1.5 text-sm text-neutral-600">Digite o nome da escola. Se ela não aparecer nas sugestões, escreva normalmente.</p>
                    <Erro campo="escola" />
                  </div>

                  <fieldset>
                    <legend className={rotulo}>Período</legend>
                    <div className="grid grid-cols-3 gap-2" role="presentation">
                      {PERIODOS.map((p, i) => (
                        <label key={p.valor} className={`flex min-h-14 cursor-pointer items-center justify-center rounded-2xl border text-base font-bold transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-[#FFC700]/60 ${dados.periodo === p.valor ? 'border-black bg-[#FFC700] text-black' : `bg-white text-black ${erros.periodo ? 'border-red-600' : 'border-neutral-300'}`}`}>
                          <input type="radio" name="periodo" value={p.valor} className="sr-only" required disabled={enviando}
                            checked={dados.periodo === p.valor} onChange={() => mudar('periodo', p.valor)}
                            {...(i === 0 ? aria('periodo') : { 'aria-describedby': erros.periodo ? id('periodo-erro') : undefined })} />
                          {p.rotulo}
                        </label>
                      ))}
                    </div>
                    <Erro campo="periodo" />
                  </fieldset>

                  <div>
                    <label htmlFor={id('transporte')} className={rotulo}>Tipo de transporte{opcional}</label>
                    <select id={id('transporte')} name="transporte" value={dados.transporte} onChange={(e) => mudar('transporte', e.target.value)} disabled={enviando}
                      className={`${entrada} ${borda('transporte')} appearance-auto`} {...aria('transporte')}>
                      <option value="">Ainda não sei</option>
                      {TIPOS_TRANSPORTE.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
                    </select>
                    <Erro campo="transporte" />
                  </div>
                </div>
              </>
            )}

            {/* Campo-isca contra robôs: fora da tela, fora da tabulação e dos leitores de tela. */}
            <div aria-hidden="true" className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden opacity-0">
              <label>Não preencha este campo
                <input type="text" name={CAMPO_ISCA} tabIndex={-1} autoComplete="off" value={isca} onChange={(e) => setIsca(e.target.value)} />
              </label>
            </div>

            <div className="border-t border-neutral-200 pt-5">
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" name="consentimento" required disabled={enviando}
                  checked={dados.consentimento} onChange={(e) => mudar('consentimento', e.target.checked)}
                  className={`mt-0.5 h-7 w-7 shrink-0 cursor-pointer rounded-md border-2 accent-black focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#FFC700] ${erros.consentimento ? 'outline outline-2 outline-red-600' : ''}`}
                  {...aria('consentimento')} />
                <span className="text-sm leading-relaxed text-neutral-800">{t.consentimento}</span>
              </label>
              <Erro campo="consentimento" />
            </div>
          </div>

          {falha && (
            <div ref={avisoFalha} role="alert" tabIndex={-1} className="mt-5 flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium leading-relaxed text-red-800 outline-none">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <span>{falha}</span>
            </div>
          )}

          <button type="submit" disabled={enviando}
            className="mt-6 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[#FFC700] px-6 text-base font-bold text-black transition-colors hover:bg-[#E6B300] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-black disabled:cursor-not-allowed disabled:opacity-70">
            {enviando ? <><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Enviando…</> : t.botao}
          </button>
          <p className="mt-3 text-center text-xs leading-relaxed text-neutral-500">
            Este cadastro é apenas uma manifestação de interesse. O aplicativo ainda não foi lançado.
          </p>
        </form>
      </section>
    </PaginaPublica>
  );
}

export function InteresseMotoristaPage() { return <FormularioInteresse tipo="motorista" />; }
export function InteresseFamiliaPage() { return <FormularioInteresse tipo="familia" />; }
