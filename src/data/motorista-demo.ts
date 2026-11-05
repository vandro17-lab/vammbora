/**
 * Dados DEMONSTRATIVOS e consistentes de um motorista fictício para o Vambora Pro.
 * Tudo aqui é exemplo (protótipo acadêmico). Os números batem entre as telas:
 * se o painel diz "12 alunos", a lista tem 12. Nenhum dado real de criança.
 */
import type { Rota } from '@/types/motorista';

export const MOTORISTA_DEMO = {
  nome: 'João Batista',
  apelido: 'Tio João',
  cidade: 'Araçatuba — SP',
  desde: 2014,
  nota: 4.9,
  avaliacoes: 38,
};

export const VAN_DEMO = {
  modelo: 'Mercedes Sprinter',
  ano: 2019,
  lugares: 16,
  arCondicionado: true,
  acessivel: false,
  cintos: true,
};

export interface AlunoDemo {
  id: string;
  nome: string; // apelido curto (demonstração)
  escola: string;
  regiao: string;
  embarque: string; // HH:MM informado pelo motorista
  rota: 'manha-ida' | 'manha-volta';
}

// 12 alunos — consistente com os indicadores.
export const ALUNOS_DEMO: AlunoDemo[] = [
  { id: 'a1', nome: 'Duda', escola: 'Colégio Paineiras', regiao: 'Centro', embarque: '06:30', rota: 'manha-ida' },
  { id: 'a2', nome: 'Pedro', escola: 'Colégio Paineiras', regiao: 'Centro', embarque: '06:34', rota: 'manha-ida' },
  { id: 'a3', nome: 'Lara', escola: 'Colégio Paineiras', regiao: 'Vila Mendonça', embarque: '06:38', rota: 'manha-ida' },
  { id: 'a4', nome: 'Theo', escola: 'Instituto São João', regiao: 'Vila Mendonça', embarque: '06:42', rota: 'manha-ida' },
  { id: 'a5', nome: 'Alice', escola: 'Instituto São João', regiao: 'Jardim Nova Iorque', embarque: '06:45', rota: 'manha-ida' },
  { id: 'a6', nome: 'Bento', escola: 'Instituto São João', regiao: 'Jardim Nova Iorque', embarque: '06:47', rota: 'manha-ida' },
  { id: 'a7', nome: 'Cecília', escola: 'Colégio Paineiras', regiao: 'Centro', embarque: '06:32', rota: 'manha-ida' },
  { id: 'a8', nome: 'Davi', escola: 'Colégio Paineiras', regiao: 'Água Branca', embarque: '06:36', rota: 'manha-ida' },
  { id: 'a9', nome: 'Manu', escola: 'Instituto São João', regiao: 'Água Branca', embarque: '06:40', rota: 'manha-ida' },
  { id: 'a10', nome: 'Rafa', escola: 'Colégio Paineiras', regiao: 'Centro', embarque: '06:33', rota: 'manha-ida' },
  { id: 'a11', nome: 'Sofia', escola: 'Instituto São João', regiao: 'Vila Mendonça', embarque: '06:41', rota: 'manha-ida' },
  { id: 'a12', nome: 'Léo', escola: 'Colégio Paineiras', regiao: 'Centro', embarque: '06:35', rota: 'manha-ida' },
];

export const INDICADORES_DEMO = {
  alunos: ALUNOS_DEMO.length, // 12
  capacidade: VAN_DEMO.lugares, // 16
  vagas: VAN_DEMO.lugares - ALUNOS_DEMO.length, // 4
  rotas: 2,
  escolas: 2,
  receitaMes: 3840, // 12 x 320
  aReceber: 640, // 2 em atraso
};

export interface OportunidadeDemo {
  id: string;
  regiao: string;
  escola: string;
  turno: string;
  quando: string;
  // dados para o simulador de impacto (minutos desde a meia-noite)
  embarqueDesejadoMin: number;
  atrasoAdicionalMin: number;
}

