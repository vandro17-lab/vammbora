import type { Rota, Veiculo, ParadaRota } from '@/types/motorista';
import {
  encontrarEncaixes,
  simularRota,
  type Sentido,
  type PontoGeo,
  type Compromisso,
  type MatrizViaria,
  type RotaOperacional,
  type PedidoEncaixe,
  type PlanoCalculado,
  type OpcaoEncaixe,
} from '@/engine/encaixe-geografico';
import { capacidadeAlunos } from '@/lib/ocupacao-rota';

/**
 * Adaptador do SIMULADOR de encaixe: converte a rota real do motorista
 * (cadastro/Supabase) na entrada do motor geográfico `encaixe-geografico`,
 * usando SEMPRE uma matriz viária (tempos/distâncias de ruas, nunca linha reta).
 *
 * Não altera `src/engine/`. Não inventa tempos: se faltarem coordenadas ou um
 * trecho rodoviário, a simulação é marcada inviável, com motivo compreensível.
 *
 * Planejamento de trás para frente: a saída da van é ancorada a partir do
 * horário final da escola (ida) ou do horário permitido de saída (volta).
 */

/** Horários de referência do projeto (minutos da meia-noite). Usados só quando
 *  NÃO houver horário cadastrado na rota/escola. Margem operacional de 5 min. */
export const MARGEM_OPERACIONAL_MIN = 5;
export const TOLERANCIA_MAX_MIN = 10;
export const ATENDIMENTO_PADRAO_MIN = 1;

export const LIMITE_CHEGADA_POR_TURNO: Record<string, number> = {
  manha: 7 * 60, // 07h00
  tarde: 12 * 60 + 30, // 12h30
  noite: 19 * 60, // 19h00
};

export interface AlunoNovo {
  alunoId: string;
  nome: string;
  casa: PontoGeo;
  /** Id do destino (escola) que o novo aluno frequenta. */
  escolaId: string;
}

export interface ParametrosSimulacao {
  /** Ida: horário-limite de chegada à escola. Volta: horário permitido de saída da escola. */
  horarioEscolaMin: number;
  margemMin?: number;
  toleranciaMin?: number;
  atendimentoMin?: number;
}

export type CodigoMotivo =
  | 'localizacao'
  | 'escola_itinerario'
  | 'capacidade'
  | 'atraso'
  | 'tolerancia'
  | 'saida_cedo'
  | 'trecho'
  | 'rota_base'
  | 'aluno_duplicado'
  | 'dados';

export interface ResultadoSimulacao {
  sentido: Sentido;
  elegivel: boolean;
  opcao: OpcaoEncaixe | null;
  /** Motivos amigáveis (pt-BR) quando inviável; vazio quando viável. */
  motivos: string[];
  codigos: CodigoMotivo[];
  /** Plano da rota ATUAL (antes), para comparação; null se a base for inconsistente. */
  base: PlanoCalculado | null;
  partidaMin: number | null;
  /** Mapa id de compromisso -> nome amigável do aluno/parada. */
  nomePorCompromisso: Record<string, string>;
  escolaNoItinerario: boolean;
}

