import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowUp, ArrowUpLeft, ArrowUpRight, Check, CheckCircle2, CornerUpLeft, CornerUpRight,
  Crosshair, Flag, Home, Loader2, MapPin, Navigation, Play, RefreshCw, Route as RouteIcon, School,
  Undo2, UserX, Users, Volume2, VolumeX, type LucideIcon,
} from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ExigirMotorista } from './MotoristaShell';
import { obterRota, listarVeiculos } from '@/data/motorista-store';
import { enviarPendentes, finalizarViagem, iniciarViagem, registrarEvento, rotaDaViagem, viagemSimulada } from '@/data/viagem-store';
import { capacidadeAlunos } from '@/lib/ocupacao-rota';
import {
  buscarGuia, falaManobra, metros, pontoEm, projetarNaRota, proximaManobra, segundosAteFimDaPerna,
  setaDaManobra, textoDistancia, textoDuracao, textoManobra, type Guia, type LatLng, type Seta,
} from '@/lib/navegacao';
import type { Rota, Veiculo, ParadaRota, PassageiroRota } from '@/types/motorista';
import { MapaGPS } from '@/components/motorista/MapaGPS';
import { cn, nomeDestinoParaExibicao } from '@/lib/utils';

type Fase = 'pronta' | 'a_caminho' | 'aguardando' | 'finalizada';
type Marca = 'embarcou' | 'faltou';
interface PosicaoVan { ponto: LatLng; rumo: number; metros: number | null }
/** Trajeto em uso: a perna 0 termina na parada `primeiraParada`. */
interface Trajeto { guia: Guia; primeiraParada: number }
interface Cena { tipo: 'embarque' | 'desembarque'; local: 'casa' | 'escola' | 'saida'; nomes: string[] }

const PERTO_M = 45;        // a esta distância da parada o "Cheguei" começa a chamar
const FORA_DA_ROTA_M = 50; // desvio que conta como "saiu da rota"
const VELOCIDADE_SIMULADA = 16; // m/s na simulação (demonstração, sem GPS)

const ICONE_SETA: Record<Seta, LucideIcon> = {
  esquerda: CornerUpLeft, direita: CornerUpRight, 'leve-esquerda': ArrowUpLeft, 'leve-direita': ArrowUpRight,
  frente: ArrowUp, retorno: Undo2, rotatoria: RefreshCw, chegada: MapPin,
};
const ICONE_PARADA: Record<ParadaRota['tipo'], LucideIcon> = { casa: Home, escola: School, saida: Flag };

