import type { ParadaRota, PassageiroRota, Rota } from '@/types/motorista';
import { novoId } from '@/data/motorista-store';
import { metrosEntre } from '@/lib/numero-estimado';

/**
 * ROTA DE VOLTA SUGERIDA a partir da ida (puro, sem rede).
 *
 * O motorista cadastra só a ida; a volta nasce como RASCUNHO PRONTO:
 *  - começa na(s) escola(s) onde os alunos que voltam desceram na ida;
 *  - entrega cada aluno na casa onde embarcou;
 *  - a ordem das casas NÃO é a ida invertida: é a sequência mais curta saindo
 *    da escola (e terminando perto de onde a van guarda, se a ida informou).
 * Tudo pode ser ajustado depois (ordem, quem volta, endereço). A volta é uma
 * rota independente: mexer nela não altera a ida.
 */

type Ponto = { lat: number; lng: number };
export type Distancia = (a: Ponto, b: Ponto) => number;

const temPonto = (p: { lat?: number; lng?: number }): p is Ponto =>
  typeof p.lat === 'number' && typeof p.lng === 'number' && Number.isFinite(p.lat) && Number.isFinite(p.lng);
const ordenadas = (r: Rota) => [...r.paradas].sort((a, b) => a.ordem - b.ordem);

/** Alunos da ida que PODEM voltar: têm casa de embarque e escola de desembarque. */
export function alunosQuePodemVoltar(ida: Rota): PassageiroRota[] {
  const tipo = new Map(ida.paradas.map((p) => [p.id, p.tipo]));
  return ida.passageiros.filter((x) =>
    x.embarqueParadaId && x.desembarqueParadaId
    && tipo.get(x.embarqueParadaId) !== 'escola' && tipo.get(x.desembarqueParadaId) === 'escola');
}

/**
 * Melhor ordem de visita saindo de `inicio` (vizinho mais próximo + trocas
 * 2-opt). `fim`, se informado, é para onde a van vai depois da última entrega.
 * Pontos sem coordenada ficam no final, na ordem em que vieram.
 */
export function ordenarEntregas<T extends { lat?: number; lng?: number }>(
  inicio: Ponto | null, pontos: T[], fim: Ponto | null = null, distancia: Distancia = metrosEntre,
): T[] {
  const com = pontos.filter(temPonto) as (T & Ponto)[];
  const sem = pontos.filter((p) => !temPonto(p));
  if (com.length < 2) return [...com, ...sem];
  // Vizinho mais próximo.
  const resto = [...com];
  const rota: (T & Ponto)[] = [];
  let atual: Ponto = inicio ?? resto[0];
  while (resto.length) {
    let melhor = 0;
    for (let i = 1; i < resto.length; i++) if (distancia(atual, resto[i]) < distancia(atual, resto[melhor])) melhor = i;
    atual = resto[melhor];
    rota.push(resto.splice(melhor, 1)[0]);
  }
  // 2-opt: desfaz cruzamentos enquanto encurtar o caminho.
  const custo = (r: Ponto[]) => {
    let t = inicio ? distancia(inicio, r[0]) : 0;
    for (let i = 0; i + 1 < r.length; i++) t += distancia(r[i], r[i + 1]);
    return fim ? t + distancia(r[r.length - 1], fim) : t;
  };
  let melhorCusto = custo(rota);
  for (let melhorou = true, voltas = 0; melhorou && voltas < 50; voltas++) {
    melhorou = false;
    for (let i = 0; i < rota.length - 1; i++) {
      for (let j = i + 1; j < rota.length; j++) {
        const tentativa = [...rota.slice(0, i), ...rota.slice(i, j + 1).reverse(), ...rota.slice(j + 1)];
        const c = custo(tentativa);
        if (c < melhorCusto - 1e-6) { rota.splice(0, rota.length, ...tentativa); melhorCusto = c; melhorou = true; }
      }
    }
  }
  return [...rota, ...sem];
}

function nomeDaVolta(nomeIda: string): string {
  const n = nomeIda.trim();
  if (!n) return 'Rota de volta';
  return /\bida\b/i.test(n) ? n.replace(/\bida\b/i, (m) => (m[0] === 'I' ? 'Volta' : 'volta')) : `${n} — volta`;
}

/**
 * Monta a volta sugerida. `voltamIds` = alunos (ids da ida) que voltam com a
 * van; sem informar, todos os que podem voltar.
 */
