import type {
  CriteriosBusca, Motorista, Destino, ResultadoCompatibilidade, NivelCompatibilidade, Turno,
} from '@/types';
import {
  criarMatrizDemo, encontrarEncaixes, partidaRetroativa,
  type RotaOperacional, type Compromisso, type PontoGeo, type PedidoEncaixe,
} from '@/lib/encaixe';
import { minutosParaTextoHora } from '@/lib/utils';

/**
 * BUSCA DAS FAMÍLIAS COM O MESMO MOTOR (#7).
 * ---------------------------------------------------------------------------
 * A família informa origem, destino e turno. Para cada motorista elegível,
 * montamos uma rota DEMONSTRATIVA (passageiros fictícios, §9) com coordenadas e
 * rodamos o MESMO motor de encaixe usado no app do motorista e no laboratório.
 *
 * - Quando dá para calcular: mostramos os horários REAIS do motor (busca em casa
 *   e chegada à escola) como ESTIMATIVA pela região, sujeita à confirmação.
 * - Quando falta dado (origem fora das regiões conhecidas, van lotada no trecho,
 *   escola não atendida): dizemos que a rota precisa de validação. Nunca inventamos.
 *
 * Quando houver rotas REAIS cadastradas (Supabase), basta trocar a fonte da rota
 * (de demonstrativa para persistida) mantendo exatamente este mesmo motor.
 */

export interface ResultadoBusca {
  elegiveis: ResultadoCompatibilidade[];
  totalConsultados: number;
}

/** Centroides aproximados (demonstração) dos bairros de Araçatuba. */
const REGIAO: Record<string, { lat: number; lng: number }> = {
  'centro': { lat: -21.2086, lng: -50.4326 },
  'vila mendonca': { lat: -21.2155, lng: -50.4489 },
  'jardim nova iorque': { lat: -21.1962, lng: -50.4601 },
  'agua branca': { lat: -21.1889, lng: -50.4012 },
  'jardim alvorada': { lat: -21.2228, lng: -50.4178 },
};
const GARAGEM: PontoGeo = { id: 'garagem', nome: 'Garagem', lat: -21.2050, lng: -50.4400 };
const FOLGA_SAIDA_MIN = 8;

/** Horário-limite de chegada por turno (demonstração: horários de entrada usuais). */
const LIMITE_POR_TURNO: Record<Turno, number> = {
  manha: 7 * 60,      // 07:00
  tarde: 13 * 60,     // 13:00
  noite: 19 * 60,     // 19:00
  integral: 7 * 60,   // entrada da manhã
};

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Coordenada aproximada da origem da família a partir do texto do endereço. */
export function coordDaOrigem(endereco: string): { lat: number; lng: number } | null {
  const alvo = normalizar(endereco);
  if (!alvo) return null;
  for (const [chave, coord] of Object.entries(REGIAO)) {
    if (alvo.includes(chave) || chave.includes(alvo)) return coord;
  }
  return null;
}

function regiaoCoord(bairro: string): { lat: number; lng: number } | null {
  return REGIAO[normalizar(bairro)] ?? null;
}

/**
 * Monta uma rota DEMONSTRATIVA do motorista rumo ao destino: garagem -> casas
 * (um ponto por bairro atendido, com os passageiros já existentes) -> escola.
 * Os passageiros são fictícios; o cálculo é do motor real.
 */
export function rotaDemonstrativaDoMotorista(m: Motorista, destino: Destino, limiteMin: number): RotaOperacional | null {
  const bairros = m.bairrosAtendidos.map((b) => ({ nome: b, coord: regiaoCoord(b) })).filter((b) => b.coord);
  if (!bairros.length || !Number.isFinite(destino.lat) || !Number.isFinite(destino.lng)) return null;

  const ocupados = Math.max(0, Math.min(m.capacidadeTotal, m.capacidadeTotal - m.vagasDisponiveis));
  const escolaPonto: PontoGeo = { id: destino.id, nome: destino.nome, lat: destino.lat as number, lng: destino.lng as number };
  const compromissos: Compromisso[] = [];
  const existentes: string[] = [];

  bairros.forEach((b, bi) => {
    const casa: PontoGeo = { id: `casa-${bi}`, nome: b.nome, lat: b.coord!.lat, lng: b.coord!.lng };
    // distribui os passageiros existentes pelos bairros (os primeiros recebem +1)
    const qtd = Math.floor(ocupados / bairros.length) + (bi < ocupados % bairros.length ? 1 : 0);
    for (let k = 0; k < qtd; k++) {
      const alunoId = `ex-${bi}-${k}`;
      existentes.push(alunoId);
      compromissos.push({ id: `emb-${bi}-${k}`, ponto: casa, tipo: 'embarque', alunoId, atendimentoMin: 1 });
    }
  });
  compromissos.push({ id: `escola-${destino.id}`, ponto: escolaPonto, tipo: 'escola', atendimentoMin: 0, limiteEscolaMin: limiteMin });
  for (const alunoId of existentes) {
    compromissos.push({ id: `des-${alunoId}`, ponto: escolaPonto, tipo: 'desembarque', alunoId, atendimentoMin: 0, limiteEscolaMin: limiteMin });
  }

  return {
    id: m.id, versao: 1, sentido: 'ida', inicio: GARAGEM, partidaMin: 0,
    capacidade: m.capacidadeTotal, ocupacaoInicial: 0, compromissos, toleranciaMin: 10,
  };
}