const nomeAluno = (p: PassageiroRota) => p.identificacao || 'Aluno';
const listar = (nomes: string[]) => (nomes.length <= 1 ? nomes.join('') : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`);
const pontoDa = (p: ParadaRota): LatLng => [p.lat as number, p.lng as number];
const relogio = (seg: number) => `${String(Math.floor(seg / 60)).padStart(2, '0')}:${String(seg % 60).padStart(2, '0')}`;
const horaDe = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

function nomeParada(parada: ParadaRota | undefined, alunos: PassageiroRota[] = []): string {
  if (!parada) return 'Próxima parada';
  if (parada.tipo === 'escola') return nomeDestinoParaExibicao(parada.destinoNome || parada.rotulo || 'Escola');
  if (parada.tipo === 'casa' && alunos.length) return `Casa de ${listar(alunos.map(nomeAluno))}`;
  return parada.rotulo || (parada.tipo === 'saida' ? 'Saída' : 'Casa do aluno');
}

/** Voz do aparelho (sem serviço externo). Fala só a instrução mais recente. */
function falar(texto: string, mudo: boolean) {
  if (mudo || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const fala = new SpeechSynthesisUtterance(texto);
    fala.lang = 'pt-BR';
    fala.rate = 1.05;
    window.speechSynthesis.speak(fala);
  } catch { /* voz indisponível: a tela continua mostrando a instrução */ }
}

/* Viagem em andamento guardada no aparelho: recarregar a página no meio da
 * rota não apaga quem está a bordo nem abre uma viagem nova. */
interface Guardado {
  /** Rota como estava SALVA quando a viagem começou: é ela que a viagem segue
   *  até o fim, mesmo que a rota seja editada (ou um encaixe simulado) depois. */
  rota?: Rota;
  viagemId: string; fase: Fase; indiceAlvo: number; aBordo: string[]; entregues: string[]; faltas: string[]; chegadaEm: string | null; iniciadaEm: string; salvoEm: number }
const chaveGuardada = (rotaId: string) => `vambora.navegacao.${rotaId}`;
function lerGuardado(rotaId: string): Guardado | null {
  try {
    const g = JSON.parse(localStorage.getItem(chaveGuardada(rotaId)) ?? 'null') as Guardado | null;
    return g && g.fase !== 'finalizada' && g.fase !== 'pronta' && Date.now() - g.salvoEm < 6 * 3600_000 ? g : null;
  } catch { return null; }
}

function NavegacaoProtegida() {
  const { id } = useParams();
  const [busca] = useSearchParams();
  const [rota, setRota] = useState<Rota | null>(null);
  const [veiculo, setVeiculo] = useState<Veiculo | null>(null);
  const [trajeto, setTrajeto] = useState<Trajeto | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  // A rota salva mudou depois que esta viagem começou (a viagem segue a sequência do início).
  const [rotaAlterada, setRotaAlterada] = useState(false);

  const [fase, setFase] = useState<Fase>('pronta');
  const [indiceAlvo, setIndiceAlvo] = useState(0);
  const [aBordoIds, setABordoIds] = useState<string[]>([]);
  const [entreguesIds, setEntreguesIds] = useState<string[]>([]);
  const [faltasIds, setFaltasIds] = useState<string[]>([]);
  const [marcas, setMarcas] = useState<Record<string, Marca>>({});
  const [chegadaEm, setChegadaEm] = useState<Date | null>(null);
  const [iniciadaEm, setIniciadaEm] = useState<Date | null>(null);
  const [terminadaEm, setTerminadaEm] = useState<Date | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const [cena, setCena] = useState<Cena | null>(null);

  const [van, setVan] = useState<PosicaoVan | null>(null);
  const [gps, setGps] = useState<'desligado' | 'procurando' | 'ativo' | 'indisponivel'>('desligado');
  const [simulando, setSimulando] = useState(busca.get('simular') === '1');
  const [recalculando, setRecalculando] = useState(false);
  const [seguir, setSeguir] = useState(true);
  const [mudo, setMudo] = useState(false);

  const viagemId = useRef<string | null>(null);
  const posicaoReal = useRef<LatLng | null>(null);
  const foraDaRota = useRef(0);
  const falados = useRef(new Set<string>());
  const versaoTrajeto = useRef(0);
  const mudoRef = useRef(mudo);
  mudoRef.current = mudo;

  /* ------------------------------ carregamento ------------------------------ */
  useEffect(() => {
    let vivo = true;
    (async () => {
      if (!id) { setErro('Rota não informada.'); setCarregando(false); return; }
      try {
        const [salva, veiculos] = await Promise.all([obterRota(id), listarVeiculos().catch(() => [] as Veiculo[])]);
        if (!salva) throw new Error('Esta rota não está disponível para o motorista conectado.');
        // Viagem em andamento: segue a sequência com que COMEÇOU, não a que está
        // salva agora. Edição feita no meio do caminho vale da próxima viagem em diante.
        const guardado = lerGuardado(salva.id);
        const { rota: r, alterada } = rotaDaViagem(guardado?.rota, salva);
        if (vivo) setRotaAlterada(alterada);
        const ordenadas = [...r.paradas].sort((a, b) => a.ordem - b.ordem);
        if (ordenadas.length < 2) throw new Error('A rota precisa ter pelo menos duas paradas.');
        const semPonto = ordenadas.find((p) => !Number.isFinite(p.lat) || !Number.isFinite(p.lng));
        if (semPonto) throw new Error(`A parada "${semPonto.rotulo || 'sem nome'}" ainda não está marcada no mapa. Abra a rota e confirme o endereço.`);
        const guia = await buscarGuia(ordenadas.map((p) => ({ lat: p.lat as number, lng: p.lng as number })));
        if (!guia) throw new Error('Não foi possível calcular o trajeto pelas ruas. Confira a internet e tente de novo.');
        if (!vivo) return;
        setRota(r);
        setVeiculo(veiculos.find((v) => v.id === r.veiculoId) ?? null);
        setTrajeto({ guia, primeiraParada: 1 });
        // A saída da van, sem aluno, não é parada de operação: o alvo já é a seguinte.
        const primeira = ordenadas[0];
        const temGente = r.passageiros.some((x) => x.embarqueParadaId === primeira.id || x.desembarqueParadaId === primeira.id);
        if (guardado) {
          viagemId.current = guardado.viagemId;
          setIndiceAlvo(guardado.indiceAlvo); setABordoIds(guardado.aBordo); setEntreguesIds(guardado.entregues); setFaltasIds(guardado.faltas);
          setChegadaEm(guardado.chegadaEm ? new Date(guardado.chegadaEm) : null); setIniciadaEm(new Date(guardado.iniciadaEm));
          setFase(guardado.fase);
          setGps('procurando');
        } else {
          setIndiceAlvo(primeira.tipo === 'saida' && !temGente ? 1 : 0);
        }
        void enviarPendentes();
      } catch (e) {
        if (vivo) setErro((e as Error).message || 'Não foi possível carregar a rota.');
      } finally { if (vivo) setCarregando(false); }
    })();
    return () => { vivo = false; };
  }, [id]);

  const paradas = useMemo(() => [...(rota?.paradas ?? [])].sort((a, b) => a.ordem - b.ordem), [rota]);
  const paradaAlvo = paradas[indiceAlvo];
  const capacidade = rota ? capacidadeAlunos(rota, veiculo) : 0;
  const aBordo = useMemo(() => rota?.passageiros.filter((p) => aBordoIds.includes(p.id)) ?? [], [rota, aBordoIds]);

  /** Quem embarca e quem desce numa parada, considerando quem já faltou. */
  const movimentoEm = useCallback((parada: ParadaRota | undefined, bordo = aBordoIds, entregues = entreguesIds, faltas = faltasIds) => {
    if (!rota || !parada) return { entrando: [] as PassageiroRota[], saindo: [] as PassageiroRota[] };
    return {
      entrando: rota.passageiros.filter((p) => p.embarqueParadaId === parada.id && !bordo.includes(p.id) && !entregues.includes(p.id) && !faltas.includes(p.id)),
      saindo: rota.passageiros.filter((p) => p.desembarqueParadaId === parada.id && bordo.includes(p.id)),
    };
  }, [rota, aBordoIds, entreguesIds, faltasIds]);
  const { entrando, saindo } = useMemo(() => movimentoEm(paradaAlvo), [movimentoEm, paradaAlvo]);
  const alunosDaParada = useMemo(() => [...saindo, ...entrando], [saindo, entrando]);
  const tituloAlvo = nomeParada(paradaAlvo, paradaAlvo?.tipo === 'casa' ? alunosDaParada : []);

  /* --------------------------- posição ao longo da rota --------------------------- */
  const guia = trajeto?.guia ?? null;
  const pernaAlvo = trajeto ? indiceAlvo - trajeto.primeiraParada : -1;
  const posicaoVan: PosicaoVan | null = useMemo(() => {
    if (!guia) return null;
    if (van) return van;
    const inicio = pontoEm(guia, 0);
    return { ponto: inicio.ponto, rumo: inicio.rumo, metros: 0 };
  }, [guia, van]);
  const metrosNaRota = posicaoVan?.metros ?? 0;
  const perna = guia?.pernas[pernaAlvo];
  const faltaM = !paradaAlvo ? 0 : perna ? Math.max(0, perna.fimM - metrosNaRota) : pernaAlvo < 0 ? 0 : null;
  const distanciaReta = paradaAlvo && posicaoVan ? metros(posicaoReal.current ?? posicaoVan.ponto, pontoDa(paradaAlvo)) : Infinity;
  const perto = fase === 'a_caminho' && ((faltaM != null && faltaM <= PERTO_M) || distanciaReta <= PERTO_M);
  const proxima = guia && fase === 'a_caminho' && pernaAlvo >= 0 ? proximaManobra(guia, metrosNaRota, pernaAlvo) : null;
  const segundosRestantes = guia && pernaAlvo >= 0 ? segundosAteFimDaPerna(guia, pernaAlvo, metrosNaRota) : 0;

  /** Recalcula o trajeto da posição informada até as paradas que faltam. */
  const recalcular = useCallback(async (origem: LatLng, aPartirDe: number) => {
    const restantes = paradas.slice(aPartirDe);
    if (!restantes.length) return;
    setRecalculando(true);
    const novo = await buscarGuia([{ lat: origem[0], lng: origem[1] }, ...restantes.map((p) => ({ lat: p.lat as number, lng: p.lng as number }))]);
    setRecalculando(false);
    if (!novo) return; // sem internet: segue com o trajeto que já tinha
    versaoTrajeto.current += 1;
    foraDaRota.current = 0;
    setTrajeto({ guia: novo, primeiraParada: aPartirDe });
    setVan({ ponto: origem, rumo: pontoEm(novo, 0).rumo, metros: 0 });
  }, [paradas]);

  /* ---------------------------------- GPS ---------------------------------- */
  const navegando = fase === 'a_caminho' || fase === 'aguardando';
  const estado = useRef({ guia, fase, indiceAlvo, metrosNaRota, recalculando, simulando });
  estado.current = { guia, fase, indiceAlvo, metrosNaRota, recalculando, simulando };

  useEffect(() => {
    if (!navegando || simulando) return;
    if (!('geolocation' in navigator)) { setGps('indisponivel'); return; }
    setGps((g) => (g === 'ativo' ? g : 'procurando'));
    const acompanhar = navigator.geolocation.watchPosition(
      (leitura) => {
        const e = estado.current;
        const real: LatLng = [leitura.coords.latitude, leitura.coords.longitude];
        posicaoReal.current = real;
        setGps('ativo');
        if (!e.guia) return;
        if (e.fase !== 'a_caminho') { setVan((v) => ({ ponto: real, rumo: v?.rumo ?? 0, metros: v?.metros ?? e.metrosNaRota })); return; }
        const p = projetarNaRota(e.guia, real, e.metrosNaRota);
        const preciso = (leitura.coords.accuracy ?? 0) <= 60;
        if (p.desvioM > FORA_DA_ROTA_M && preciso) foraDaRota.current += 1; else if (p.desvioM <= FORA_DA_ROTA_M) foraDaRota.current = 0;
        const naRota = p.desvioM <= FORA_DA_ROTA_M;
        setVan({ ponto: naRota ? p.ponto : real, rumo: naRota ? p.rumo : (leitura.coords.heading ?? p.rumo), metros: naRota ? p.metros : e.metrosNaRota });
        // Três leituras seguidas fora do trajeto: refaz o caminho a partir daqui.
        if (foraDaRota.current >= 3 && !e.recalculando) { foraDaRota.current = 0; void recalcular(real, e.indiceAlvo); }
      },
      () => setGps('indisponivel'),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(acompanhar);
  }, [navegando, simulando, recalcular]);

  // Demonstração sem GPS: a van percorre o trajeto sozinha até a próxima parada.
  useEffect(() => {
    if (!simulando || fase !== 'a_caminho' || !guia || !perna) return;
    const passo = window.setInterval(() => {
      setVan((v) => {
        const m = Math.min(perna.fimM, (v?.metros ?? perna.inicioM) + VELOCIDADE_SIMULADA * 0.12 * 4);
        const p = pontoEm(guia, m);
        return { ponto: p.ponto, rumo: p.rumo, metros: m };
      });
    }, 120);
    return () => window.clearInterval(passo);
  }, [simulando, fase, guia, perna]);

  // Tela sempre acesa durante a navegação (o navegador devolve o bloqueio ao voltar para a aba).
  useEffect(() => {
    if (!navegando) return;
    type Trava = { release: () => Promise<void> };
    let trava: Trava | null = null;
    const pedir = () => {
      (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Trava> } }).wakeLock
        ?.request('screen').then((t) => { trava = t; }).catch(() => {});
    };
    const aoVoltar = () => { if (document.visibilityState === 'visible') pedir(); };
    pedir();
    document.addEventListener('visibilitychange', aoVoltar);
    return () => { document.removeEventListener('visibilitychange', aoVoltar); void trava?.release().catch(() => {}); };
  }, [navegando]);

  /* ---------------------------------- voz ---------------------------------- */
  useEffect(() => {
    if (!proxima) return;
    const chave = `${versaoTrajeto.current}:${proxima.manobra.metros.toFixed(0)}`;
    const destino = proxima.manobra.tipo === 'arrive' ? tituloAlvo : undefined;
    const etapa = proxima.distanciaM <= 40 ? 'agora' : proxima.distanciaM <= 300 ? 'antes' : null;
    if (!etapa || falados.current.has(`${chave}:${etapa}`)) return;
    // Manobra já em cima: não anuncia o "em 300 metros" atrasado.
    if (etapa === 'antes' && proxima.distanciaM < 90) return;
    falados.current.add(`${chave}:${etapa}`);
    falar(falaManobra(proxima.manobra, proxima.distanciaM, destino), mudoRef.current);
  }, [proxima, tituloAlvo]);

  // Cronômetro da espera e do tempo de viagem.
  useEffect(() => {
    if (fase !== 'aguardando') return;
    setAgora(Date.now());
    const t = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [fase]);

  // Guarda a viagem em andamento no aparelho.
  useEffect(() => {
    if (!rota || !viagemId.current || !iniciadaEm) return;
    if (fase === 'finalizada') { try { localStorage.removeItem(chaveGuardada(rota.id)); } catch { /* ignora */ } return; }
    const g: Guardado = { rota, viagemId: viagemId.current, fase, indiceAlvo, aBordo: aBordoIds, entregues: entreguesIds, faltas: faltasIds, chegadaEm: chegadaEm?.toISOString() ?? null, iniciadaEm: iniciadaEm.toISOString(), salvoEm: Date.now() };
    try { localStorage.setItem(chaveGuardada(rota.id), JSON.stringify(g)); } catch { /* ignora */ }
  }, [rota, fase, indiceAlvo, aBordoIds, entreguesIds, faltasIds, chegadaEm, iniciadaEm]);

  /* --------------------------------- ações --------------------------------- */
  function iniciarRota() {
    if (!rota || !guia || !paradaAlvo) return;
    const inicio = new Date();
    // Percurso de simulação (sem GPS) não entra no histórico de viagens.
    viagemId.current = iniciarViagem(rota, inicio, { simulada: simulando });
    setIniciadaEm(inicio);
    setSeguir(true);
    setFase('a_caminho');
    falar(`Rota iniciada. Seguindo para ${tituloAlvo}.`, mudo);
    // Com GPS: o caminho começa de onde o motorista está, não da primeira parada.
    if (simulando || !('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition((leitura) => {
      const real: LatLng = [leitura.coords.latitude, leitura.coords.longitude];
      posicaoReal.current = real;
      if (metros(real, pontoDa(paradaAlvo)) > 80) void recalcular(real, indiceAlvo);
    }, () => setGps('indisponivel'), { enableHighAccuracy: true, timeout: 10000 });
  }

  function cheguei() {
    if (!paradaAlvo || !viagemId.current) return;
    const hora = new Date();
    registrarEvento(viagemId.current, { tipo: 'chegada', parada: paradaAlvo, em: hora, posicao: posicaoReal.current });
    setChegadaEm(hora);
    setMarcas(Object.fromEntries(entrando.map((p) => [p.id, 'embarcou' as Marca])));
    setFase('aguardando');
    const partes = [
      entrando.length ? `Aguardando o embarque de ${listar(entrando.map(nomeAluno))}` : '',
      saindo.length ? `${listar(saindo.map(nomeAluno))} ${saindo.length > 1 ? 'descem' : 'desce'} aqui` : '',
    ].filter(Boolean);
    falar(partes.join('. ') || 'Parada registrada.', mudo);
  }

  function confirmarParada() {
    if (!rota || !paradaAlvo || !viagemId.current) return;
    const hora = new Date();
    const esperaSeg = chegadaEm ? (hora.getTime() - chegadaEm.getTime()) / 1000 : undefined;
    const base = { parada: paradaAlvo, em: hora, esperaSeg, posicao: posicaoReal.current };
    const embarcaram = entrando.filter((p) => marcas[p.id] !== 'faltou');
    const faltaram = entrando.filter((p) => marcas[p.id] === 'faltou');
    saindo.forEach((aluno) => registrarEvento(viagemId.current!, { ...base, tipo: 'desembarque', aluno }));
    embarcaram.forEach((aluno) => registrarEvento(viagemId.current!, { ...base, tipo: 'embarque', aluno }));
    faltaram.forEach((aluno) => registrarEvento(viagemId.current!, { ...base, tipo: 'falta', aluno }));

    const bordo = [...aBordoIds.filter((x) => !saindo.some((p) => p.id === x)), ...embarcaram.map((p) => p.id)];
    const entregues = [...new Set([...entreguesIds, ...saindo.map((p) => p.id)])];
    const faltas = [...new Set([...faltasIds, ...faltaram.map((p) => p.id)])];
    setABordoIds(bordo); setEntreguesIds(entregues); setFaltasIds(faltas);
    setChegadaEm(null);

    // Próxima parada com alguém para embarcar ou descer (pula casa de quem faltou).
    let proximo = indiceAlvo + 1;
    while (proximo < paradas.length) {
      const mov = movimentoEm(paradas[proximo], bordo, entregues, faltas);
      if (mov.entrando.length || mov.saindo.length) break;
      proximo += 1;
    }
    const acabou = proximo >= paradas.length;
    const seguirViagem = () => {
      setCena(null);
      if (acabou) {
        finalizarViagem(viagemId.current!, new Date());
        setTerminadaEm(new Date());
        setFase('finalizada');
        falar('Rota concluída.', mudoRef.current);
        return;
      }
      const pulou = proximo !== indiceAlvo + 1;
      setIndiceAlvo(proximo);
      setSeguir(true);
      setFase('a_caminho');
      const mov = movimentoEm(paradas[proximo], bordo, entregues, faltas);
      falar(`Seguindo para ${nomeParada(paradas[proximo], paradas[proximo].tipo === 'casa' ? [...mov.saindo, ...mov.entrando] : [])}.`, mudoRef.current);
      // Parada pulada ou trajeto que não cobre a próxima: refaz a partir daqui.
      const coberto = trajeto && proximo - trajeto.primeiraParada < trajeto.guia.pernas.length && proximo >= trajeto.primeiraParada;
      if (pulou || !coberto) void recalcular(posicaoReal.current ?? pontoDa(paradaAlvo), proximo);
      else if (trajeto && simulando) {
        const inicioPerna = trajeto.guia.pernas[proximo - trajeto.primeiraParada].inicioM;
        const p = pontoEm(trajeto.guia, inicioPerna);
        setVan({ ponto: p.ponto, rumo: p.rumo, metros: inicioPerna });
      }
    };
    const movidos = saindo.length ? saindo : embarcaram;
    if (!movidos.length) { seguirViagem(); return; }
    setCena({ tipo: saindo.length ? 'desembarque' : 'embarque', local: paradaAlvo.tipo, nomes: movidos.map(nomeAluno) });
    window.setTimeout(seguirViagem, 1500 + movidos.length * 350);
  }

  /* --------------------------------- telas --------------------------------- */
  if (carregando) return <div className="flex min-h-dvh items-center justify-center bg-navy-950 text-white"><Loader2 className="h-7 w-7 animate-spin" /></div>;
  if (erro || !rota || !guia || !posicaoVan) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-navy-950 p-4">
        <div className="card max-w-md p-7 text-center">
          <RouteIcon className="mx-auto h-10 w-10 text-navy-300" />
          <h1 className="mt-4 font-display text-xl font-bold text-navy-900">Não foi possível abrir a rota</h1>
          <p className="mt-2 text-sm text-navy-600">{erro}</p>
          <Link to="/app/rotas" className="btn btn-lg btn-primary mt-6 w-full">Voltar para minhas rotas</Link>
        </div>
      </div>
    );
  }

  const IconeAlvo = paradaAlvo ? ICONE_PARADA[paradaAlvo.tipo] : MapPin;
  const esperaSeg = chegadaEm ? Math.max(0, Math.floor((agora - chegadaEm.getTime()) / 1000)) : 0;
  const descemNoAlvo = fase === 'a_caminho' ? saindo.map(nomeAluno) : [];
  const SetaProxima = proxima ? ICONE_SETA[setaDaManobra(proxima.manobra)] : Navigation;
  const embarcamAgora = entrando.filter((p) => marcas[p.id] !== 'faltou').length;
  const textoConfirmar = saindo.length && entrando.length ? 'Confirmar desembarque e embarque'
    : saindo.length ? `Confirmar desembarque${saindo.length > 1 ? ` (${saindo.length})` : ''}`
    : entrando.length ? (embarcamAgora ? `Confirmar embarque${embarcamAgora > 1 ? ` (${embarcamAgora})` : ''}` : 'Seguir sem embarque')
    : 'Seguir viagem';

  return (
    <div className="relative h-dvh overflow-hidden bg-navy-950 text-white" data-fase={fase}>
      <div className="absolute inset-0">
        <MapaGPS guia={guia} paradas={paradas} indiceAlvo={fase === 'finalizada' ? paradas.length : indiceAlvo} van={posicaoVan}
          descem={descemNoAlvo} seguir={seguir} onSoltar={() => setSeguir(false)} visaoGeral={fase === 'pronta' || fase === 'finalizada'} />
      </div>

      {/* Topo: instrução da próxima manobra (ou o nome da rota antes de sair). */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] p-3 sm:p-4">
        <div className="pointer-events-auto mx-auto flex max-w-xl items-center gap-3 rounded-3xl bg-navy-950/95 p-3 shadow-2xl ring-1 ring-white/10 backdrop-blur" role="status" aria-live="polite" data-testid="instrucao">
          {fase === 'a_caminho' ? (
            <>
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-mint-400 text-navy-950">{recalculando ? <Loader2 className="h-7 w-7 animate-spin" /> : <SetaProxima className="h-8 w-8" strokeWidth={2.6} />}</span>
              <div className="min-w-0 flex-1">
                {recalculando ? <p className="font-display text-lg font-extrabold">Recalculando a rota…</p> : proxima ? (
                  <>
                    <p className="font-display text-2xl font-extrabold leading-none tabular-nums">{textoDistancia(proxima.distanciaM)}</p>
                    <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-white/85">{proxima.manobra.tipo === 'arrive' ? `Chegando: ${tituloAlvo}` : textoManobra(proxima.manobra)}</p>
                  </>
                ) : <p className="font-display text-lg font-extrabold leading-tight">{perto ? `Você está em: ${tituloAlvo}` : `Siga para ${tituloAlvo}`}</p>}
              </div>
            </>
          ) : (
            <>
              <Link to={`/app/rotas/${rota.id}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/10 text-white hover:bg-white/20" aria-label="Voltar para a rota"><ArrowLeft className="h-5 w-5" /></Link>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-mint-300">{fase === 'finalizada' ? 'Rota concluída' : fase === 'aguardando' ? 'Parada' : rota.sentido === 'ida' ? 'Rota de ida' : 'Rota de volta'}</p>
                <p className="truncate font-display text-base font-extrabold">{fase === 'aguardando' ? tituloAlvo : rota.nome || 'Rota do motorista'}</p>
              </div>
            </>
          )}
          <button type="button" onClick={() => { setMudo((m) => !m); if (!mudo) window.speechSynthesis?.cancel(); }} aria-pressed={mudo} aria-label={mudo ? 'Ligar a voz' : 'Desligar a voz'}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/10 text-white hover:bg-white/20">{mudo ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}</button>
        </div>
        {rotaAlterada && (
          <p role="status" data-testid="rota-alterada" className="pointer-events-auto mx-auto mt-2 max-w-xl rounded-2xl bg-amber-400 px-3 py-2 text-xs font-bold text-navy-950 shadow-lg">
            Esta rota foi alterada depois que a viagem começou. A viagem em andamento segue a sequência do início; a alteração vale a partir da próxima viagem.
          </p>
        )}
        {navegando && viagemSimulada(viagemId.current) && (
          <p role="status" data-testid="viagem-simulada" className="pointer-events-auto mx-auto mt-2 max-w-xl rounded-2xl bg-white px-3 py-2 text-xs font-bold text-navy-900 shadow-lg">
            Simulação de percurso: nada desta viagem é gravado no histórico.
          </p>
        )}
        {navegando && (
          <div className="pointer-events-auto mx-auto mt-2 flex max-w-xl items-start justify-between gap-2">
            <span className={cn('rounded-full px-3 py-1.5 text-[11px] font-bold shadow-lg', simulando ? 'bg-white text-navy-900' : gps === 'ativo' ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-navy-950')} data-testid="gps">
              {simulando ? 'Simulação (sem GPS)' : gps === 'ativo' ? 'GPS conectado' : gps === 'indisponivel' ? 'GPS indisponível' : 'Procurando GPS…'}
            </span>
            <div className="flex flex-col items-end gap-2">
              {!seguir && <button type="button" onClick={() => setSeguir(true)} className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-3 text-xs font-bold text-navy-900 shadow-lg"><Crosshair className="h-4 w-4" /> Centralizar</button>}
              {gps === 'indisponivel' && !simulando && <button type="button" onClick={() => setSimulando(true)} className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-3 text-xs font-bold text-navy-900 shadow-lg"><Play className="h-4 w-4" /> Simular percurso</button>}
            </div>
          </div>
        )}
      </div>

      {/* Cena: o aluno sai da van e entra na escola/casa (ou o contrário). */}
      {cena && <CenaParada cena={cena} />}

      {/* Rodapé: quem está na van + a ação do momento. */}
      <div className="absolute inset-x-0 bottom-0 z-[1000] p-3 sm:p-4">
        <div className="mx-auto max-w-xl overflow-hidden rounded-[1.75rem] bg-white text-navy-900 shadow-2xl ring-1 ring-black/5">
          {fase !== 'pronta' && (
            <div className="flex items-center gap-2 border-b border-navy-100 bg-navy-50 px-3 py-2" data-testid="na-van">
              <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-navy-500"><Users className="h-4 w-4" /> Na van {aBordo.length}{capacidade ? `/${capacidade}` : ''}</span>
              <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
                {aBordo.length === 0 && <span className="py-1 text-xs text-navy-400">Ninguém a bordo</span>}
                {aBordo.map((p) => {
                  const desce = saindo.some((x) => x.id === p.id);
                  return (
                    <span key={p.id} className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-xs font-semibold', desce ? 'bg-blue-600 text-white' : 'bg-white text-navy-800 ring-1 ring-navy-200')}>
                      <span className={cn('grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold', desce ? 'bg-white text-blue-700' : 'bg-mint-400 text-navy-950')}>{nomeAluno(p).slice(0, 1).toUpperCase()}</span>
                      {nomeAluno(p)}{desce && <span className="text-[10px] font-bold uppercase opacity-90">desce</span>}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          <div className="p-4">
            {fase === 'pronta' && (
              <>
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-navy-900 text-white"><IconeAlvo className="h-6 w-6" /></span>
                  <div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-wide text-navy-500">Primeira parada</p><p className="truncate font-display text-lg font-extrabold">{tituloAlvo}</p></div>
                </div>
                <p className="mt-3 text-sm text-navy-600">{paradas.length} paradas · {rota.passageiros.length} aluno(s) · {textoDistancia(guia.totalM)} · cerca de {textoDuracao(guia.pernas.reduce((t, p) => t + p.segundos, 0))} de direção</p>
                <button type="button" className="btn btn-lg btn-primary mt-4 w-full" onClick={iniciarRota}><Navigation className="h-5 w-5" /> Iniciar rota</button>
              </>
            )}

            {fase === 'a_caminho' && (
              <>
                <div className="flex items-center gap-3">
                  <span className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white', paradaAlvo?.tipo === 'escola' ? 'bg-navy-900' : 'bg-emerald-500')}><IconeAlvo className="h-6 w-6" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-lg font-extrabold leading-tight">{tituloAlvo}</p>
                    <p className="truncate text-xs text-navy-500">
                      {[entrando.length ? `Embarca: ${listar(entrando.map(nomeAluno))}` : '', saindo.length ? `Desce: ${listar(saindo.map(nomeAluno))}` : ''].filter(Boolean).join(' · ') || paradaAlvo?.rotulo}
                    </p>
                  </div>
                  {faltaM != null && !perto && <div className="shrink-0 text-right"><p className="font-display text-lg font-extrabold tabular-nums leading-none">{textoDistancia(faltaM)}</p><p className="mt-1 text-xs text-navy-500">{textoDuracao(segundosRestantes)}</p></div>}
                </div>
                <button type="button" onClick={cheguei} data-testid="cheguei"
                  className={cn('btn mt-4 w-full', perto ? 'btn-lg btn-primary vb-chamar' : 'btn-md bg-navy-100 text-navy-800 hover:bg-navy-200')}>
                  <MapPin className="h-5 w-5" /> Cheguei
                </button>
              </>
            )}

            {fase === 'aguardando' && cena && (
              <p className="flex items-center gap-2 py-2 font-display text-lg font-extrabold"><CheckCircle2 className="h-6 w-6 text-emerald-500" /> Registrado às {horaDe(new Date())}</p>
            )}
            {fase === 'aguardando' && !cena && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-navy-500">{entrando.length ? 'Aguardando embarque' : saindo.length ? 'Desembarque' : 'Parada registrada'}</p>
                    <p className="text-xs text-navy-500">Chegada às {chegadaEm ? horaDe(chegadaEm) : '—'}</p>
                  </div>
                  <span className="rounded-2xl bg-navy-900 px-3 py-2 font-display text-2xl font-extrabold tabular-nums text-white" aria-label="Tempo de espera" data-testid="cronometro">{relogio(esperaSeg)}</span>
                </div>
                <ul className="mt-3 max-h-[32dvh] space-y-2 overflow-y-auto">
                  {saindo.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-blue-50 px-3 py-2.5">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-600 text-sm font-bold text-white">{nomeAluno(p).slice(0, 1).toUpperCase()}</span>
                      <span className="min-w-0 flex-1 truncate font-semibold">{nomeAluno(p)}</span>
                      <span className="text-[11px] font-bold uppercase text-blue-700">desce aqui</span>
                    </li>
                  ))}
                  {entrando.map((p) => {
                    const faltou = marcas[p.id] === 'faltou';
                    return (
                      <li key={p.id} className={cn('flex items-center gap-3 rounded-2xl px-3 py-2', faltou ? 'bg-navy-50' : 'bg-emerald-50')}>
                        <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold text-white', faltou ? 'bg-navy-300' : 'bg-emerald-500')}>{nomeAluno(p).slice(0, 1).toUpperCase()}</span>
                        <span className={cn('min-w-0 flex-1 truncate font-semibold', faltou && 'text-navy-400 line-through')}>{nomeAluno(p)}</span>
                        <button type="button" aria-pressed={faltou} onClick={() => setMarcas((m) => ({ ...m, [p.id]: faltou ? 'embarcou' : 'faltou' }))}
                          className={cn('inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-bold', faltou ? 'bg-navy-900 text-white' : 'bg-white text-navy-600 ring-1 ring-navy-200')}>
                          <UserX className="h-4 w-4" /> {faltou ? 'Não vai hoje' : 'Não embarcou'}
                        </button>
                      </li>
                    );
                  })}
                  {!alunosDaParada.length && <li className="rounded-2xl bg-navy-50 p-3 text-sm text-navy-600">Nenhum aluno nesta parada.</li>}
                </ul>
                <button type="button" className="btn btn-lg btn-primary mt-4 w-full" onClick={confirmarParada} data-testid="confirmar"><Check className="h-5 w-5" /> {textoConfirmar}</button>
              </>
            )}

            {fase === 'finalizada' && (
              <>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-10 w-10 shrink-0 text-emerald-500" />
                  <div><p className="font-display text-lg font-extrabold">Rota concluída</p>
                    <p className="text-sm text-navy-600">{iniciadaEm && terminadaEm ? `Das ${horaDe(iniciadaEm)} às ${horaDe(terminadaEm)} · ` : ''}{entreguesIds.length} entregue(s){faltasIds.length ? ` · ${faltasIds.length} não embarcou` : ''}</p></div>
                </div>
                <Link to={`/app/rotas/${rota.id}`} className="btn btn-lg btn-primary mt-4 w-full">Voltar para a rota</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Animação curta: os alunos andam entre a van e a casa/escola, um a um. */
function CenaParada({ cena }: { cena: Cena }) {
  const Local = ICONE_PARADA[cena.local];
  const desce = cena.tipo === 'desembarque';
  return (
    <div className="pointer-events-none absolute inset-x-0 top-1/3 z-[1100] flex justify-center px-6" role="status" data-testid="cena">
      <div className="w-full max-w-sm rounded-3xl bg-white/95 p-4 text-navy-900 shadow-2xl ring-1 ring-black/5 backdrop-blur">
        <p className="text-center text-xs font-bold uppercase tracking-wide text-navy-500">{desce ? (cena.nomes.length > 1 ? 'Desceram' : 'Desceu') : (cena.nomes.length > 1 ? 'Embarcaram' : 'Embarcou')}</p>
        <div className="relative mt-3 flex h-16 items-center justify-between">
          <span className={cn('grid h-14 w-14 place-items-center rounded-2xl', desce ? 'order-1 bg-mint-400 text-navy-950' : 'order-1 bg-navy-900 text-white')}>
            {desce ? <VanMini /> : <Local className="h-7 w-7" />}
          </span>
          <span className="order-2 mx-2 h-1 flex-1 rounded-full bg-[repeating-linear-gradient(90deg,#cbd5e1_0_8px,transparent_8px_14px)]" />
          <span className={cn('order-3 grid h-14 w-14 place-items-center rounded-2xl', desce ? 'bg-navy-900 text-white' : 'bg-mint-400 text-navy-950')}>
            {desce ? <Local className="h-7 w-7" /> : <VanMini />}
          </span>
          {cena.nomes.map((nome, i) => (
            <span key={`${nome}-${i}`} className="vb-cena-aluno absolute left-10 top-1/2 -mt-4 inline-flex items-center gap-1.5 rounded-full bg-blue-600 py-1 pl-1 pr-2.5 text-xs font-bold text-white shadow-lg"
              style={{ animationDelay: `${i * 350}ms`, ['--vb-cena-x' as string]: 'min(60vw, 13rem)' }}>
              <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-[11px] text-blue-700">{nome.slice(0, 1).toUpperCase()}</span>{nome}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function VanMini() {
  return (
    <svg viewBox="0 0 64 40" className="h-8 w-10" aria-hidden="true">
      <path d="M5 9a5 5 0 0 1 5-5h31c3 0 5.6 1.4 7.4 3.8L55 16.5l3.6 1.8A4.5 4.5 0 0 1 61 22.3V28a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V11a2 2 0 0 1 2-2z" fill="#facc15" stroke="#0b1f3a" strokeWidth="2.4" strokeLinejoin="round" />
      <rect x="8" y="8.5" width="9" height="8" rx="1.6" fill="#dbeafe" stroke="#0b1f3a" strokeWidth="1.6" /><rect x="20" y="8.5" width="9" height="8" rx="1.6" fill="#dbeafe" stroke="#0b1f3a" strokeWidth="1.6" /><rect x="32" y="8.5" width="9" height="8" rx="1.6" fill="#dbeafe" stroke="#0b1f3a" strokeWidth="1.6" />
      <circle cx="16" cy="31" r="5.5" fill="#0b1f3a" /><circle cx="47" cy="31" r="5.5" fill="#0b1f3a" />
    </svg>
  );
}

export function NavegacaoRotaRealPage() {
  return <ExigirMotorista><NavegacaoProtegida /></ExigirMotorista>;
}
