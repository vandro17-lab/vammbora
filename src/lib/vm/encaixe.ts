import {
  criarMatrizDemo, rotaOperacionalDeCadastro, partidaRetroativa, encontrarEncaixes,
  type OpcaoEncaixe, type PedidoEncaixe,
} from '@/lib/encaixe';
import { capacidadeAlunos, picoOcupacao } from '@/lib/ocupacao-rota';
import { distanciaRotaKm, type DadosMotorista, DIAS_UTEIS_MES } from '@/lib/vm/cenario';

const FOLGA_SAIDA_MIN = 8;
const COLEGIO_PAINEIRAS = { lat: -21.21, lng: -50.425 };

export interface OportunidadeVM {
  id: string; regiao: string; escola: string; turno: string; quando: string;
  alunos: number; casa: { lat: number; lng: number }; limiteEscolaMin: number;
}

/** Oportunidades demonstrativas (sem dados pessoais) — avaliadas pelo motor real. */
export const OPORTUNIDADES_VM: OportunidadeVM[] = [
  { id: 'op1', regiao: 'Vila Mendonça', escola: 'Colégio Paineiras', turno: 'Manhã', quando: 'imediato', alunos: 1, casa: { lat: -21.1962, lng: -50.4492 }, limiteEscolaMin: 7 * 60 + 10 },
  { id: 'op2', regiao: 'Jd. Água Branca', escola: 'Colégio Paineiras', turno: 'Manhã', quando: 'fevereiro', alunos: 2, casa: { lat: -21.1792, lng: -50.4168 }, limiteEscolaMin: 7 * 60 + 10 },
  { id: 'op3', regiao: 'Centro', escola: 'Colégio Paineiras', turno: 'Tarde', quando: 'março', alunos: 1, casa: { lat: -21.2078, lng: -50.4322 }, limiteEscolaMin: 7 * 60 + 10 },
];

function pedido(op: OportunidadeVM): PedidoEncaixe {
  return {
    alunoId: `novo-${op.id}`,
    casa: { id: `casa-${op.id}`, nome: op.regiao, lat: op.casa.lat, lng: op.casa.lng },
    escola: { id: 'esc', nome: op.escola, lat: COLEGIO_PAINEIRAS.lat, lng: COLEGIO_PAINEIRAS.lng },
    horarioEscolaMin: op.limiteEscolaMin,
  };
}

export interface ResultadoSimulacao {
  cabe: boolean;
  compatibilidadePct: number;
  opcao: OpcaoEncaixe | null;
  comparativo: {
    alunosAntes: number; alunosDepois: number;
    ocupAntesPct: number; ocupDepoisPct: number;
    kmDiaAntes: number; kmDiaDepois: number;
    dieselDiaAntes: number; dieselDiaDepois: number;
    custoDiaAntes: number; custoDiaDepois: number;
    custoExtraDia: number; receitaExtraMes: number;
  };
}

/** Roda o MOTOR REAL (mesmo da busca das famílias) sobre a rota de ida e devolve
 *  compatibilidade + comparativo de custo. Não grava nada. */
export function simularEncaixe(dados: DadosMotorista, op: OportunidadeVM): ResultadoSimulacao {
  const rotaIda = dados.rotas.find((r) => r.sentido === 'ida') ?? dados.rotas[0];
  const veic = dados.veiculo;
  const cap = veic ? capacidadeAlunos(rotaIda, veic) : 15;

  const matriz = criarMatrizDemo();
  const base0 = rotaIda ? rotaOperacionalDeCadastro(rotaIda, { capacidade: cap, partidaMin: 0 }) : null;
  let opcao: OpcaoEncaixe | null = null;
  if (base0) {
    const latest = partidaRetroativa(base0, matriz);
    const base = { ...base0, partidaMin: (latest ?? op.limiteEscolaMin) - FOLGA_SAIDA_MIN };
    opcao = encontrarEncaixes(base, pedido(op), matriz)[0] ?? null;
  }
  const cabe = !!opcao;

  const alunosAntes = rotaIda ? rotaIda.passageiros.length : 0;
  const alunosDepois = alunosAntes + 1;
  const picoAntes = rotaIda ? picoOcupacao(rotaIda) : 0;
  const ocupAntesPct = cap > 0 ? Math.round((picoAntes / cap) * 100) : 0;
  const ocupDepoisPct = cap > 0 ? Math.round(((picoAntes + 1) / cap) * 100) : 0;

  const kmDiaAntes = dados.rotas.reduce((s, r) => s + distanciaRotaKm(r), 0);
  const extraKm = (opcao ? opcao.desvioMetros / 1000 : 1.5) * 2; // ida + volta
  const kmDiaDepois = kmDiaAntes + Math.max(0, extraKm);

  const dieselDiaAntes = kmDiaAntes / dados.consumoKmL;
  const dieselDiaDepois = kmDiaDepois / dados.consumoKmL;
  const custoDiaAntes = dieselDiaAntes * dados.precoDiesel;
  const custoDiaDepois = dieselDiaDepois * dados.precoDiesel;
  const custoExtraDia = custoDiaDepois - custoDiaAntes;
  const receitaExtraMes = dados.mensalidade;

  // Compatibilidade derivada do resultado do motor (menos desvio = mais compatível).
  const compatibilidadePct = cabe && opcao
    ? Math.max(60, Math.min(99, Math.round(99 - opcao.desvioMin * 3)))
    : 0;

  return {
    cabe, compatibilidadePct, opcao,
    comparativo: {
      alunosAntes, alunosDepois, ocupAntesPct, ocupDepoisPct,
      kmDiaAntes, kmDiaDepois, dieselDiaAntes, dieselDiaDepois,
      custoDiaAntes, custoDiaDepois, custoExtraDia, receitaExtraMes,
    },
  };
}

export { DIAS_UTEIS_MES };