/** Pré-filtro honesto (mesmos critérios óbvios de antes). */
function elegivel(m: Motorista, criterios: CriteriosBusca): boolean {
  if (m.cidadeId !== criterios.cidadeId) return false;
  if (criterios.destinoId && !m.destinosIds.includes(criterios.destinoId)) return false;
  if (criterios.turno && !m.turnos.includes(criterios.turno)) return false;
  return true;
}

/** Avalia um motorista com o motor real. Nunca inventa horário. */
function avaliar(m: Motorista, criterios: CriteriosBusca, destino: Destino | null): ResultadoCompatibilidade {
  const semVaga = m.vagasDisponiveis <= 0;
  // Preferência: coordenada exata do autocomplete; senão, estimativa pela região.
  const origem = (Number.isFinite(criterios.origemLat) && Number.isFinite(criterios.origemLng))
    ? { lat: criterios.origemLat as number, lng: criterios.origemLng as number }
    : coordDaOrigem(criterios.endereco);
  const turno = criterios.turno ?? (m.turnos[0] as Turno | undefined) ?? 'manha';
  const limite = LIMITE_POR_TURNO[turno];

  // Sem destino escolhido, sem origem reconhecida ou sem destino com coordenada:
  // não dá para calcular -> validação honesta (usa o horário informado pelo motorista).
  const base = destino ? rotaDemonstrativaDoMotorista(m, destino, limite) : null;
  if (!destino || !origem || !base) {
    return {
      motorista: m,
      nivel: semVaga ? 'sob_consulta' : 'disponivel',
      resumo: semVaga
        ? 'Sem vaga aberta agora — entre na lista de interesse desta rota.'
        : 'Compatível pela região e turno. O horário exato depende da validação da rota (informe um bairro conhecido para estimar).',
      passagemAproximada: m.janela.horario,
      fonteHorario: 'motorista',
    };
  }

  const matriz = criarMatrizDemo();
  const latest = partidaRetroativa(base, matriz);
  const comPartida: RotaOperacional = { ...base, partidaMin: (latest ?? limite) - FOLGA_SAIDA_MIN };
  const pedido: PedidoEncaixe = {
    alunoId: 'familia',
    casa: { id: 'origem', nome: criterios.endereco || 'origem', lat: origem.lat, lng: origem.lng },
    escola: { id: destino.id, nome: destino.nome, lat: destino.lat as number, lng: destino.lng as number },
    horarioEscolaMin: limite,
  };
  const opcoes = encontrarEncaixes(comPartida, pedido, matriz);
  const melhor = opcoes[0];

  if (!melhor) {
    // O motor não encontrou encaixe sem atrasar os outros / sem vaga no trecho.
    return {
      motorista: m,
      nivel: 'sob_consulta',
      resumo: semVaga
        ? 'Sem vaga aberta neste trecho agora — fale com o motorista sobre a lista de interesse.'
        : 'Pelo cálculo, seu endereço não encaixa nesta rota sem atrasar os outros alunos. Confirme alternativas com o motorista.',
      passagemAproximada: m.janela.horario,
      fonteHorario: 'motorista',
    };
  }

  const avulso = criterios.contratacao === 'avulso';
  return {
    motorista: m,
    nivel: avulso || semVaga ? 'sob_consulta' : 'disponivel',
    resumo: avulso
      ? 'Encaixe calculado; como é avulso, confirme a data direto com o motorista.'
      : 'Encaixa na rota sem atrasar os outros alunos (estimativa pela região).',
    passagemAproximada: minutosParaTextoHora(melhor.horarioBuscaMin),
    chegadaEscola: minutosParaTextoHora(melhor.horarioEntregaMin),
    tempoABordoMin: melhor.minutosABordo,
    fonteHorario: 'motor',
  };
}

function peso(n: NivelCompatibilidade): number {
  return n === 'disponivel' ? 0 : n === 'sob_consulta' ? 1 : 2;
}

/** Busca das famílias rodando o motor real sobre cada motorista elegível. */
export function buscarComMotor(
  criterios: CriteriosBusca,
  motoristas: Motorista[],
  destinos: Destino[],
): ResultadoBusca {
  const destinoSel = criterios.destinoId ? destinos.find((d) => d.id === criterios.destinoId) ?? null : null;
  const naCidade = motoristas.filter((m) => m.cidadeId === criterios.cidadeId);
  const elegiveis = naCidade
    .filter((m) => elegivel(m, criterios))
    .map((m) => avaliar(m, criterios, destinoSel))
    .sort((a, b) => {
      if (peso(a.nivel) !== peso(b.nivel)) return peso(a.nivel) - peso(b.nivel);
      if (b.motorista.avaliacao.media !== a.motorista.avaliacao.media) return b.motorista.avaliacao.media - a.motorista.avaliacao.media;
      return b.motorista.vagasDisponiveis - a.motorista.vagasDisponiveis;
    });
  return { elegiveis, totalConsultados: naCidade.length };
}
