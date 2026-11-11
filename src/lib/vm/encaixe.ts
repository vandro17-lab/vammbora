import { criarMatrizDemo, type OpcaoEncaixe } from '@/lib/encaixe';
import { avaliarRotaDetalhada, type PedidoFamilia, type StatusBuscaReal } from '@/lib/busca-rotas-reais';
import { capacidadeAlunos, picoOcupacao } from '@/lib/ocupacao-rota';
import { distanciaRotaKm, type DadosMotorista, DIAS_UTEIS_MES } from '@/lib/vm/cenario';
import type { Rota } from '@/types/motorista';

const COLEGIO_PAINEIRAS = { lat: -21.21, lng: -50.425 };

export interface OportunidadeVM {
  id: string; regiao: string; escola: string; turno: string; quando: string;
  alunos: number; casa: { lat: number; lng: number }; limiteEscolaMin: number;
}

/** Oportunidades DEMONSTRATIVAS (fictícias, sem dados pessoais). Só aparecem no
 *  modo demonstração; não são pedidos reais de famílias. */
export const OPORTUNIDADES_VM: OportunidadeVM[] = [
  { id: 'op1', regiao: 'Vila Mendonça', escola: 'Colégio Paineiras', turno: 'Manhã', quando: 'imediato', alunos: 1, casa: { lat: -21.1962, lng: -50.4492 }, limiteEscolaMin: 7 * 60 + 10 },
  { id: 'op2', regiao: 'Jd. Água Branca', escola: 'Colégio Paineiras', turno: 'Manhã', quando: 'fevereiro', alunos: 2, casa: { lat: -21.1792, lng: -50.4168 }, limiteEscolaMin: 7 * 60 + 10 },
  { id: 'op3', regiao: 'Centro', escola: 'Colégio Paineiras', turno: 'Tarde', quando: 'março', alunos: 1, casa: { lat: -21.2078, lng: -50.4322 }, limiteEscolaMin: 7 * 60 + 10 },
];

/** Escola da oportunidade NA ROTA: a parada com o mesmo nome; senão, uma escola
 *  de fora do percurso (avaliada como qualquer escola ainda não visitada). */
function escolaNaRota(rota: Rota, op: OportunidadeVM): { destinoId: string; ponto: { lat: number; lng: number } } {
  const parada = rota.paradas.find((p) => p.tipo === 'escola' && p.destinoId && (p.destinoNome === op.escola || p.rotulo === op.escola));
  return parada && typeof parada.lat === 'number' && typeof parada.lng === 'number'
    ? { destinoId: parada.destinoId!, ponto: { lat: parada.lat, lng: parada.lng } }
    : { destinoId: 'oportunidade:' + op.escola, ponto: COLEGIO_PAINEIRAS };
}

function pedidoDe(rota: Rota, op: OportunidadeVM, sentido: 'ida' | 'volta'): PedidoFamilia {
  const escola = escolaNaRota(rota, op);
  return {
    origem: op.casa, destinoId: escola.destinoId, escolaPonto: escola.ponto, sentido, turno: rota.turno, contratacao: 'mensal',
    // Ida: o horário da oportunidade é o prazo de chegada. Volta: a oportunidade
    // não informa liberação — nada é presumido a partir do horário da ida.
    horarioFamiliaMin: sentido === 'ida' ? op.limiteEscolaMin : null,
  };
}

export interface ResultadoSimulacao {
  /** O cálculo encontrou um encaixe (pela ESTIMATIVA — nunca confirmado aqui). */
  cabe: boolean;
  /** Veredito da MESMA regra da busca das famílias e do simulador. */
  status: StatusBuscaReal;
  /** Cabe só com aprovação do motorista (sair mais cedo além do autorizado, mudar a ordem, incluir escola). */
  dependeDoMotorista: boolean;
  /** Os tempos vieram de estimativa por distância (não das ruas). Aqui, sempre. */
  estimado: boolean;
  motivo: string;
  compatibilidadePct: number;
  opcao: OpcaoEncaixe | null;
  comparativo: {
    alunosAntes: number; alunosDepois: number;
    ocupAntesPct: number; ocupDepoisPct: number;
    kmDiaAntes: number; kmDiaDepois: number;
    dieselDiaAntes: number; dieselDiaDepois: number;
    custoDiaAntes: number; custoDiaDepois: number;
    custoExtraDia: number; receitaExtraMes: number;
    /** Quilômetros a mais em cada trajeto AVALIADO. `null` = aquele trajeto não
     *  foi avaliado (não há rota desse sentido, ou o encaixe não fechou) — e o
     *  custo dele NÃO está no total. A volta nunca é suposta igual à ida. */
    kmExtraIda: number | null;
    kmExtraVolta: number | null;
  };
}