const coord = (v: number | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

function nomeParada(p: ParadaRota): string {
  if (p.tipo === 'saida') return 'Saída';
  if (p.tipo === 'escola') return p.destinoNome || p.rotulo || 'Escola';
  return p.rotulo || 'Casa';
}

/** Id do ponto geográfico de uma parada. Escola usa o id do destino (para casar
 *  com a escola do novo aluno). Demais paradas usam o id da parada. */
function idDoPonto(p: ParadaRota): string {
  return p.tipo === 'escola' && p.destinoId ? p.destinoId : p.id;
}

function pontoDeParada(p: ParadaRota): PontoGeo | null {
  if (!coord(p.lat) || !coord(p.lng)) return null;
  return { id: idDoPonto(p), nome: nomeParada(p), lat: p.lat, lng: p.lng };
}

/** Lista de pontos (sem repetição por id) necessários para a matriz viária. */
export function coletarPontos(
  rota: Rota,
  aluno: AlunoNovo,
): { pontos: PontoGeo[]; faltamCoordenadas: string[] } {
  const faltamCoordenadas: string[] = [];
  const porId = new Map<string, PontoGeo>();
  const ordenadas = [...rota.paradas].sort((a, b) => a.ordem - b.ordem);
  for (const p of ordenadas) {
    const g = pontoDeParada(p);
    if (!g) faltamCoordenadas.push(nomeParada(p));
    else if (!porId.has(g.id)) porId.set(g.id, g);
  }
  if (!porId.has(aluno.casa.id)) porId.set(aluno.casa.id, aluno.casa);
  return { pontos: [...porId.values()], faltamCoordenadas };
}

interface MontagemBase {
  inicio: PontoGeo;
  compromissos: Compromisso[];
  nomePorCompromisso: Record<string, string>;
  escolaPonto: PontoGeo | null;
}

/** Converte as paradas/passageiros em compromissos do motor (sem partida ainda). */
function montarBase(rota: Rota, sentido: Sentido, atendimento: number): MontagemBase | null {
  const ordenadas = [...rota.paradas].sort((a, b) => a.ordem - b.ordem);
  const saida = ordenadas.find((p) => p.tipo === 'saida') ?? ordenadas[0];
  if (!saida) return null;
  const inicioPonto = pontoDeParada(saida);
  if (!inicioPonto) return null;
  const sequencia = ordenadas.filter((p) => p.id !== saida.id);

  const nomePorCompromisso: Record<string, string> = {};
  const compromissos: Compromisso[] = [];
  let escolaPonto: PontoGeo | null = null;

  for (const parada of sequencia) {
    const ponto = pontoDeParada(parada);
    if (!ponto) return null;
    if (parada.tipo === 'escola' && (!escolaPonto || escolaPonto.id === ponto.id)) escolaPonto = ponto;

    const embarcam = rota.passageiros.filter((x) => x.embarqueParadaId === parada.id);
    const descem = rota.passageiros.filter((x) => x.desembarqueParadaId === parada.id);

    // Desembarques liberam lugar antes dos embarques no mesmo ponto.
    for (const pax of descem) {
      const naEscola = parada.tipo === 'escola';
      const id = 'des:' + pax.id;
      compromissos.push({
        id,
        ponto,
        tipo: 'desembarque',
        alunoId: pax.id,
        // Desembarque na escola (ida) é instantâneo; o limite real entra depois.
        atendimentoMin: naEscola && sentido === 'ida' ? 0 : atendimento,
      });
      nomePorCompromisso[id] = pax.identificacao;
    }
    for (const pax of embarcam) {
      const id = 'emb:' + pax.id;
      compromissos.push({ id, ponto, tipo: 'embarque', alunoId: pax.id, atendimentoMin: atendimento });
      nomePorCompromisso[id] = pax.identificacao;
    }
  }

  return { inicio: inicioPonto, compromissos, nomePorCompromisso, escolaPonto };
}

/** Deslocamento (offset em minutos) da partida até a primeira visita à escola. */
function offsetEscola(
  inicio: PontoGeo,
  compromissos: Compromisso[],
  matriz: MatrizViaria,
  escolaId: string,
): number | null {
  const probe = simularRota(
    { id: 'probe', versao: 1, sentido: 'ida', inicio, partidaMin: 0, capacidade: 99, ocupacaoInicial: 0, compromissos },
    matriz,
  );
  if (!probe.valido) return null;
  const ev = probe.eventos.find((e) => e.compromisso.ponto.id === escolaId);
  return ev ? ev.chegadaMin : null;
}

const MAP_MOTIVO: Record<CodigoMotivo, string> = {
  localizacao: 'Faltam informações de localização de algum endereço (confirme os pontos no mapa).',
  escola_itinerario: 'A escola do novo aluno não faz parte do itinerário desta rota.',
  capacidade: 'A van ultrapassaria a capacidade de passageiros em algum trecho.',
  atraso: 'O aluno chegaria atrasado à escola.',
  tolerancia: 'Um aluno que já está na rota teria o horário alterado além do permitido.',
  saida_cedo: 'A van sairia da escola antes do horário permitido.',
  trecho: 'Não foi possível calcular um trecho rodoviário entre dois endereços.',
  rota_base: 'A rota atual apresenta inconsistências e precisa ser revista.',
  aluno_duplicado: 'Este aluno já faz parte desta rota.',
  dados: 'Faltam informações para calcular com segurança.',
};

function motivosDe(codigos: CodigoMotivo[]): string[] {
  const vistos = new Set<CodigoMotivo>();
  const out: string[] = [];
  for (const c of codigos) if (!vistos.has(c)) { vistos.add(c); out.push(MAP_MOTIVO[c]); }
  return out;
}

/** Diagnóstico: por que NENHUM encaixe foi possível. Reproduz as posições do
 *  motor e coleta os impedimentos encontrados, sem fingir que há solução. */
function diagnosticar(
  rotaOp: RotaOperacional,
  pedido: PedidoEncaixe,
  matriz: MatrizViaria,
  base: PlanoCalculado,
  tolerancia: number,
): CodigoMotivo[] {
  const codigos = new Set<CodigoMotivo>();
  const n = rotaOp.compromissos.length;
  const indiceEscola = rotaOp.compromissos.findIndex(
    (p) => p.ponto.id === pedido.escola.id && (p.tipo === 'escola' || p.tipo === 'desembarque' || p.tipo === 'embarque'),
  );
  if (indiceEscola < 0) { codigos.add('escola_itinerario'); return [...codigos]; }

  const busca: Compromisso = {
    id: 'novo:embarque:' + pedido.alunoId,
    ponto: rotaOp.sentido === 'ida' ? pedido.casa : pedido.escola,
    tipo: 'embarque', alunoId: pedido.alunoId, atendimentoMin: pedido.atendimentoMin ?? 1,
  };
  const entrega: Compromisso = {
    id: 'novo:desembarque:' + pedido.alunoId,
    ponto: rotaOp.sentido === 'ida' ? pedido.escola : pedido.casa,
    tipo: 'desembarque', alunoId: pedido.alunoId, atendimentoMin: pedido.atendimentoMin ?? 1,
    ...(rotaOp.sentido === 'ida' ? { limiteEscolaMin: pedido.horarioEscolaMin } : {}),
  };
  const eventosBase = new Map(base.eventos.map((e) => [e.compromisso.id, e]));

  for (let i = 0; i <= n; i++) {
    for (let j = i + 1; j <= n + 1; j++) {
      if (rotaOp.sentido === 'ida' && (i > indiceEscola || j > indiceEscola + 1)) continue;
      if (rotaOp.sentido === 'volta' && i > indiceEscola + 1) continue;
      const paradas = [...rotaOp.compromissos];
      paradas.splice(i, 0, busca);
      paradas.splice(j, 0, entrega);
      const cand = simularRota(rotaOp, matriz, paradas);
      if (!cand.valido) {
        for (const m of cand.motivos) {
          if (m.includes('localização')) codigos.add('localizacao');
          else if (m.includes('tempo/distância')) codigos.add('trecho');
          else if (m.includes('Horário-limite')) codigos.add('atraso');
          else if (m.includes('Capacidade')) codigos.add('capacidade');
          else codigos.add('dados');
        }
        continue;
      }
      // Plano estruturalmente válido: verifica tolerância / saída cedo.
      const eb = cand.eventos.find((e) => e.compromisso.id === busca.id);
      const ed = cand.eventos.find((e) => e.compromisso.id === entrega.id);
      if (rotaOp.sentido === 'volta' && eb && eb.chegadaMin < pedido.horarioEscolaMin) { codigos.add('saida_cedo'); continue; }
      if (eb && ed && ed.chegadaMin < eb.saidaMin) { codigos.add('dados'); continue; }
      let estourou = false;
      for (const e of cand.eventos) {
        const ref = eventosBase.get(e.compromisso.id);
        if (!ref) continue;
        const baseRef = e.compromisso.horarioBaseMin ?? ref.chegadaMin;
        if (Math.abs(e.chegadaMin - baseRef) > tolerancia) { estourou = true; break; }
      }
      if (estourou) codigos.add('tolerancia');
    }
  }
  if (codigos.size === 0) codigos.add('dados');
  return [...codigos];
}

/**
 * Simula o encaixe de um novo aluno na rota do motorista (um sentido).
 * `matriz` deve vir de dados viários reais (ou de fixture nos testes).
 */
export function simularEncaixeRota(
  rota: Rota,
  veiculo: Veiculo | null,
  aluno: AlunoNovo,
  matriz: MatrizViaria,
  params: ParametrosSimulacao,
): ResultadoSimulacao {
  const sentido = rota.sentido;
  const atendimento = params.atendimentoMin ?? ATENDIMENTO_PADRAO_MIN;
  const margem = params.margemMin ?? MARGEM_OPERACIONAL_MIN;
  const tolerancia = Math.min(TOLERANCIA_MAX_MIN, Math.max(0, params.toleranciaMin ?? TOLERANCIA_MAX_MIN));
  const vazio = (codigos: CodigoMotivo[], extra?: Partial<ResultadoSimulacao>): ResultadoSimulacao => ({
    sentido, elegivel: false, opcao: null, motivos: motivosDe(codigos), codigos,
    base: null, partidaMin: null, nomePorCompromisso: {}, escolaNoItinerario: true, ...extra,
  });

  if (rota.passageiros.some((p) => p.id === aluno.alunoId)) return vazio(['aluno_duplicado']);

  const { faltamCoordenadas } = coletarPontos(rota, aluno);
  if (faltamCoordenadas.length > 0 || !coord(aluno.casa.lat) || !coord(aluno.casa.lng)) {
    return vazio(['localizacao']);
  }

  const montada = montarBase(rota, sentido, atendimento);
  if (!montada) return vazio(['localizacao']);
  const { inicio, compromissos, nomePorCompromisso, escolaPonto } = montada;

  // A escola do novo aluno precisa existir no itinerário (por destino).
  const escolaNoItinerario = compromissos.some((c) => c.ponto.id === aluno.escolaId);
  if (!escolaNoItinerario || !escolaPonto) {
    return vazio(['escola_itinerario'], { escolaNoItinerario: false });
  }
  const escolaPontoAluno = compromissos.find((c) => c.ponto.id === aluno.escolaId)!.ponto;

  // Ancoragem de trás para frente a partir do horário da escola.
  const offset = offsetEscola(inicio, compromissos, matriz, aluno.escolaId);
  if (offset === null) {
    // base inválida: distingue trecho ausente de inconsistência estrutural.
    const probe = simularRota(
      { id: 'probe', versao: 1, sentido, inicio, partidaMin: 0, capacidade: 99, ocupacaoInicial: 0, compromissos },
      matriz,
    );
    const cod: CodigoMotivo = probe.motivos.some((m) => m.includes('tempo/distância'))
      ? 'trecho'
      : probe.motivos.some((m) => m.includes('localização')) ? 'localizacao' : 'rota_base';
    return vazio([cod], { base: probe });
  }

  const ancora = sentido === 'ida' ? params.horarioEscolaMin - margem : params.horarioEscolaMin;
  const partidaMin = Math.max(0, ancora - offset);

  // Limite real de chegada à escola (ida) = horário-limite cadastrado (sem margem).
  const compromissosComLimite: Compromisso[] = compromissos.map((c) =>
    c.ponto.id === aluno.escolaId && c.tipo === 'desembarque' && sentido === 'ida'
      ? { ...c, limiteEscolaMin: params.horarioEscolaMin }
      : c,
  );

  const capacidade = Math.max(1, capacidadeAlunos(rota, veiculo) || veiculo?.lugaresPassageiro || 1);
  const rotaOp: RotaOperacional = {
    id: rota.id || 'rota',
    versao: 1,
    sentido,
    inicio,
    partidaMin,
    capacidade,
    ocupacaoInicial: 0,
    compromissos: compromissosComLimite,
    toleranciaMin: tolerancia,
  };

  const base = simularRota(rotaOp, matriz);
  if (!base.valido) {
    const cod: CodigoMotivo = base.motivos.some((m) => m.includes('tempo/distância'))
      ? 'trecho'
      : base.motivos.some((m) => m.includes('Capacidade')) ? 'capacidade'
      : base.motivos.some((m) => m.includes('Horário-limite')) ? 'atraso' : 'rota_base';
    return vazio([cod], { base, partidaMin });
  }

  const pedido: PedidoEncaixe = {
    alunoId: aluno.alunoId,
    casa: aluno.casa,
    escola: escolaPontoAluno,
    horarioEscolaMin: params.horarioEscolaMin,
    atendimentoMin: atendimento,
  };

  const opcoes = encontrarEncaixes(rotaOp, pedido, matriz);
  if (opcoes.length > 0) {
    return {
      sentido, elegivel: true, opcao: opcoes[0], motivos: [], codigos: [],
      base, partidaMin, nomePorCompromisso, escolaNoItinerario: true,
    };
  }

  const codigos = diagnosticar(rotaOp, pedido, matriz, base, tolerancia);
  return { sentido, elegivel: false, opcao: null, motivos: motivosDe(codigos), codigos, base, partidaMin, nomePorCompromisso, escolaNoItinerario: true };
}

/** Horário-limite/padrão de chegada à escola conforme turno (fallback). */
export function limitePadraoDoTurno(turno: string | null): number | null {
  if (!turno) return null;
  return LIMITE_CHEGADA_POR_TURNO[turno] ?? null;
}