export function sugerirVolta(ida: Rota, opcoes: { voltamIds?: string[]; distancia?: Distancia } = {}): Rota {
  const podem = alunosQuePodemVoltar(ida);
  const voltam = opcoes.voltamIds ? podem.filter((x) => opcoes.voltamIds!.includes(x.id)) : podem;
  const daIda = ordenadas(ida);
  const usadas = (campo: 'embarqueParadaId' | 'desembarqueParadaId') => new Set(voltam.map((x) => x[campo]));

  // Escolas: da última da ida para a primeira (a van costuma estar na última).
  const escolas = daIda.filter((p) => p.tipo === 'escola' && usadas('desembarqueParadaId').has(p.id)).reverse();
  const casasIda = daIda.filter((p) => p.tipo !== 'escola' && usadas('embarqueParadaId').has(p.id));
  const ultimaEscola = escolas[escolas.length - 1];
  const garagem = daIda.find((p) => p.tipo === 'saida' && temPonto(p));
  const casas = ordenarEntregas(
    ultimaEscola && temPonto(ultimaEscola) ? ultimaEscola : null, casasIda,
    garagem && temPonto(garagem) ? garagem : null, opcoes.distancia,
  );

  const novoIdDe = new Map<string, string>();
  const paradas: ParadaRota[] = [...escolas, ...casas].map((p, i) => {
    const id = novoId();
    novoIdDe.set(p.id, id);
    return {
      id, ordem: i, tipo: p.tipo === 'escola' ? 'escola' : 'casa', rotulo: p.rotulo,
      lat: p.lat, lng: p.lng, confirmado: p.confirmado,
      destinoId: p.destinoId ?? null, destinoNome: p.destinoNome ?? null,
      horarioChegadaMin: null, tempoAteProximaMin: null,
    };
  });
  const passageiros: PassageiroRota[] = voltam.map((x) => ({
    id: novoId(), identificacao: x.identificacao, destinoId: x.destinoId ?? null,
    embarqueParadaId: novoIdDe.get(x.desembarqueParadaId!) ?? null,
    desembarqueParadaId: novoIdDe.get(x.embarqueParadaId!) ?? null,
    // Horário combinado e tolerância são da IDA; na volta ainda não foram informados.
    horarioHabitualMin: null, ajusteAntesMin: null, ajusteDepoisMin: null,
    atendimentoMin: x.atendimentoMin ?? null, atendimentoOrigem: x.atendimentoOrigem ?? null,
  }));

  return {
    id: '', nome: nomeDaVolta(ida.nome), sentido: 'volta', turno: ida.turno, dias: [...ida.dias],
    veiculoId: ida.veiculoId, monitor: ida.monitor, monitorOcupaLugar: ida.monitorOcupaLugar,
    lugaresReservados: ida.lugaresReservados, ultimoDesembarqueMin: null, limiteAntecipacaoMin: null,
    status: 'rascunho', isPublished: false, paradas, passageiros, atualizadoEm: new Date().toISOString(),
  };
}

/** Aplica a ordem escolhida (ids das paradas, de cima para baixo). */
export function reordenarParadas(rota: Rota, idsEmOrdem: string[]): Rota {
  const pos = new Map(idsEmOrdem.map((id, i) => [id, i]));
  const paradas = [...rota.paradas]
    .sort((a, b) => (pos.get(a.id) ?? 1e6 + a.ordem) - (pos.get(b.id) ?? 1e6 + b.ordem))
    .map((p, i) => ({ ...p, ordem: i, tempoAteProximaMin: null }));
  return { ...rota, paradas };
}

/** Tira um aluno da rota e as paradas que ficarem sem ninguém. */
export function removerAluno(rota: Rota, alunoId: string): Rota {
  const passageiros = rota.passageiros.filter((x) => x.id !== alunoId);
  const emUso = new Set(passageiros.flatMap((x) => [x.embarqueParadaId, x.desembarqueParadaId]));
  const paradas = ordenadas(rota).filter((p) => p.tipo === 'saida' || emUso.has(p.id)).map((p, i) => ({ ...p, ordem: i }));
  return { ...rota, paradas, passageiros };
}

/**
 * O aluno desce em OUTRO endereço na volta (ex.: casa da avó). Se a casa era
 * dividida com outro aluno, ele ganha uma parada própria logo depois dela.
 */
export function trocarEnderecoDoAluno(rota: Rota, alunoId: string, rotulo: string, ponto: Ponto | null): Rota {
  const aluno = rota.passageiros.find((x) => x.id === alunoId);
  if (!aluno?.desembarqueParadaId) return rota;
  const dividida = rota.passageiros.some((x) => x.id !== alunoId && x.desembarqueParadaId === aluno.desembarqueParadaId);
  const novo = { rotulo, lat: ponto?.lat, lng: ponto?.lng, confirmado: !!ponto, tempoAteProximaMin: null };
  if (!dividida) {
    return { ...rota, paradas: rota.paradas.map((p) => (p.id === aluno.desembarqueParadaId ? { ...p, ...novo } : p)) };
  }
  const id = novoId();
  const lista = ordenadas(rota);
  const i = lista.findIndex((p) => p.id === aluno.desembarqueParadaId);
  lista.splice(i + 1, 0, { id, ordem: 0, tipo: 'casa', horarioChegadaMin: null, destinoId: null, destinoNome: null, ...novo });
  return {
    ...rota,
    paradas: lista.map((p, k) => ({ ...p, ordem: k })),
    passageiros: rota.passageiros.map((x) => (x.id === alunoId ? { ...x, desembarqueParadaId: id } : x)),
  };
}

/** Alunos cuja casa ficou ANTES da escola onde embarcam (ordem impossível). */
export function alunosForaDeOrdem(rota: Rota): PassageiroRota[] {
  const ordem = new Map(rota.paradas.map((p) => [p.id, p.ordem]));
  return rota.passageiros.filter((x) => {
    const e = x.embarqueParadaId ? ordem.get(x.embarqueParadaId) : undefined;
    const d = x.desembarqueParadaId ? ordem.get(x.desembarqueParadaId) : undefined;
    return e != null && d != null && d <= e;
  });
}