export const OPORTUNIDADES_DEMO: OportunidadeDemo[] = [
  { id: 'o1', regiao: 'Centro', escola: 'Colégio Paineiras', turno: 'Manhã', quando: 'a partir de fevereiro', embarqueDesejadoMin: 397, atrasoAdicionalMin: 2 },
  { id: 'o2', regiao: 'Vila Mendonça', escola: 'Instituto São João', turno: 'Manhã', quando: 'imediato', embarqueDesejadoMin: 404, atrasoAdicionalMin: 4 },
  { id: 'o3', regiao: 'Água Branca', escola: 'Colégio Paineiras', turno: 'Manhã', quando: 'março', embarqueDesejadoMin: 409, atrasoAdicionalMin: 7 },
];

export const FINANCEIRO_DEMO = {
  porMes: [
    { mes: 'Jun', valor: 3520 },
    { mes: 'Jul', valor: 3520 },
    { mes: 'Ago', valor: 3680 },
    { mes: 'Set', valor: 3680 },
    { mes: 'Out', valor: 3840 },
    { mes: 'Nov', valor: 3840 },
  ],
  mensalidade: 320,
  pagos: 10,
  emAtraso: 2,
};

export const AVISOS_DEMO = [
  { id: 'av1', tipo: 'doc', texto: 'O CRLV da van vence em 28 dias.', quando: 'hoje' },
  { id: 'av2', tipo: 'pagamento', texto: '2 mensalidades em atraso neste mês.', quando: 'há 2 dias' },
  { id: 'av3', tipo: 'oportunidade', texto: '3 famílias procuram van na sua região.', quando: 'esta semana' },
];

export const CALENDARIO_DEMO = [
  { dia: 'Seg a Sex', evento: 'Rota da manhã — ida e volta', cor: 'mint' },
  { dia: '20/11', evento: 'Feriado — sem transporte', cor: 'amber' },
  { dia: '28/11', evento: 'Vencimento do CRLV', cor: 'red' },
];

export const COMBUSTIVEL_DEMO = {
  consumoKmL: 9.2,
  ultimoAbastecimento: '02/11 · R$ 250 · 40 L',
  gastoMes: 820,
};

export const MANUTENCAO_DEMO = [
  { item: 'Troca de óleo', quando: 'em 1.200 km', status: 'ok' },
  { item: 'Revisão de freios', quando: 'em 20 dias', status: 'atencao' },
  { item: 'Pneus', quando: 'bom estado', status: 'ok' },
];

export const DOCUMENTOS_DEMO = [
  { nome: 'CNH (categoria D)', status: 'aprovado', validade: '2028' },
  { nome: 'Antecedentes criminais', status: 'aprovado', validade: '2026' },
  { nome: 'CRLV do veículo', status: 'vence_em_breve', validade: '28 dias' },
  { nome: 'Vistoria do transporte escolar', status: 'em_analise', validade: '—' },
];

// Rota demo no formato do construtor — usada no simulador de impacto (motor real).
export function rotaDemoManha(): Rota {
  const saida = { id: 's0', ordem: 0, tipo: 'saida' as const, rotulo: 'Garagem', confirmado: true, tempoAteProximaMin: 7 };
  const casas = ALUNOS_DEMO.slice(0, 6).map((a, i) => ({
    id: `c${i}`, ordem: i + 1, tipo: 'casa' as const, rotulo: `${a.regiao}`, confirmado: true, tempoAteProximaMin: 4,
  }));
  const escola = { id: 'esc', ordem: casas.length + 1, tipo: 'escola' as const, rotulo: 'Colégio Paineiras', confirmado: true, destinoId: 'esc-paineiras', destinoNome: 'Colégio Paineiras' };
  const paradas = [saida, ...casas, escola];
  const passageiros = ALUNOS_DEMO.slice(0, 6).map((a, i) => ({
    id: a.id, identificacao: a.nome, embarqueParadaId: `c${i}`, desembarqueParadaId: 'esc', destinoId: 'esc-paineiras',
  }));
  return {
    id: 'rota-demo', nome: 'Rota da manhã (ida)', sentido: 'ida', turno: 'manha',
    dias: ['seg', 'ter', 'qua', 'qui', 'sex'], veiculoId: 'van-demo',
    monitor: true, monitorOcupaLugar: false, lugaresReservados: 0,
    ultimoDesembarqueMin: 420, limiteAntecipacaoMin: 10, status: 'concluida',
    paradas, passageiros, atualizadoEm: new Date().toISOString(),
  };
}

