import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Bus, Check, CheckCircle2, ChevronRight, Clock, Flag,
  GraduationCap, Home, Loader2, MapPin, Pencil, Plus, Save, Trash2, User, UserPlus, Users, X,
} from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { MapaInterativoRota, type RascunhoNoMapa } from '@/components/motorista/MapaInterativoRota';
import { PlanoMotor } from '@/components/motorista/PlanoMotor';
import { CampoEndereco } from '@/components/search/CampoEndereco';
import {
  CampoDuracao, CampoHora, CampoMinutos, CamposDaVisita, EscolasDisponiveis, PeriodoEscolar, type DestinoCatalogo,
} from '@/components/motorista/CadastroRotaEtapa1';
import { listarEscolasGeraisDoMotorista, listarVeiculos, novoId, obterRota, salvarRota } from '@/data/motorista-store';
import { useVitrine } from '@/data/VitrineProvider';
import { DIA_LABEL, DIAS_SEMANA, horaDoCampo, pendenciasDeRevisao, textoDuracao } from '@/lib/cadastro-rota';
import {
  adicionarAluno, adicionarEscola, alunosDaCasa, atualizarAluno, atualizarEscola, candidatosADescer, casaDoAluno, definirSaida,
  escolaParadaDoAluno, escolasDaRota, excluirParada, moverParada, podeMover, removerAlunoDaRota,
} from '@/lib/edicao-rota';
import { ENDERECO_VAZIO, type Coord, type EnderecoCampo } from '@/lib/endereco';
import { locaisDeDestinos, type SugestaoEndereco } from '@/lib/geocode';
import { capacidadeAlunos, picoOcupacao, podeFinalizar, validarRota } from '@/lib/ocupacao-rota';
import { planejarRotaDoCadastro } from '@/lib/rota-para-motor';
import { USE_SUPABASE } from '@/lib/supabase';
import { useAlturaVisivel } from '@/lib/useAlturaVisivel';
import { cn, nomeDestinoParaExibicao } from '@/lib/utils';
import { VEICULO_CENARIO } from '@/lib/vm/cenario';
import type { ParadaRota, Rota, Veiculo } from '@/types/motorista';

/**
 * CONSTRUTOR DE ROTAS — cadastro guiado, direto no mapa.
 *
 * Só a INTERFACE mora aqui. Toda regra continua onde sempre esteve:
 *  - edição da rota ........ `lib/edicao-rota`
 *  - ocupação e validação .. `lib/ocupacao-rota`
 *  - horários previstos .... `lib/rota-para-motor` (motor real)
 *  - o que falta informar .. `lib/cadastro-rota`
 *  - gravação .............. `data/motorista-store` (RPC transacional)
 *
 * Tela de altura fixa: o MAPA fica sempre à vista, o painel do meio mostra só
 * o cadastro atual e o rodapé traz a ação principal do momento.
 */

type Etapa = 'dados' | 'paradas' | 'escolas' | 'revisao';
const ETAPAS: { id: Etapa; nome: string }[] = [
  { id: 'dados', nome: 'Dados' }, { id: 'paradas', nome: 'Paradas' }, { id: 'escolas', nome: 'Escolas' }, { id: 'revisao', nome: 'Revisão' },
];

type Painel =
  | { tipo: 'lista' }
  | { tipo: 'aluno'; alunoId?: string; naCasaId?: string }
  | { tipo: 'escola'; paradaId?: string }
  | { tipo: 'casa'; paradaId: string };

/** O que o formulário ativo mostra no mapa (alfinete arrastável). */
interface PontoNoMapa { tipo: RascunhoNoMapa['tipo']; ponto: Coord | null; ocultarId?: string | null; aoMover: (lat: number, lng: number) => void }

export function rotaNova(): Rota {
  return {
    // Período escolar, horários e autorizações nascem "não informados": o
    // motorista confirma (o app só sugere), nada é presumido.
    id: '', nome: '', sentido: 'ida', turno: null, periodoConfirmado: false, dias: ['seg', 'ter', 'qua', 'qui', 'sex'],
    veiculoId: null, monitor: false, monitorOcupaLugar: false, lugaresReservados: 0,
    ultimoDesembarqueMin: null, saidaHabitualMin: null, limiteAntecipacaoMin: null, status: 'rascunho',
    paradas: [], passageiros: [], escolasDisponiveis: [], disponibilidadeRevisada: false, atualizadoEm: new Date().toISOString(),
  };
}

const emOrdem = (r: Rota) => [...r.paradas].sort((a, b) => a.ordem - b.ordem);
const temPonto = (p: { lat?: number; lng?: number }) => typeof p.lat === 'number' && typeof p.lng === 'number';
/** Endereço já salvo: vale o ponto gravado (não é procurado de novo no mapa). */
const enderecoSalvo = (p?: ParadaRota | null): EnderecoCampo =>
  p ? { texto: p.rotulo, coord: temPonto(p) ? { lat: p.lat!, lng: p.lng! } : null, precisao: temPonto(p) ? 'ajustado' : undefined, validando: false } : ENDERECO_VAZIO;
