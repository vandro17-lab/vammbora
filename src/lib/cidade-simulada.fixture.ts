import type { MatrizViaria, PontoGeo } from '@/engine/encaixe-geografico';
import type { Rota, Veiculo, ParadaRota, PassageiroRota, EscolaDisponivel } from '@/types/motorista';
import type { PedidoFamilia } from '@/lib/busca-rotas-reais';
import type { ConsultaBloco, TabelasViarias } from '@/lib/matriz-viaria-servidor';

/**
 * CIDADE SIMULADA — apoio de TESTE. NÃO são ruas reais.
 *
 * Malha quadriculada fictícia ancorada em coordenadas de Araçatuba: a van anda
 * só na horizontal e na vertical (distância "Manhattan") a 24 km/h (400 m/min).
 * Serve para provar as REGRAS (prazos, janelas, capacidade, filas, falhas) com
 * números exatos e conferíveis à mão. Não prova nada sobre o trânsito, mãos de
 * direção ou o traçado verdadeiro das ruas — isso só uma consulta ao provedor
 * viário real mostra (ver `ruas-reais.test.ts`, que roda só com a chave).
 */

const BASE = { lat: -21.2, lng: -50.44 };
const M_POR_GRAU = 111320;
const COS = Math.cos((BASE.lat * Math.PI) / 180);
export const M_POR_MIN = 400;

/** Ponto a `x` metros a leste e `y` metros ao norte da base da malha. */
export const pt = (x: number, y: number) => ({ lat: BASE.lat + y / M_POR_GRAU, lng: BASE.lng + x / (M_POR_GRAU * COS) });
const emMetros = (p: { lat: number; lng: number }) => ({ x: (p.lng - BASE.lng) * M_POR_GRAU * COS, y: (p.lat - BASE.lat) * M_POR_GRAU });

/** Trecho pela malha simulada (minutos com fração, metros). */
export function trechoSimulado(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const A = emMetros(a), B = emMetros(b);
  const metros = Math.round(Math.abs(A.x - B.x) + Math.abs(A.y - B.y));
  return { minutos: Math.round((metros / M_POR_MIN) * 100) / 100, metros };
}

/** Matriz da malha simulada, declarada como fixture de teste. */
export const MATRIZ_SIMULADA: MatrizViaria = {
  origem: 'fixture-testada',
  obter: (a: PontoGeo, b: PontoGeo) => (a.id === b.id ? { minutos: 0, metros: 0 } : trechoSimulado(a, b)),
};

/** Resposta que o provedor viário daria para um bloco origens × destinos na malha simulada. */
export function tabelasSimuladas(origens: { lat: number; lng: number }[], destinos: { lat: number; lng: number }[]): TabelasViarias {
  return {
    tempos: origens.map((o) => destinos.map((d) => trechoSimulado(o, d).minutos)),
    distancias: origens.map((o) => destinos.map((d) => trechoSimulado(o, d).metros)),
  };
}