/**
 * Monta a rota CANDIDATA (rota base + um novo aluno da oportunidade) para o motor
 * avaliar HONESTAMENTE o impacto de aceitar. Dois casos reais, decididos pelos dados:
 *
 *  1) A região da oportunidade JÁ é uma parada da rota (ex.: Centro). O novo aluno
 *     embarca nessa parada existente: nada muda nos horários, só a ocupação +1.
 *     O motor costuma aprovar (respeitando capacidade por trecho).
 *  2) A região NÃO está na rota (ex.: Água Branca). Seria preciso uma parada nova
 *     com desvio, empurrando o horário das paradas seguintes. O motor, sem tolerância
 *     de atraso informada, recusa — e é correto que recuse.
 *
 * Em nenhum caso o motor é alterado nem os resultados são forçados.
 */
export function rotaComOportunidade(base: Rota, op: OportunidadeDemo): Rota {
  const escola = base.paradas.find((p) => p.tipo === 'escola')!;
  const paradaExistente = base.paradas.find((p) => p.tipo === 'casa' && p.rotulo === op.regiao);

  // Caso 1: embarca numa parada que já existe (sem desvio).
  if (paradaExistente) {
    const novoAluno = {
      id: `pax-${op.id}`,
      identificacao: 'Novo aluno',
      embarqueParadaId: paradaExistente.id,
      desembarqueParadaId: escola.id,
      destinoId: escola.destinoId ?? null,
    };
    return { ...base, passageiros: [...base.passageiros, novoAluno] };
  }

  // Caso 2: região fora da rota -> exige parada nova com desvio (motor avalia).
  const ultimaCasa = base.paradas.filter((p) => p.tipo === 'casa').slice(-1)[0];
  const novaCasa = {
    id: `op-${op.id}`,
    ordem: escola.ordem, // entra onde está a escola; a escola é empurrada
    tipo: 'casa' as const,
    rotulo: op.regiao,
    confirmado: true,
    tempoAteProximaMin: 3, // nova casa -> escola
  };
  const paradas = base.paradas
    .map((p) => (p.id === escola.id ? { ...p, ordem: escola.ordem + 1 } : p))
    .concat(novaCasa)
    // o trecho da última casa agora vai até a nova casa (desvio)
    .map((p) => (ultimaCasa && p.id === ultimaCasa.id ? { ...p, tempoAteProximaMin: op.atrasoAdicionalMin } : p))
    .sort((a, b) => a.ordem - b.ordem);

  const novoAluno = {
    id: `pax-${op.id}`,
    identificacao: 'Novo aluno',
    embarqueParadaId: novaCasa.id,
    desembarqueParadaId: escola.id,
    destinoId: escola.destinoId ?? null,
  };
  return { ...base, paradas, passageiros: [...base.passageiros, novoAluno] };
}

export const VEICULO_DEMO = {
  id: 'van-demo', modelo: VAN_DEMO.modelo, ano: VAN_DEMO.ano, lugaresPassageiro: VAN_DEMO.lugares,
  arCondicionado: VAN_DEMO.arCondicionado, acessivel: VAN_DEMO.acessivel, cintos: VAN_DEMO.cintos, fotos: [] as string[],
};