const listar = (nomes: string[]) => (nomes.length <= 1 ? nomes.join('') : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`);

export function ConstrutorRota({ voltarPara = '/painel/rotas' }: { voltarPara?: string }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { destinos } = useVitrine();
  const { altura, tecladoAberto } = useAlturaVisivel();

  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [rota, setRota] = useState<Rota>(rotaNova());
  const [etapa, setEtapa] = useState<Etapa>('dados');
  const [painel, setPainel] = useState<Painel>({ tipo: 'lista' });
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<null | Rota['status']>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [listaGeral, setListaGeral] = useState<string[]>([]);
  const [noMapa, setNoMapa] = useState<PontoNoMapa | null>(null);
  const editando = !!id && id !== 'nova';

  // Lista geral de escolas do motorista: só SUGERE o preenchimento por rota.
  useEffect(() => {
    let vivo = true;
    listarEscolasGeraisDoMotorista().then((ids) => { if (vivo) setListaGeral(ids); });
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      // Van recebida do fluxo de cadastro de van (handoff), reaproveitada sem persistir aqui.
      const vanRecebida = (location.state as { veiculo?: Veiculo } | null)?.veiculo ?? null;
      const reais = await listarVeiculos().catch(() => [] as Veiculo[]);
      let lista = vanRecebida && !reais.some((v) => v.id === vanRecebida.id) ? [vanRecebida, ...reais] : reais;
      // A van de exemplo (id não-UUID) só entra SEM banco; com banco, o salvamento exigiria UUID.
      if (lista.length === 0 && !USE_SUPABASE) lista = [VEICULO_CENARIO];
      let r = rotaNova();
      if (editando) {
        // Editar uma rota que não carregou abriria um formulário em branco e
        // salvaria uma rota NOVA por cima da intenção do motorista: melhor parar.
        try {
          const existente = await obterRota(id!);
          if (!existente) { if (vivo) { setErroCarga('Rota não encontrada na sua conta.'); setCarregando(false); } return; }
          r = existente;
        } catch (e) {
          if (vivo) { setErroCarga('Não foi possível carregar a rota: ' + (e as Error).message); setCarregando(false); }
          return;
        }
      }
      if (!r.veiculoId) r.veiculoId = vanRecebida?.id ?? (lista.length === 1 ? lista[0].id : null);
      if (vivo) {
        setVeiculos(lista); setRota(r);
        setEtapa(r.paradas.some((p) => p.tipo === 'saida') ? 'paradas' : 'dados');
        setCarregando(false);
      }
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Abriu um cadastro: a confirmação anterior sai da frente do mapa.
  useEffect(() => { if (painel.tipo !== 'lista') setAviso(null); }, [painel.tipo]);

  // Confirmação visual curta depois de cada ação.
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 3200);
    return () => clearTimeout(t);
  }, [aviso]);

  const veiculo = useMemo(() => veiculos.find((v) => v.id === rota.veiculoId) ?? null, [veiculos, rota.veiculoId]);
  const paradas = useMemo(() => emOrdem(rota), [rota]);
  const saida = paradas.find((p) => p.tipo === 'saida') ?? null;
  const locaisBusca = useMemo(() => locaisDeDestinos(destinos), [destinos]);
  const destinoPorId = useMemo(() => new Map(destinos.map((d) => [d.id, d])), [destinos]);
  const nomeEscola = useCallback((p: ParadaRota) => nomeDestinoParaExibicao((p.destinoId && destinoPorId.get(p.destinoId)?.nome) || p.destinoNome || p.rotulo || 'Escola'), [destinoPorId]);
  const planejamento = useMemo(() => planejarRotaDoCadastro(rota, veiculo), [rota, veiculo]);
  const previstoPorId = useMemo(() => new Map((planejamento.plano?.valido ? planejamento.plano.paradas : []).map((p) => [p.id, p.chegada])), [planejamento]);

  // Nome curto ao lado de cada marcador (só no app do motorista).
  const rotulos = useMemo(() => {
    const out: Record<string, string> = {};
    for (const p of paradas) {
      if (p.tipo === 'casa') { const nomes = alunosDaCasa(rota, p.id).map((x) => x.identificacao).filter(Boolean); if (nomes.length) out[p.id] = listar(nomes); }
      else if (p.tipo === 'escola') out[p.id] = nomeEscola(p);
    }
    return out;
  }, [paradas, rota, nomeEscola]);

  // Minutos de cada trecho a partir do trajeto real do mapa (como sempre foi).
  const aplicarTempos = useCallback((temposMin: number[]) => {
    setRota((prev) => {
      const ordenadas = emOrdem(prev);
      if (ordenadas.length !== temposMin.length + 1) return prev;
      let mudou = false;
      const novas = ordenadas.map((p, i) => {
        const t = i < temposMin.length ? temposMin[i] : null;
        if (p.tempoAteProximaMin !== t) mudou = true;
        return { ...p, tempoAteProximaMin: t };
      });
      return mudou ? { ...prev, paradas: novas } : prev;
    });
  }, []);

  async function salvar(status: Rota['status']) {
    setSalvando(status); setErro(null);
    try {
      const nome = rota.nome.trim() || `Rota ${rota.sentido === 'ida' ? 'de ida' : 'de volta'}`;
      const salva = await salvarRota({ ...rota, nome, status });
      setRota(salva);
      if (status === 'concluida') {
        // Ida concluída: o app já oferece montar a volta a partir dela.
        navigate(salva.sentido === 'ida' && salva.passageiros.length > 0 ? `/app/rotas/${salva.id}/volta` : voltarPara);
      } else {
        setAviso('Rascunho salvo. Você pode continuar depois.');
      }
    } catch (e) {
      setErro('Não foi possível salvar: ' + (e as Error).message);
    } finally {
      setSalvando(null);
    }
  }

  const fecharPainel = (mensagem?: string) => { setPainel({ tipo: 'lista' }); setNoMapa(null); if (mensagem) setAviso(mensagem); };
  const abrirParada = (paradaId: string) => {
    const p = rota.paradas.find((x) => x.id === paradaId);
    if (!p) return;
    if (p.tipo === 'saida') { setPainel({ tipo: 'lista' }); setEtapa('dados'); }
    else if (p.tipo === 'escola') setPainel({ tipo: 'escola', paradaId });
    else setPainel({ tipo: 'casa', paradaId });
  };
  const irPara = (e: Etapa) => { setPainel({ tipo: 'lista' }); setNoMapa(null); setErro(null); setEtapa(e); };
  function voltar() {
    if (painel.tipo !== 'lista') return fecharPainel();
    const i = ETAPAS.findIndex((e) => e.id === etapa);
    if (i > 0) irPara(ETAPAS[i - 1].id); else navigate(voltarPara);
  }

  if (erroCarga || carregando) {
    return (
      <div className="flex min-h-dvh flex-col bg-neutral-50">
        <Topo onVoltar={() => navigate(voltarPara)} titulo={editando ? 'Editar rota' : 'Nova rota'} />
        {erroCarga
          ? <p role="alert" className="m-4 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700">{erroCarga}</p>
          : <div className="flex flex-1 items-center justify-center text-neutral-400"><Loader2 className="h-7 w-7 animate-spin" /></div>}
      </div>
    );
  }

  if (veiculos.length === 0) {
    return (
      <div className="flex min-h-dvh flex-col bg-neutral-50">
        <Topo onVoltar={() => navigate(voltarPara)} titulo="Nova rota" />
        <div className="m-4 rounded-3xl bg-white p-6 text-center shadow-card ring-1 ring-black/5">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-mint-400 text-black"><Bus className="h-7 w-7" /></span>
          <h2 className="mt-3 font-display text-xl font-extrabold">Cadastre sua van primeiro</h2>
          <p className="mt-1 text-neutral-600">Para montar a rota, precisamos saber quantos lugares sua van tem.</p>
          <button className="btn btn-lg btn-primary mt-5 w-full" onClick={() => navigate('/app/van/cadastro')}>Cadastrar van</button>
        </div>
      </div>
    );
  }

  const indice = ETAPAS.findIndex((e) => e.id === etapa);
  const comum = { rota, setRota, novoId };
  const alturaMapa = tecladoAberto ? 'h-28' : painel.tipo === 'lista' && etapa === 'revisao' ? 'h-[26%]' : 'h-[32%]';

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-neutral-100" style={altura ? { height: altura } : undefined} data-testid="construtor-rota">
      <Topo onVoltar={voltar} titulo={editando ? 'Editar rota' : 'Nova rota'}
        acao={saida && (
          <button type="button" onClick={() => salvar('rascunho')} disabled={salvando !== null} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white/10 px-3.5 text-sm font-bold text-white ring-1 ring-white/20 transition active:scale-95 disabled:opacity-60">
            {salvando === 'rascunho' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
          </button>
        )} />
      {!tecladoAberto && <Passos atual={indice} liberado={!!saida} onIr={(i) => irPara(ETAPAS[i].id)} />}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* MAPA — sempre visível */}
        <section className={cn('relative shrink-0 bg-neutral-200 transition-[height] duration-200 lg:h-auto lg:flex-1', alturaMapa)} aria-label="Mapa da rota">
          <MapaInterativoRota
            bare paradas={rota.paradas} onTempos={aplicarTempos} rotulos={rotulos}
            rascunho={noMapa?.ponto ? { ...noMapa.ponto, tipo: noMapa.tipo } : null}
            onMoverRascunho={noMapa?.aoMover} ocultarId={noMapa?.ocultarId ?? null}
            onTocarParada={painel.tipo === 'lista' ? abrirParada : undefined}
          />
          {noMapa && (
            <p className="pointer-events-none absolute left-14 top-2 z-[500] max-w-[calc(100%-4rem)] truncate rounded-full bg-black/85 px-3 py-1.5 text-[11px] font-semibold text-white shadow-lg">
              {noMapa.ponto ? 'Confira o alfinete — arraste para corrigir' : 'Toque no mapa para marcar o ponto'}
            </p>
          )}
          {aviso && (
            <p role="status" className="pointer-events-none absolute inset-x-3 bottom-3 z-[600] flex items-center justify-center gap-2 rounded-2xl bg-black px-4 py-2.5 text-center text-sm font-bold text-mint-400 shadow-xl">
              <CheckCircle2 className="h-5 w-5 shrink-0" /> {aviso}
            </p>
          )}
        </section>

        {/* PAINEL — só o cadastro atual */}
        <section className="flex min-h-0 flex-1 flex-col rounded-t-3xl bg-white shadow-[0_-8px_24px_-12px_rgba(0,0,0,.25)] lg:max-w-md lg:rounded-none" aria-live="polite">
          {erro && <p role="alert" className="mx-4 mt-3 rounded-2xl bg-red-50 p-3 text-sm font-medium text-red-700">{erro}</p>}
          {painel.tipo === 'aluno' ? (
            <FormAluno key={painel.alunoId ?? `novo-${painel.naCasaId ?? ''}`} {...comum} alunoId={painel.alunoId} naCasaId={painel.naCasaId} locais={locaisBusca} nomeEscola={nomeEscola}
              setNoMapa={setNoMapa} onFechar={fecharPainel} />
          ) : painel.tipo === 'escola' ? (
            <FormEscola key={painel.paradaId ?? 'nova'} {...comum} paradaId={painel.paradaId} destinos={destinos} setNoMapa={setNoMapa} onFechar={fecharPainel} />
          ) : painel.tipo === 'casa' ? (
            <PainelCasa {...comum} paradaId={painel.paradaId} previsto={previstoPorId.get(painel.paradaId)} onAluno={(alunoId) => setPainel({ tipo: 'aluno', alunoId })}
              onOutroAluno={() => setPainel({ tipo: 'aluno', naCasaId: painel.paradaId })} onFechar={fecharPainel} />
          ) : etapa === 'dados' ? (
            <EtapaDados {...comum} veiculos={veiculos} veiculo={veiculo} locais={locaisBusca} saida={saida} setNoMapa={setNoMapa}
              onContinuar={() => { setNoMapa(null); setEtapa('paradas'); setAviso('Saída da van marcada no mapa.'); }} />
          ) : etapa === 'paradas' ? (
            <EtapaParadas rota={rota} paradas={paradas} veiculo={veiculo} previsto={previstoPorId} nomeEscola={nomeEscola}
              onAbrir={abrirParada} onAluno={() => setPainel({ tipo: 'aluno' })} onEscola={() => setPainel({ tipo: 'escola' })} onContinuar={() => irPara('escolas')} />
          ) : etapa === 'escolas' ? (
            <EtapaEscolas rota={rota} setRota={setRota} paradas={paradas} destinos={destinos} listaGeral={listaGeral} nomeEscola={nomeEscola}
              onAbrir={abrirParada} onNova={() => setPainel({ tipo: 'escola' })} onContinuar={() => irPara('revisao')} />
          ) : (
            <EtapaRevisao rota={rota} setRota={setRota} paradas={paradas} veiculo={veiculo} destinos={destinos} nomeEscola={nomeEscola} previsto={previstoPorId}
              planejamento={planejamento} salvando={salvando} onAbrir={abrirParada} onAluno={(alunoId) => setPainel({ tipo: 'aluno', alunoId })} onIr={irPara}
              onConcluir={() => salvar('concluida')} onRascunho={() => salvar('rascunho')} />
          )}
        </section>
      </div>
    </div>
  );
}

/* =============================== moldura =============================== */

function Topo({ onVoltar, titulo, acao }: { onVoltar: () => void; titulo: string; acao?: ReactNode }) {
  return (
    <header className="flex shrink-0 items-center gap-2 bg-black px-3 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] text-white">
      <button type="button" onClick={onVoltar} aria-label="Voltar" className="grid h-11 w-11 shrink-0 place-items-center rounded-full transition active:scale-90 active:bg-white/10"><ArrowLeft className="h-6 w-6" /></button>
      <Logo altura="h-7" className="!bg-transparent !p-0" />
      <h1 className="ml-1 min-w-0 flex-1 truncate text-right font-display text-sm font-extrabold text-mint-400">{titulo}</h1>
      {acao}
    </header>
  );
}

function Passos({ atual, liberado, onIr }: { atual: number; liberado: boolean; onIr: (i: number) => void }) {
  return (
    <nav aria-label="Etapas do cadastro" className="flex shrink-0 items-start justify-between bg-mint-400 px-4 pb-2 pt-2.5">
      {ETAPAS.map((e, i) => {
        const feito = i < atual, ativo = i === atual;
        return (
          <div key={e.id} className="flex flex-1 items-start last:flex-none">
            <button type="button" disabled={!liberado && i > 0} onClick={() => onIr(i)} aria-current={ativo ? 'step' : undefined}
              className="flex w-14 flex-col items-center gap-0.5 disabled:opacity-50">
              <span className={cn('grid h-8 w-8 place-items-center rounded-full text-sm font-extrabold transition',
                ativo ? 'bg-black text-mint-400 ring-4 ring-black/15' : feito ? 'bg-black text-white' : 'bg-white/70 text-black/60')}>
                {feito ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
              </span>
              <span className={cn('text-[11px] leading-tight text-black', ativo ? 'font-extrabold' : 'font-semibold opacity-70')}>{e.nome}</span>
            </button>
            {i < ETAPAS.length - 1 && <span className={cn('mt-4 h-0.5 flex-1 rounded', feito ? 'bg-black' : 'bg-black/20')} />}
          </div>
        );
      })}
    </nav>
  );
}

/** Corpo rolável + rodapé fixo com a ação principal. */
function Quadro({ titulo, icone, texto, children, rodape }: { titulo: string; icone?: ReactNode; texto?: string; children: ReactNode; rodape: ReactNode }) {
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3 pt-4">
        <div className="flex items-start gap-2.5">
          {icone && <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-mint-400 text-black">{icone}</span>}
          <div className="min-w-0">
            <h2 className="font-display text-lg font-extrabold leading-tight text-black">{titulo}</h2>
            {texto && <p className="mt-0.5 text-sm leading-snug text-neutral-600">{texto}</p>}
          </div>
        </div>
        <div className="mt-3.5 space-y-4">{children}</div>
      </div>
      <div className="shrink-0 border-t border-neutral-200 bg-white px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3">{rodape}</div>
    </>
  );
}

const BOTAO = 'flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-2xl px-4 text-base font-extrabold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45';
const BotaoPrincipal = ({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button type="button" {...p} className={cn(BOTAO, 'bg-mint-400 text-black shadow-[0_6px_16px_-6px_rgba(255,199,0,.9)]', p.className)}>{children}</button>;
const BotaoSecundario = ({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button type="button" {...p} className={cn(BOTAO, 'bg-white text-black ring-2 ring-black/10', p.className)}>{children}</button>;

function Rotulo({ children, dica }: { children: ReactNode; dica?: string }) {
  return <p className="mb-1.5 text-[15px] font-bold text-black">{children}{dica && <span className="mt-0.5 block text-xs font-normal text-neutral-500">{dica}</span>}</p>;
}

function Opcao({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={ativo} onClick={onClick}
      className={cn('min-h-[2.75rem] rounded-xl px-3.5 text-sm font-bold transition active:scale-95', ativo ? 'bg-mint-400 text-black ring-2 ring-black' : 'bg-white text-neutral-700 ring-1 ring-neutral-300')}>
      {children}
    </button>
  );
}

/** Mostra o ponto do formulário ativo no mapa principal e recebe as correções. */
function usePontoNoMapa(setNoMapa: (p: PontoNoMapa | null) => void, tipo: PontoNoMapa['tipo'], ponto: Coord | null, ocultarId: string | null | undefined, aoMover: (lat: number, lng: number) => void, ativo = true) {
  const aoMoverRef = useRef(aoMover);
  aoMoverRef.current = aoMover;
  useEffect(() => {
    if (!ativo) return;
    setNoMapa({ tipo, ponto, ocultarId, aoMover: (lat, lng) => aoMoverRef.current(lat, lng) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, ponto?.lat, ponto?.lng, ocultarId, ativo]);
  useEffect(() => () => setNoMapa(null), [setNoMapa]);
}

/** Campo de endereço ligado ao mapa principal (sem abrir um segundo mapa). */
function EnderecoNoMapa({ valor, onChange, locais, placeholder }: { valor: EnderecoCampo; onChange: (e: EnderecoCampo) => void; locais: SugestaoEndereco[]; placeholder: string }) {
  return (
    <div>
      <CampoEndereco valor={valor} onChange={onChange} locais={locais} placeholder={placeholder} mapaExterno />
      <p className="mt-1 text-xs text-neutral-500">Digite rua e número. O alfinete aparece no mapa — arraste até a porta, se precisar.</p>
    </div>
  );
}
const marcadoNoMapa = (e: EnderecoCampo, lat: number, lng: number): EnderecoCampo => ({ texto: e.texto, coord: { lat, lng }, precisao: 'ajustado', validando: false });

/* =============================== 1. Dados =============================== */

function EtapaDados({ rota, setRota, novoId, veiculos, veiculo, locais, saida, setNoMapa, onContinuar }: {
  rota: Rota; setRota: (r: Rota) => void; novoId: () => string; veiculos: Veiculo[]; veiculo: Veiculo | null; locais: SugestaoEndereco[];
  saida: ParadaRota | null; setNoMapa: (p: PontoNoMapa | null) => void; onContinuar: () => void;
}) {
  const [endereco, setEndereco] = useState<EnderecoCampo>(() => enderecoSalvo(saida));
  const [semPonto, setSemPonto] = useState(false);
  usePontoNoMapa(setNoMapa, 'saida', endereco.coord, saida?.id, (lat, lng) => setEndereco((e) => marcadoNoMapa(e, lat, lng)));
  const texto = endereco.texto.trim();
  const pronto = !!veiculo && !!texto && !endereco.validando && (!!endereco.coord || semPonto);

  function continuar() {
    setRota(definirSaida(rota, { rotulo: texto, ponto: endereco.coord }, novoId));
    onContinuar();
  }

  return (
    <Quadro titulo="Dados da rota" icone={<Bus className="h-5 w-5" />} texto="Comece por onde a van sai. O ponto aparece no mapa."
      rodape={<>
        {!pronto && texto && !endereco.coord && !endereco.validando && !semPonto && (
          <button type="button" className="mb-2 w-full text-center text-sm font-semibold text-neutral-600 underline" onClick={() => setSemPonto(true)}>Não achei no mapa — continuar só com o endereço digitado</button>
        )}
        <BotaoPrincipal disabled={!pronto} onClick={continuar}>Continuar <ArrowRight className="h-5 w-5" /></BotaoPrincipal>
      </>}>
      <div>
        <Rotulo dica="Fica privado, mesmo que seja a sua casa.">De onde a van sai?</Rotulo>
        <EnderecoNoMapa valor={endereco} onChange={(e) => { setEndereco(e); setSemPonto(false); }} locais={locais} placeholder="Ex.: Rua José Geraldo, 580" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Rotulo>Horário de saída</Rotulo>
          <input type="time" aria-label="Horário habitual de saída da van" className="field-input !h-[3.25rem] text-lg font-bold" value={horaDoCampo(rota.saidaHabitualMin)}
            onChange={(e) => { const m = /^(\d\d):(\d\d)$/.exec(e.target.value); setRota({ ...rota, saidaHabitualMin: m ? Number(m[1]) * 60 + Number(m[2]) : null }); }} />
        </div>
        <div>
          <Rotulo>Sentido</Rotulo>
          <div className="grid grid-cols-2 gap-1.5">
            <Opcao ativo={rota.sentido === 'ida'} onClick={() => setRota({ ...rota, sentido: 'ida' })}>Ida</Opcao>
            <Opcao ativo={rota.sentido === 'volta'} onClick={() => setRota({ ...rota, sentido: 'volta' })}>Volta</Opcao>
          </div>
        </div>
      </div>
      <p className="-mt-2 text-xs text-neutral-500">{rota.sentido === 'ida' ? 'Ida: busca os alunos em casa e leva até a escola.' : 'Volta: pega os alunos na escola e entrega em casa.'}</p>

      <PeriodoEscolar rota={rota} setRota={setRota} />

      <div>
        <Rotulo>Nome da rota</Rotulo>
        <input className="field-input !h-[3.25rem]" placeholder={`Ex.: Manhã — ${rota.sentido === 'ida' ? 'ida' : 'volta'}`} value={rota.nome} onChange={(e) => setRota({ ...rota, nome: e.target.value })} />
      </div>

      <details className="rounded-2xl bg-neutral-50 p-3.5 ring-1 ring-neutral-200" open={veiculos.length > 1 && !veiculo}>
        <summary className="cursor-pointer text-[15px] font-bold text-black">Van, dias e monitor <span className="ml-1 text-xs font-normal text-neutral-500">{veiculo ? `${veiculo.modelo || 'Van'} · ${capacidadeAlunos(rota, veiculo)} lugares para alunos` : 'escolha a van'}</span></summary>
        <div className="mt-3 space-y-4">
          {veiculos.length > 1 && (
            <div>
              <Rotulo>Qual van faz esta rota?</Rotulo>
              <div className="flex flex-wrap gap-2">{veiculos.map((v) => <Opcao key={v.id} ativo={rota.veiculoId === v.id} onClick={() => setRota({ ...rota, veiculoId: v.id })}>{v.modelo || 'Van'} ({v.lugaresPassageiro})</Opcao>)}</div>
            </div>
          )}
          <div>
            <Rotulo>Dias da rota</Rotulo>
            <div className="flex flex-wrap gap-1.5">
              {DIAS_SEMANA.slice(0, 5).map((d) => <Opcao key={d} ativo={rota.dias.includes(d)} onClick={() => setRota({ ...rota, dias: rota.dias.includes(d) ? rota.dias.filter((x) => x !== d) : DIAS_SEMANA.filter((x) => x === d || rota.dias.includes(x)) })}>{DIA_LABEL[d]}</Opcao>)}
            </div>
          </div>
          <div>
            <Rotulo>Vai um monitor nesta rota?</Rotulo>
            <div className="flex gap-2">
              <Opcao ativo={rota.monitor} onClick={() => setRota({ ...rota, monitor: true })}>Sim</Opcao>
              <Opcao ativo={!rota.monitor} onClick={() => setRota({ ...rota, monitor: false, monitorOcupaLugar: false })}>Não</Opcao>
            </div>
            {rota.monitor && (
              <div className="mt-2.5">
                <Rotulo>O monitor ocupa um dos lugares?</Rotulo>
                <div className="flex gap-2">
                  <Opcao ativo={rota.monitorOcupaLugar} onClick={() => setRota({ ...rota, monitorOcupaLugar: true })}>Sim</Opcao>
                  <Opcao ativo={!rota.monitorOcupaLugar} onClick={() => setRota({ ...rota, monitorOcupaLugar: false })}>Não</Opcao>
                </div>
              </div>
            )}
          </div>
        </div>
      </details>
    </Quadro>
  );
}

/* =============================== 2. Paradas =============================== */

function resumoDaParada(rota: Rota, p: ParadaRota, nomeEscola: (p: ParadaRota) => string): { titulo: string; sub: string; habitual: number | null } {
  if (p.tipo === 'saida') return { titulo: 'Saída da van', sub: p.rotulo || 'Endereço não informado', habitual: rota.saidaHabitualMin ?? null };
  if (p.tipo === 'escola') {
    const h = rota.sentido === 'ida' ? p.limiteChegadaMin : p.liberacaoMin;
    const qtd = rota.passageiros.filter((x) => escolaParadaDoAluno(rota, x) === p.id).length;
    return { titulo: nomeEscola(p), sub: `${qtd} aluno(s) ${rota.sentido === 'ida' ? 'descem' : 'embarcam'} · ${h != null ? `${rota.sentido === 'ida' ? 'chegar até' : 'liberação'} ${horaDoCampo(h)}` : 'horário não informado'}`, habitual: h ?? null };
  }
  const alunos = alunosDaCasa(rota, p.id);
  return { titulo: listar(alunos.map((x) => x.identificacao)) || 'Casa sem aluno', sub: p.rotulo || 'Endereço não informado', habitual: alunos.find((x) => x.horarioHabitualMin != null)?.horarioHabitualMin ?? p.horarioChegadaMin ?? null };
}

/** Linha do tempo compacta: uma linha por parada, toque para abrir. */
function LinhaDoTempo({ rota, paradas, previsto, nomeEscola, onAbrir }: { rota: Rota; paradas: ParadaRota[]; previsto: Map<string, number>; nomeEscola: (p: ParadaRota) => string; onAbrir: (id: string) => void }) {
  let numero = 0;
  const ultimaEscola = [...paradas].reverse().find((p) => p.tipo === 'escola');
  return (
    <ol className="space-y-1.5" data-testid="linha-do-tempo">
      {paradas.map((p) => {
        const r = resumoDaParada(rota, p, nomeEscola);
        const n = p.tipo === 'saida' ? 0 : ++numero;
        const prev = previsto.get(p.id);
        const escola = p.tipo === 'escola';
        return (
          <li key={p.id}>
            <button type="button" onClick={() => onAbrir(p.id)} data-testid={`parada-${p.tipo}`}
              className={cn('flex w-full items-center gap-2.5 rounded-2xl p-2.5 text-left ring-1 transition active:scale-[0.99]', escola ? 'bg-mint-50 ring-mint-300' : 'bg-white ring-neutral-200')}>
              <span className={cn('grid h-9 w-9 shrink-0 place-items-center text-sm font-extrabold', escola ? 'rounded-xl bg-black text-mint-400' : p.tipo === 'saida' ? 'rounded-full bg-black text-mint-400' : 'rounded-full bg-mint-400 text-black')}>
                {p.tipo === 'saida' ? <Home className="h-4 w-4" /> : escola ? <GraduationCap className="h-5 w-5" /> : n}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[15px] font-bold text-black">{r.titulo}</span>
                  {escola && p.id === ultimaEscola?.id && rota.sentido === 'ida' && <span className="shrink-0 rounded-full bg-mint-400 px-1.5 py-0.5 text-[10px] font-extrabold text-black">Última escola</span>}
                  {!temPonto(p) && <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">sem ponto no mapa</span>}
                </span>
                <span className="block truncate text-xs text-neutral-500">{r.sub}</span>
              </span>
              <span className="shrink-0 text-right leading-tight">
                <span className="block text-sm font-extrabold tabular-nums text-black">{r.habitual != null ? horaDoCampo(r.habitual) : '—'}</span>
                {prev != null && <span className="block text-[10px] font-semibold tabular-nums text-neutral-500">previsto {horaDoCampo(Math.round(prev))}</span>}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" />
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function EtapaParadas({ rota, paradas, veiculo, previsto, nomeEscola, onAbrir, onAluno, onEscola, onContinuar }: {
  rota: Rota; paradas: ParadaRota[]; veiculo: Veiculo | null; previsto: Map<string, number>; nomeEscola: (p: ParadaRota) => string;
  onAbrir: (id: string) => void; onAluno: () => void; onEscola: () => void; onContinuar: () => void;
}) {
  const ida = rota.sentido === 'ida';
  const temEscola = paradas.some((p) => p.tipo === 'escola');
  const vazio = paradas.length <= 1;
  const cap = capacidadeAlunos(rota, veiculo);
  return (
    <Quadro titulo={ida ? 'Paradas de embarque' : 'Paradas da volta'} icone={<MapPin className="h-5 w-5" />}
      texto={vazio
        ? (ida ? 'Adicione os alunos na ordem em que a van passa. Depois, a escola.' : 'Adicione primeiro a escola de onde os alunos saem. Depois, cada aluno.')
        : `${rota.passageiros.length} aluno(s) · maior lotação ${picoOcupacao(rota)} de ${cap} lugares. Toque numa parada para ver ou corrigir.`}
      rodape={<div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <BotaoSecundario onClick={onAluno} disabled={!ida && !temEscola}><UserPlus className="h-5 w-5" /> Adicionar aluno</BotaoSecundario>
          <BotaoSecundario onClick={onEscola}><GraduationCap className="h-5 w-5" /> Adicionar escola</BotaoSecundario>
        </div>
        {!vazio && <BotaoPrincipal onClick={onContinuar}>Continuar <ArrowRight className="h-5 w-5" /></BotaoPrincipal>}
      </div>}>
      <LinhaDoTempo rota={rota} paradas={paradas} previsto={previsto} nomeEscola={nomeEscola} onAbrir={onAbrir} />
      <p className="text-[11px] leading-snug text-neutral-500">
        Hora em destaque: a que você informou. “Previsto”: calculado pelo VanBora com o trajeto do mapa e os tempos de embarque{previsto.size ? '' : ' (aparece quando a rota tiver o horário final)'}.
      </p>
    </Quadro>
  );
}

/** Subir, descer e excluir uma parada (com confirmação). */
function AcoesDaParada({ rota, setRota, paradaId, onExcluida, textoExcluir }: { rota: Rota; setRota: (r: Rota) => void; paradaId: string; onExcluida: () => void; textoExcluir: string }) {
  const [confirmar, setConfirmar] = useState(false);
  return (
    <div className="rounded-2xl bg-neutral-50 p-3 ring-1 ring-neutral-200">
      <p className="text-xs font-bold text-neutral-600">Ordem no percurso</p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        <button type="button" disabled={!podeMover(rota, paradaId, -1)} onClick={() => setRota(moverParada(rota, paradaId, -1))} className="inline-flex min-h-[2.75rem] items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-bold ring-1 ring-neutral-300 disabled:opacity-40"><ArrowUp className="h-4 w-4" /> Antes</button>
        <button type="button" disabled={!podeMover(rota, paradaId, 1)} onClick={() => setRota(moverParada(rota, paradaId, 1))} className="inline-flex min-h-[2.75rem] items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-bold ring-1 ring-neutral-300 disabled:opacity-40"><ArrowDown className="h-4 w-4" /> Depois</button>
        {!confirmar
          ? <button type="button" onClick={() => setConfirmar(true)} className="ml-auto inline-flex min-h-[2.75rem] items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-bold text-red-700 ring-1 ring-red-200"><Trash2 className="h-4 w-4" /> Excluir parada</button>
          : (
            <div className="w-full rounded-xl bg-red-50 p-2.5">
              <p className="text-sm font-semibold text-red-800">{textoExcluir}</p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => { setRota(excluirParada(rota, paradaId)); onExcluida(); }} className="min-h-[2.75rem] flex-1 rounded-xl bg-red-600 px-3 text-sm font-extrabold text-white">Sim, excluir</button>
                <button type="button" onClick={() => setConfirmar(false)} className="min-h-[2.75rem] flex-1 rounded-xl bg-white px-3 text-sm font-bold ring-1 ring-neutral-300">Não</button>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}

/** Uma casa já cadastrada: quem é atendido nela e o que dá para fazer. */
function PainelCasa({ rota, setRota, paradaId, previsto, onAluno, onOutroAluno, onFechar }: {
  rota: Rota; setRota: (r: Rota) => void; novoId: () => string; paradaId: string; previsto?: number;
  onAluno: (alunoId: string) => void; onOutroAluno: () => void; onFechar: (mensagem?: string) => void;
}) {
  const parada = rota.paradas.find((p) => p.id === paradaId);
  if (!parada) return null;
  const alunos = alunosDaCasa(rota, paradaId);
  return (
    <Quadro titulo={parada.rotulo || 'Casa'} icone={<Home className="h-5 w-5" />}
      texto={previsto != null ? `Chegada prevista pelo VanBora: ${horaDoCampo(Math.round(previsto))}.` : 'Toque no aluno para corrigir os dados dele.'}
      rodape={<BotaoPrincipal onClick={() => onFechar()}><Check className="h-5 w-5" /> Pronto</BotaoPrincipal>}>
      <ul className="space-y-2">
        {alunos.map((x) => (
          <li key={x.id}>
            <button type="button" onClick={() => onAluno(x.id)} className="flex w-full items-center gap-2.5 rounded-2xl bg-white p-3 text-left ring-1 ring-neutral-200 active:scale-[0.99]">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-mint-400 text-black"><User className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold">{x.identificacao || 'Aluno'}</span>
                <span className="block truncate text-xs text-neutral-500">
                  {x.horarioHabitualMin != null ? `habitual ${horaDoCampo(x.horarioHabitualMin)}` : 'sem horário'} · {rota.sentido === 'ida' ? 'embarque' : 'desembarque'} {textoDuracao(x.atendimentoMin)}
                </span>
              </span>
              <Pencil className="h-4 w-4 shrink-0 text-neutral-400" />
            </button>
          </li>
        ))}
        {alunos.length === 0 && <li className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">Nenhum aluno nesta casa.</li>}
      </ul>
      <BotaoSecundario onClick={onOutroAluno}><Plus className="h-5 w-5" /> Outro aluno neste endereço</BotaoSecundario>
      <AcoesDaParada rota={rota} setRota={setRota} paradaId={paradaId} onExcluida={() => onFechar('Parada excluída.')}
        textoExcluir={`Excluir esta parada${alunos.length ? ` e tirar ${listar(alunos.map((x) => x.identificacao))} da rota` : ''}?`} />
    </Quadro>
  );
}

const TEMPOS = [0.5, 1, 1.5, 2, 3];
const TOLERANCIAS = [0, 5, 10, 15, 20];

function FormAluno({ rota, setRota, novoId, alunoId, naCasaId, locais, nomeEscola, setNoMapa, onFechar }: {
  rota: Rota; setRota: (r: Rota) => void; novoId: () => string; alunoId?: string; naCasaId?: string; locais: SugestaoEndereco[];
  nomeEscola: (p: ParadaRota) => string; setNoMapa: (p: PontoNoMapa | null) => void; onFechar: (mensagem?: string) => void;
}) {
  const ida = rota.sentido === 'ida';
  const aluno = alunoId ? rota.passageiros.find((x) => x.id === alunoId) : undefined;
  const casaAtual = aluno ? rota.paradas.find((p) => p.id === casaDoAluno(rota, aluno)) : naCasaId ? rota.paradas.find((p) => p.id === naCasaId) : undefined;
  const escolas = escolasDaRota(rota);
  const ultima = emOrdem(rota).at(-1);

  const [nome, setNome] = useState(aluno?.identificacao ?? '');
  const [endereco, setEndereco] = useState<EnderecoCampo>(() => enderecoSalvo(casaAtual));
  const [semPonto, setSemPonto] = useState(!!casaAtual && !temPonto(casaAtual));
  const [horario, setHorario] = useState<number | null>(aluno?.horarioHabitualMin ?? (naCasaId ? casaAtual?.horarioChegadaMin ?? null : null));
  const [tempo, setTempo] = useState<number | null>(aluno?.atendimentoMin ?? null);
  const [antes, setAntes] = useState<number | null>(aluno?.ajusteAntesMin ?? null);
  const [depois, setDepois] = useState<number | null>(aluno?.ajusteDepoisMin ?? null);
  const [tempoLivre, setTempoLivre] = useState(tempo != null && !TEMPOS.includes(tempo));
  const [tolLivre, setTolLivre] = useState((antes != null || depois != null) && !(antes === depois && TOLERANCIAS.includes(antes ?? -1)));
  // Escola: a do aluno; para um aluno novo, a última parada se ela for escola (ida) ou a única escola (volta).
  const [escolaId, setEscolaId] = useState<string>(() => (aluno ? escolaParadaDoAluno(rota, aluno) : ida ? (ultima?.tipo === 'escola' ? ultima.id : null) : escolas.at(-1)?.id) ?? '');
  const [confirmarRemocao, setConfirmarRemocao] = useState(false);

  const fixo = !!naCasaId; // entra numa casa que já existe: o endereço é o dela
  usePontoNoMapa(setNoMapa, 'casa', endereco.coord, casaAtual?.id, (lat, lng) => { if (!fixo) setEndereco((e) => marcadoNoMapa(e, lat, lng)); });

  const texto = endereco.texto.trim();
  const faltaEscola = !ida && !escolaId;
  const pronto = !!nome.trim() && !!texto && !endereco.validando && (!!endereco.coord || semPonto) && !faltaEscola;

  function confirmar() {
    const compromisso = { horarioHabitualMin: horario, atendimentoMin: tempo, ajusteAntesMin: antes, ajusteDepoisMin: depois };
    if (aluno) {
      setRota(atualizarAluno(rota, aluno.id, { nome, endereco: { rotulo: texto, ponto: endereco.coord }, escolaParadaId: escolaId || null, ...compromisso }, novoId));
      return onFechar(`${nome.trim()}: dados atualizados.`);
    }
    const r = adicionarAluno(rota, { nome, endereco: { rotulo: texto, ponto: endereco.coord }, escolaParadaId: escolaId || null, naCasaId: naCasaId ?? null, atendimentoOrigem: null, ...compromisso }, novoId);
    setRota(r.rota);
    onFechar(`${nome.trim()} entrou no percurso.`);
  }

  return (
    <Quadro titulo={aluno ? 'Corrigir aluno' : 'Adicionar aluno'} icone={<UserPlus className="h-5 w-5" />}
      texto={aluno ? undefined : ida ? 'Onde a van busca este aluno?' : 'Onde a van entrega este aluno?'}
      rodape={<div className="grid grid-cols-[auto_1fr] gap-2">
        <BotaoSecundario className="!w-auto px-5" onClick={() => onFechar()}><X className="h-5 w-5" /> Cancelar</BotaoSecundario>
        <BotaoPrincipal disabled={!pronto} onClick={confirmar}><Check className="h-5 w-5" /> {aluno ? 'Salvar alterações' : 'Confirmar parada'}</BotaoPrincipal>
      </div>}>
      <div>
        <Rotulo dica="Primeiro nome ou apelido. Não precisa de documento.">Nome do aluno</Rotulo>
        <input className="field-input !h-[3.25rem]" placeholder="Ex.: Ana Carolina" aria-label="Nome do aluno" value={nome} onChange={(e) => setNome(e.target.value)} />
      </div>

      <div>
        <Rotulo>{ida ? 'Endereço de embarque' : 'Endereço de entrega'}</Rotulo>
        {fixo
          ? <p className="rounded-xl bg-neutral-100 p-3 text-sm font-semibold text-neutral-800"><MapPin className="mr-1 inline h-4 w-4" />{casaAtual?.rotulo} <span className="font-normal text-neutral-500">(mesmo endereço)</span></p>
          : <EnderecoNoMapa valor={endereco} onChange={(e) => { setEndereco(e); setSemPonto(false); }} locais={locais} placeholder="Ex.: Rua das Flores, 120" />}
        {!fixo && texto && !endereco.coord && !endereco.validando && !semPonto && (
          <button type="button" className="mt-1.5 text-sm font-semibold text-neutral-600 underline" onClick={() => setSemPonto(true)}>Não achei no mapa — usar só o endereço digitado</button>
        )}
      </div>

      <div>
        <Rotulo dica="A hora que você combinou com a família. O VanBora calcula a hora prevista à parte.">{ida ? 'Horário habitual de chegada ao aluno' : 'Horário habitual de entrega'}</Rotulo>
        <input type="time" aria-label="Horário habitual do aluno" className="field-input !h-[3.25rem] !w-40 text-lg font-bold" value={horaDoCampo(horario)}
          onChange={(e) => { const m = /^(\d\d):(\d\d)$/.exec(e.target.value); setHorario(m ? Number(m[1]) * 60 + Number(m[2]) : null); }} />
      </div>

      <div>
        <Rotulo dica={ida ? 'Quanto este aluno leva para entrar na van. Uns são rápidos, outros precisam de mais tempo.' : 'Quanto este aluno leva para descer da van.'}>{ida ? 'Tempo de embarque' : 'Tempo de desembarque'}</Rotulo>
        <div className="flex flex-wrap gap-1.5">
          {TEMPOS.map((t) => <Opcao key={t} ativo={!tempoLivre && tempo === t} onClick={() => { setTempoLivre(false); setTempo(tempo === t && !tempoLivre ? null : t); }}>{textoDuracao(t)}</Opcao>)}
          <Opcao ativo={tempoLivre} onClick={() => setTempoLivre((v) => !v)}>Outro</Opcao>
        </div>
        {tempoLivre && <div className="mt-2"><CampoDuracao rotulo="Tempo exato" valor={tempo} onChange={setTempo} dica="Pode ser menos de 1 minuto." /></div>}
        {tempo == null && !tempoLivre && <p className="mt-1 text-xs text-neutral-500">Sem escolher, fica “não informado” e o cálculo usa o tempo padrão provisório.</p>}
      </div>

      <div>
        <Rotulo dica="Quanto o horário deste aluno pode variar. Fixo = não pode variar.">Variação de horário (tolerância)</Rotulo>
        <div className="flex flex-wrap gap-1.5">
          {TOLERANCIAS.map((t) => {
            const ativo = !tolLivre && antes === t && depois === t;
            return <Opcao key={t} ativo={ativo} onClick={() => { setTolLivre(false); setAntes(ativo ? null : t); setDepois(ativo ? null : t); }}>{t === 0 ? 'Fixo' : `± ${t} min`}</Opcao>;
          })}
          <Opcao ativo={tolLivre} onClick={() => setTolLivre((v) => !v)}>Outro</Opcao>
        </div>
        {tolLivre && (
          <div className="mt-2 grid grid-cols-2 gap-3">
            <CampoMinutos rotulo="Pode ser antes" valor={antes} onChange={setAntes} dica="0 = não pode." />
            <CampoMinutos rotulo="Pode ser depois" valor={depois} onChange={setDepois} dica="0 = não pode." />
          </div>
        )}
      </div>

      {escolas.length > 0 && (
        <div>
          <Rotulo>{ida ? 'Desce em qual escola?' : 'Sai de qual escola?'}</Rotulo>
          <select className="field-input !h-[3.25rem] appearance-none" aria-label="Escola do aluno" value={escolaId} onChange={(e) => setEscolaId(e.target.value)}>
            {ida && <option value="">Vou adicionar a escola depois</option>}
            {!ida && <option value="">Escolha a escola…</option>}
            {escolas.map((e) => <option key={e.id} value={e.id}>{nomeEscola(e)}</option>)}
          </select>
        </div>
      )}
      {faltaEscola && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Escolha de qual escola o aluno sai.</p>}

      {aluno && (!confirmarRemocao
        ? <button type="button" onClick={() => setConfirmarRemocao(true)} className="inline-flex min-h-[2.75rem] items-center gap-1.5 rounded-xl px-1 text-sm font-bold text-red-700"><Trash2 className="h-4 w-4" /> Tirar este aluno da rota</button>
        : (
          <div className="rounded-xl bg-red-50 p-3">
            <p className="text-sm font-semibold text-red-800">Tirar {aluno.identificacao} da rota?</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => { setRota(removerAlunoDaRota(rota, aluno.id)); onFechar(`${aluno.identificacao} saiu da rota.`); }} className="min-h-[2.75rem] flex-1 rounded-xl bg-red-600 px-3 text-sm font-extrabold text-white">Sim, tirar</button>
              <button type="button" onClick={() => setConfirmarRemocao(false)} className="min-h-[2.75rem] flex-1 rounded-xl bg-white px-3 text-sm font-bold ring-1 ring-neutral-300">Não</button>
            </div>
          </div>
        ))}
    </Quadro>
  );
}

function FormEscola({ rota, setRota, novoId, paradaId, destinos, setNoMapa, onFechar }: {
  rota: Rota; setRota: (r: Rota) => void; novoId: () => string; paradaId?: string; destinos: DestinoCatalogo[];
  setNoMapa: (p: PontoNoMapa | null) => void; onFechar: (mensagem?: string) => void;
}) {
  const ida = rota.sentido === 'ida';
  const parada = paradaId ? rota.paradas.find((p) => p.id === paradaId) : undefined;
  const [destinoId, setDestinoId] = useState(parada?.destinoId ?? '');
  const [visita, setVisita] = useState<Pick<ParadaRota, 'limiteChegadaMin' | 'liberacaoMin' | 'atendimentoGrupoMin'>>({
    limiteChegadaMin: parada?.limiteChegadaMin ?? null, liberacaoMin: parada?.liberacaoMin ?? null, atendimentoGrupoMin: parada?.atendimentoGrupoMin ?? null,
  });
  const [portao, setPortao] = useState<Coord | null>(parada?.portaoEspecifico && temPonto(parada) ? { lat: parada.lat!, lng: parada.lng! } : null);
  const destino = destinos.find((d) => d.id === destinoId);
  const doCatalogo: Coord | null = destino && typeof destino.lat === 'number' && typeof destino.lng === 'number' ? { lat: destino.lat, lng: destino.lng }
    : parada && !parada.portaoEspecifico && temPonto(parada) ? { lat: parada.lat!, lng: parada.lng! } : null;
  // IDA: quem pode descer aqui (já a bordo quando a van chega nesta escola).
  const candidatos = useMemo(() => (ida ? candidatosADescer(rota, parada ? parada.ordem : Number.POSITIVE_INFINITY, parada?.id ?? null) : []), [ida, rota, parada]);
  const [descem, setDescem] = useState<string[]>(() => (parada ? candidatos.filter((x) => x.desembarqueParadaId === parada.id) : candidatos).map((x) => x.id));

  usePontoNoMapa(setNoMapa, 'escola', portao ?? doCatalogo, parada?.id, (lat, lng) => setPortao({ lat, lng }), !!destinoId);
  const nome = destino?.nome ?? parada?.destinoNome ?? parada?.rotulo ?? 'Escola';

  function confirmar() {
    if (parada) {
      setRota(atualizarEscola(rota, parada.id, { ...visita, portao, pontoCatalogo: doCatalogo, ...(ida ? { descemIds: descem } : {}) }));
      return onFechar(`${nomeDestinoParaExibicao(nome)}: dados atualizados.`);
    }
    if (!destino) return;
    const r = adicionarEscola(rota, { destinoId, nome: destino.nome, pontoCatalogo: doCatalogo, portao, ...visita, descemIds: descem }, novoId);
    setRota(r.rota);
    onFechar(`${nomeDestinoParaExibicao(destino.nome)} entrou no percurso.`);
  }

  return (
    <Quadro titulo={parada ? nomeDestinoParaExibicao(nome) : 'Adicionar escola'} icone={<GraduationCap className="h-5 w-5" />}
      texto={parada ? 'Escola do percurso.' : 'Esta escola passa a ser uma parada da rota.'}
      rodape={<div className="grid grid-cols-[auto_1fr] gap-2">
        <BotaoSecundario className="!w-auto px-5" onClick={() => onFechar()}><X className="h-5 w-5" /> Cancelar</BotaoSecundario>
        <BotaoPrincipal disabled={!destinoId} onClick={confirmar}><Check className="h-5 w-5" /> {parada ? 'Salvar alterações' : 'Confirmar escola'}</BotaoPrincipal>
      </div>}>
      {!parada && (
        <div>
          <Rotulo dica="É a mesma lista de escolas que as famílias usam na busca.">Qual escola?</Rotulo>
          <select className="field-input !h-[3.25rem] appearance-none" aria-label="Escola" value={destinoId} onChange={(e) => { setDestinoId(e.target.value); setPortao(null); }}>
            <option value="">Escolha a escola…</option>
            {destinos.map((d) => <option key={d.id} value={d.id}>{nomeDestinoParaExibicao(d.nome)} — {d.bairro}</option>)}
          </select>
          <p className="mt-1 text-xs text-neutral-500">Não achou? Salve como rascunho e avise a equipe — não inventamos escolas.</p>
        </div>
      )}
      {parada && !parada.destinoId && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">Esta parada não está ligada a uma escola da lista. Exclua-a e adicione a escola de novo.</p>}

      {destinoId && (
        <>
          <div className="rounded-2xl bg-mint-50 p-3 ring-1 ring-mint-300">
            <CamposDaVisita sentido={rota.sentido} visita={visita} onChange={setVisita} />
            <p className="mt-2 text-xs text-neutral-600">{ida ? '“Chegar até” é o horário-limite: a van não pode chegar depois dele.' : '“Liberação” é a hora em que os alunos saem da escola.'}</p>
          </div>
          <p className="text-sm text-neutral-700">
            <MapPin className="mr-1 inline h-4 w-4" />
            {portao ? 'Portão marcado por você no mapa.' : 'A van para em outro portão? Arraste o alfinete no mapa até ele.'}
            {portao && doCatalogo && <button type="button" className="ml-2 font-bold underline" onClick={() => setPortao(null)}>Voltar ao ponto da escola</button>}
          </p>
          {ida && (
            <div>
              <Rotulo>Quem desce nesta escola?</Rotulo>
              {candidatos.length === 0
                ? <p className="rounded-xl bg-neutral-100 p-3 text-sm text-neutral-600">Nenhum aluno a bordo ainda. Você pode adicionar os alunos depois.</p>
                : (
                  <div className="flex flex-wrap gap-1.5">
                    {candidatos.map((x) => {
                      const on = descem.includes(x.id);
                      return <Opcao key={x.id} ativo={on} onClick={() => setDescem((s) => (on ? s.filter((i) => i !== x.id) : [...s, x.id]))}>{on && <Check className="mr-1 inline h-4 w-4" />}{x.identificacao}</Opcao>;
                    })}
                  </div>
                )}
            </div>
          )}
        </>
      )}

      {parada && (
        <AcoesDaParada rota={rota} setRota={setRota} paradaId={parada.id} onExcluida={() => onFechar('Escola excluída do percurso.')}
          textoExcluir={ida ? 'Excluir esta escola do percurso? Os alunos que descem nela ficam sem escola.' : 'Excluir esta escola do percurso? Os alunos que embarcam nela saem da rota.'} />
      )}
    </Quadro>
  );
}

/* =============================== 3. Escolas =============================== */

function EtapaEscolas({ rota, setRota, paradas, destinos, listaGeral, nomeEscola, onAbrir, onNova, onContinuar }: {
  rota: Rota; setRota: (r: Rota) => void; paradas: ParadaRota[]; destinos: DestinoCatalogo[]; listaGeral: string[]; nomeEscola: (p: ParadaRota) => string;
  onAbrir: (id: string) => void; onNova: () => void; onContinuar: () => void;
}) {
  const escolas = paradas.filter((p) => p.tipo === 'escola');
  const ida = rota.sentido === 'ida';
  return (
    <Quadro titulo="Escolas" icone={<GraduationCap className="h-5 w-5" />} texto="Confira as escolas do percurso. Abaixo, diga quais outras você aceitaria atender."
      rodape={<BotaoPrincipal onClick={onContinuar}>Revisar rota <ArrowRight className="h-5 w-5" /></BotaoPrincipal>}>
      <div>
        <Rotulo dica="São paradas da rota de hoje.">Escolas do percurso</Rotulo>
        <ul className="space-y-1.5">
          {escolas.map((p) => {
            const h = ida ? p.limiteChegadaMin : p.liberacaoMin;
            return (
              <li key={p.id}>
                <button type="button" onClick={() => onAbrir(p.id)} className="flex w-full items-center gap-2.5 rounded-2xl bg-mint-50 p-3 text-left ring-1 ring-mint-300 active:scale-[0.99]">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-black text-mint-400"><GraduationCap className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold">{nomeEscola(p)}</span>
                    <span className="block truncate text-xs text-neutral-600">
                      {h != null ? `${ida ? 'chegar até' : 'liberação'} ${horaDoCampo(h)}` : `${ida ? 'limite de chegada' : 'liberação'} não informado`} · parada {textoDuracao(p.atendimentoGrupoMin)}
                    </span>
                  </span>
                  <Pencil className="h-4 w-4 shrink-0 text-neutral-500" />
                </button>
              </li>
            );
          })}
        </ul>
        {escolas.length === 0 && <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">A rota ainda não tem escola no percurso.</p>}
        <button type="button" onClick={onNova} className="mt-2 inline-flex min-h-[2.75rem] items-center gap-1.5 text-sm font-extrabold text-black underline"><Plus className="h-4 w-4" /> Adicionar escola ao percurso</button>
      </div>
      {/* Escolas ACEITAS: seção à parte — não viram parada nem mudam os horários. */}
      <div className="[&>.card]:mt-0 [&>.card]:shadow-none [&>.card]:ring-neutral-200">
        <EscolasDisponiveis rota={rota} setRota={setRota} destinos={destinos} listaGeral={listaGeral} />
      </div>
    </Quadro>
  );
}

/* =============================== 4. Revisão =============================== */

function EtapaRevisao({ rota, setRota, paradas, veiculo, destinos, nomeEscola, previsto, planejamento, salvando, onAbrir, onAluno, onIr, onConcluir, onRascunho }: {
  rota: Rota; setRota: (r: Rota) => void; paradas: ParadaRota[]; veiculo: Veiculo | null; destinos: DestinoCatalogo[]; nomeEscola: (p: ParadaRota) => string;
  previsto: Map<string, number>; planejamento: ReturnType<typeof planejarRotaDoCadastro>; salvando: null | Rota['status'];
  onAbrir: (id: string) => void; onAluno: (alunoId: string) => void; onIr: (e: Etapa) => void; onConcluir: () => void; onRascunho: () => void;
}) {
  const ida = rota.sentido === 'ida';
  const problemas = validarRota(rota, veiculo);
  const nomeDestino = useMemo(() => new Map(destinos.map((d) => [d.id, d.nome])), [destinos]);
  const pendencias = pendenciasDeRevisao(rota, (id) => nomeDestino.get(id));
  const periodoOk = !!rota.turno && !!rota.periodoConfirmado;
  const pode = podeFinalizar(rota, veiculo) && periodoOk;
  const cap = capacidadeAlunos(rota, veiculo), pico = picoOcupacao(rota);
  const ultimaEscola = [...paradas].reverse().find((p) => p.tipo === 'escola');
  const sugestaoFinal = ida && rota.ultimoDesembarqueMin == null ? ultimaEscola?.limiteChegadaMin ?? null : null;
  const plano = planejamento.plano?.valido ? planejamento.plano : null;
  const corrigir = (alvo: { paradaId?: string; alunoId?: string }) => (alvo.alunoId ? onAluno(alvo.alunoId) : alvo.paradaId ? onAbrir(alvo.paradaId) : undefined);

  return (
    <Quadro titulo="Revisão da rota" icone={<Flag className="h-5 w-5" />} texto="Confira tudo antes de concluir. Toque em “Corrigir” para ir direto ao ponto."
      rodape={<div className="space-y-2">
        {!pode && <p className="text-center text-xs font-semibold text-amber-800">{!periodoOk ? 'Confirme o período escolar (em Dados) para concluir.' : 'Resolva os avisos em vermelho para concluir.'}</p>}
        <BotaoPrincipal disabled={!pode || salvando !== null} onClick={onConcluir}>{salvando === 'concluida' ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />} Concluir rota</BotaoPrincipal>
        <button type="button" disabled={salvando !== null} onClick={onRascunho} className="w-full py-1 text-center text-sm font-bold text-neutral-700 underline disabled:opacity-50">Salvar e continuar depois</button>
      </div>}>

      {/* Avisos que impedem concluir (regras de sempre) */}
      {problemas.length > 0 && (
        <ul className="space-y-1.5" data-testid="avisos-rota">
          {problemas.map((p, i) => (
            <li key={i} className="flex items-center gap-2 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-800">
              <AlertCircle className="h-5 w-5 shrink-0" /><span className="min-w-0 flex-1">{p.mensagem}</span>
              {(p.paradaId || p.alunoId) && <button type="button" onClick={() => corrigir(p)} className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-extrabold ring-1 ring-red-200">Corrigir</button>}
              {p.tipo === 'sem_passageiros' && <button type="button" onClick={() => onIr('paradas')} className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-extrabold ring-1 ring-red-200">Corrigir</button>}
            </li>
          ))}
        </ul>
      )}

      {/* Horários da rota */}
      <div className="rounded-2xl bg-neutral-50 p-3.5 ring-1 ring-neutral-200">
        <p className="flex items-center gap-1.5 text-[15px] font-bold"><Clock className="h-4 w-4" /> Horários da rota</p>
        <div className="mt-2.5 grid grid-cols-2 gap-3">
          <CampoHora rotulo={ida ? 'Deixar o último aluno até' : 'Última entrega até'} valor={rota.ultimoDesembarqueMin} onChange={(m) => setRota({ ...rota, ultimoDesembarqueMin: m })} dica="Limite do ponto final." />
          <CampoMinutos rotulo="Pode sair antes? Quanto?" valor={rota.limiteAntecipacaoMin} onChange={(m) => setRota({ ...rota, limiteAntecipacaoMin: m })} dica="0 = não. Vazio = não informei." />
        </div>
        {sugestaoFinal != null && (
          <button type="button" onClick={() => setRota({ ...rota, ultimoDesembarqueMin: sugestaoFinal })} className="mt-2 rounded-full bg-black px-3.5 py-2 text-xs font-extrabold text-mint-400">
            Usar o limite da última escola ({horaDoCampo(sugestaoFinal)})
          </button>
        )}
        {plano ? (
          <p className="mt-2.5 rounded-xl bg-mint-100 p-2.5 text-sm text-black">
            Previsto pelo VanBora: sair às <strong>{horaDoCampo(Math.round(plano.saida ?? 0))}</strong>
            {rota.saidaHabitualMin != null && <> · você informou saída às <strong>{horaDoCampo(rota.saidaHabitualMin)}</strong></>}.
            {plano.alertas.length > 0 && <span className="mt-1 block text-xs text-amber-800">{plano.alertas.join(' · ')}</span>}
          </p>
        ) : (
          <p className="mt-2.5 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-900">Horários previstos ainda não calculados. {planejamento.dadosFaltantes.slice(0, 2).join(' ')}</p>
        )}
      </div>

      {/* Ordem das paradas */}
      <div>
        <Rotulo dica={`${rota.passageiros.length} aluno(s) · maior lotação ${pico} de ${cap} lugares para alunos${veiculo && pico > cap ? ' — acima da capacidade!' : ''}`}>Ordem das paradas</Rotulo>
        <ol className="divide-y divide-neutral-100 rounded-2xl ring-1 ring-neutral-200">
          {paradas.map((p) => {
            const r = resumoDaParada(rota, p, nomeEscola);
            const prev = previsto.get(p.id);
            const alunos = p.tipo === 'casa' ? alunosDaCasa(rota, p.id) : [];
            const i = paradas.filter((x) => x.tipo !== 'saida' && x.ordem <= p.ordem).length;
            return (
              <li key={p.id}>
                <button type="button" onClick={() => onAbrir(p.id)} className="flex w-full items-center gap-2.5 p-2.5 text-left">
                  <span className={cn('grid h-7 w-7 shrink-0 place-items-center text-xs font-extrabold', p.tipo === 'casa' ? 'rounded-full bg-mint-400 text-black' : 'rounded-lg bg-black text-mint-400')}>{p.tipo === 'saida' ? <Home className="h-3.5 w-3.5" /> : p.tipo === 'escola' ? <GraduationCap className="h-4 w-4" /> : i}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{r.titulo}</span>
                    <span className="block truncate text-[11px] text-neutral-500">
                      {p.tipo === 'casa' ? alunos.map((x) => `${ida ? 'embarque' : 'desembarque'} ${textoDuracao(x.atendimentoMin)}`).join(' · ') : p.tipo === 'escola' ? `parada ${textoDuracao(p.atendimentoGrupoMin)}` : r.sub}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-[11px] leading-tight tabular-nums">
                    <span className="block font-extrabold text-black">{r.habitual != null ? horaDoCampo(r.habitual) : '—'} <span className="font-medium text-neutral-500">{p.tipo === 'escola' ? (ida ? 'limite' : 'liberação') : 'habitual'}</span></span>
                    <span className="block text-neutral-500">{prev != null ? `${horaDoCampo(Math.round(prev))} previsto` : 'previsto —'}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Escolas aceitas — seção separada */}
      <div>
        <Rotulo dica="Não são paradas: só indicam o que você aceita incluir.">Escolas que você aceita incluir</Rotulo>
        <div className="flex items-center gap-2 rounded-2xl bg-neutral-50 p-3 text-sm ring-1 ring-neutral-200">
          <Users className="h-4 w-4 shrink-0 text-neutral-500" />
          <span className="min-w-0 flex-1">
            {(rota.escolasDisponiveis ?? []).length
              ? listar((rota.escolasDisponiveis ?? []).map((e) => nomeDestinoParaExibicao(nomeDestino.get(e.destinoId) ?? 'Escola')))
              : rota.disponibilidadeRevisada ? 'Nenhuma outra escola nesta rota.' : 'Ainda não informado.'}
          </span>
          <button type="button" onClick={() => onIr('escolas')} className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-extrabold ring-1 ring-neutral-300">Alterar</button>
        </div>
      </div>

      {/* O que ainda falta informar — não impede concluir */}
      {pendencias.length > 0 && (
        <div className="rounded-2xl bg-amber-50 p-3.5 text-amber-900" data-testid="pendencias-rota">
          <p className="flex items-center gap-1.5 text-[15px] font-bold"><AlertCircle className="h-4 w-4" /> Ainda falta informar</p>
          <p className="text-xs">Não preenchemos nada por conta própria. Dá para concluir e completar depois.</p>
          <ul className="mt-2 space-y-1.5">
            {pendencias.map((p, i) => (
              <li key={`${p.alvo}-${p.id ?? i}`} className="flex items-start gap-2 text-xs">
                <span className="min-w-0 flex-1"><strong>{p.titulo}:</strong> {p.faltas.join('; ')}.</span>
                <button type="button" className="shrink-0 rounded-full bg-white px-2.5 py-1 font-extrabold ring-1 ring-amber-300"
                  onClick={() => (p.alvo === 'rota' ? onIr('dados') : p.alvo === 'aluno' && p.id ? onAluno(p.id) : p.id && rota.paradas.some((x) => x.id === p.id) ? onAbrir(p.id) : onIr('escolas'))}>Corrigir</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tempo de deslocamento entre paradas (ajuste manual, como sempre) */}
      {paradas.length >= 2 && (
        <details className="rounded-2xl bg-neutral-50 p-3.5 ring-1 ring-neutral-200 [&_.card]:mt-2 [&_.card]:p-0 [&_.card]:shadow-none [&_.card]:ring-0 [&_.card]:bg-transparent">
          <summary className="cursor-pointer text-[15px] font-bold">Tempo de deslocamento entre as paradas <span className="text-xs font-normal text-neutral-500">(calculado pelo mapa; ajuste se quiser)</span></summary>
          <PlanoMotor rota={rota} setRota={setRota} veiculo={veiculo} />
        </details>
      )}
    </Quadro>
  );
}