/**
 * Avalia uma oportunidade DEMONSTRATIVA sobre as rotas do motorista com a MESMA
 * regra da busca das famílias e do simulador (`avaliarRotaDetalhada`). Os tempos
 * são estimados pela distância: o resultado é, no máximo, "sob confirmação".
 * O custo considera só o trajeto efetivamente avaliado — ida e volta são
 * calculadas cada uma na sua rota. Não grava nada.
 */
export function simularEncaixe(dados: DadosMotorista, op: OportunidadeVM): ResultadoSimulacao {
  const rotaIda = dados.rotas.find((r) => r.sentido === 'ida') ?? null;
  const rotaVolta = dados.rotas.find((r) => r.sentido === 'volta') ?? null;
  const veic = dados.veiculo;
  const matriz = criarMatrizDemo();

  const ida = rotaIda ? avaliarRotaDetalhada(rotaIda, veic, pedidoDe(rotaIda, op, 'ida'), matriz) : null;
  const volta = rotaVolta ? avaliarRotaDetalhada(rotaVolta, veic, pedidoDe(rotaVolta, op, 'volta'), matriz) : null;
  const positivo = (s?: StatusBuscaReal) => s === 'compativel' || s === 'sob_confirmacao';
  const opcao = ida?.simulacao?.opcao ?? null;
  const cabe = positivo(ida?.publico.status) && !!opcao;

  const cap = rotaIda && veic ? capacidadeAlunos(rotaIda, veic) : 0;
  const alunosAntes = rotaIda ? rotaIda.passageiros.length : 0;
  const picoAntes = rotaIda ? picoOcupacao(rotaIda) : 0;
  // Ocupação depois = trecho mais cheio da viagem RECALCULADA (não "pico + 1").
  const picoDepois = cabe && opcao ? opcao.eventos.reduce((m, e) => Math.max(m, e.ocupacaoApos), 0) : picoAntes;
  const pct = (n: number) => (cap > 0 ? Math.round((n / cap) * 100) : 0);

  const kmExtraIda = cabe && opcao ? Math.max(0, opcao.desvioMetros / 1000) : null;
  const opVolta = positivo(volta?.publico.status) ? volta?.simulacao?.opcao ?? null : null;
  const kmExtraVolta = cabe && opVolta ? Math.max(0, opVolta.desvioMetros / 1000) : null;

  const kmDiaAntes = dados.rotas.reduce((s, r) => s + distanciaRotaKm(r), 0);
  const kmDiaDepois = kmDiaAntes + (kmExtraIda ?? 0) + (kmExtraVolta ?? 0);
  const diesel = (km: number) => (dados.consumoKmL > 0 ? km / dados.consumoKmL : 0);
  const custoDiaAntes = diesel(kmDiaAntes) * dados.precoDiesel;
  const custoDiaDepois = diesel(kmDiaDepois) * dados.precoDiesel;

  return {
    cabe,
    status: ida?.publico.status ?? 'indeterminado',
    dependeDoMotorista: cabe && ida?.publico.classe === 'aprovacao_motorista',
    estimado: true,
    motivo: ida?.publico.motivo ?? 'Cadastre uma rota de ida para avaliar oportunidades.',
    // Derivada do resultado (menos desvio = mais compatível). É um indicador da demonstração.
    compatibilidadePct: cabe && opcao ? Math.max(60, Math.min(99, Math.round(99 - opcao.desvioMin * 3))) : 0,
    opcao: cabe ? opcao : null,
    comparativo: {
      alunosAntes, alunosDepois: cabe ? alunosAntes + 1 : alunosAntes,
      ocupAntesPct: pct(picoAntes), ocupDepoisPct: pct(picoDepois),
      kmDiaAntes, kmDiaDepois,
      dieselDiaAntes: diesel(kmDiaAntes), dieselDiaDepois: diesel(kmDiaDepois),
      custoDiaAntes, custoDiaDepois, custoExtraDia: custoDiaDepois - custoDiaAntes,
      receitaExtraMes: cabe ? dados.mensalidade : 0,
      kmExtraIda, kmExtraVolta,
    },
  };
}

export { DIAS_UTEIS_MES };