/** PROVEDOR SIMULADO (no lugar do Geoapify), com contador de requisições. */
export function provedorSimulado(opcoes: {
  /** Devolve `true` para a requisição FALHAR (provedor fora do ar para aquele bloco). */
  falhar?: (origens: { lat: number; lng: number }[], destinos: { lat: number; lng: number }[], chamada: number) => boolean;
  /** Pares que o provedor não consegue rotear (célula `null` — matriz parcial). */
  semTrajeto?: (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => boolean;
} = {}): ConsultaBloco & { chamadas: number } {
  const fn = (async (origens, destinos) => {
    fn.chamadas++;
    if (opcoes.falhar?.(origens, destinos, fn.chamadas)) return null;
    const t = tabelasSimuladas(origens, destinos);
    if (opcoes.semTrajeto) {
      origens.forEach((o, i) => destinos.forEach((d, j) => {
        if (opcoes.semTrajeto!(o, d)) { t.tempos[i][j] = null; t.distancias[i][j] = null; }
      }));
    }
    return t;
  }) as ConsultaBloco & { chamadas: number };
  fn.chamadas = 0;
  return fn;
}

export const HM = (h: number, m = 0) => h * 60 + m;

export function van(lugares = 6, id = 'van-1'): Veiculo {
  return { id, modelo: 'Van', lugaresPassageiro: lugares, arCondicionado: false, acessivel: false, cintos: true, fotos: [] };
}

const parada = (id: string, ordem: number, tipo: ParadaRota['tipo'], em: { lat: number; lng: number }, extra: Partial<ParadaRota> = {}): ParadaRota =>
  ({ id, ordem, tipo, rotulo: tipo === 'casa' ? `Rua Reservada ${id}, 100` : tipo, confirmado: true, lat: em.lat, lng: em.lng, ...extra });

/** Pontos fixos da malha (metros a leste/norte da base). */
export const P = {
  garagem: pt(0, 0),
  casa1: pt(2000, 0),
  casa2: pt(4000, 0),
  escola: pt(6000, 0),
  /** Escola que NÃO é parada: 3,5 km ao norte da casa 1 (longe de toda parada e de todo trecho). */
  escolaNova: pt(2000, 3500),
};

/**
 * IDA de referência: garagem → casa 1 → casa 2 → escola (limite 7h00).
 * Na malha simulada: 5 min por trecho + 2 min de atendimento em cada casa →
 * sai 6h36, casa 1 6h41, casa 2 6h48, escola 6h55 (5 min antes do limite).
 */
export function rotaIda(over: Partial<Rota> & { flexAntes?: number | null; flexDepois?: number | null } = {}): Rota {
  const { flexAntes = 10, flexDepois = 10, ...resto } = over;
  const pax = (id: string, casa: string, horario: number): PassageiroRota => ({
    id, identificacao: `AlunoReservado-${id}`, embarqueParadaId: casa, desembarqueParadaId: 'e', destinoId: 'esc-1',
    horarioHabitualMin: horario, ajusteAntesMin: flexAntes, ajusteDepoisMin: flexDepois,
  });
  return {
    id: 'rota-ida', nome: 'Ida manhã', sentido: 'ida', turno: 'manha', dias: ['seg', 'ter', 'qua', 'qui', 'sex'],
    veiculoId: 'van-1', monitor: false, monitorOcupaLugar: false, lugaresReservados: 0,
    ultimoDesembarqueMin: HM(7), saidaHabitualMin: HM(6, 36), limiteAntecipacaoMin: 10,
    disponibilidadeRevisada: true, escolasDisponiveis: [],
    status: 'concluida', atualizadoEm: '',
    paradas: [
      parada('s', 0, 'saida', P.garagem),
      parada('c1', 1, 'casa', P.casa1),
      parada('c2', 2, 'casa', P.casa2),
      parada('e', 3, 'escola', P.escola, { destinoId: 'esc-1', destinoNome: 'Escola Um', limiteChegadaMin: HM(7), atendimentoGrupoMin: 3 }),
    ],
    passageiros: [pax('p1', 'c1', HM(6, 41)), pax('p2', 'c2', HM(6, 48))],
    ...resto,
  };
}

/**
 * VOLTA de referência: garagem → escola (liberação 12h00) → casa 2 → casa 1.
 * Sai 11h55, espera a liberação, deixa a casa 2 às 12h08 e a casa 1 às 12h15.
 */
export function rotaVolta(over: Partial<Rota> = {}): Rota {
  const pax = (id: string, casa: string, horario: number): PassageiroRota => ({
    id, identificacao: `AlunoReservado-${id}`, embarqueParadaId: 'e', desembarqueParadaId: casa, destinoId: 'esc-1',
    horarioHabitualMin: horario, ajusteAntesMin: 10, ajusteDepoisMin: 10,
  });
  return {
    id: 'rota-volta', nome: 'Volta meio-dia', sentido: 'volta', turno: 'manha', dias: ['seg', 'ter', 'qua', 'qui', 'sex'],
    veiculoId: 'van-1', monitor: false, monitorOcupaLugar: false, lugaresReservados: 0,
    ultimoDesembarqueMin: HM(12, 40), saidaHabitualMin: HM(11, 55), limiteAntecipacaoMin: 10,
    disponibilidadeRevisada: true, escolasDisponiveis: [],
    status: 'concluida', atualizadoEm: '',
    paradas: [
      parada('s', 0, 'saida', pt(6000, 800)),
      parada('e', 1, 'escola', P.escola, { destinoId: 'esc-1', destinoNome: 'Escola Um', liberacaoMin: HM(12), atendimentoGrupoMin: 3 }),
      parada('c2', 2, 'casa', P.casa2),
      parada('c1', 3, 'casa', P.casa1),
    ],
    passageiros: [pax('p2', 'c2', HM(12, 8)), pax('p1', 'c1', HM(12, 15))],
    ...over,
  };
}

export const escolaAceita = (over: Partial<EscolaDisponivel> = {}): EscolaDisponivel =>
  ({ id: 'disp-1', destinoId: 'esc-nova', destinoNome: 'Escola Nova', dias: null, ...over });

/** Pedido da família na malha simulada (casa em metros a leste/norte da base). */
export function pedido(casa: { lat: number; lng: number }, over: Partial<PedidoFamilia> = {}): PedidoFamilia {
  return { origem: casa, destinoId: 'esc-1', escolaPonto: P.escola, sentido: 'ida', turno: 'manha', contratacao: 'mensal', ...over };
}
