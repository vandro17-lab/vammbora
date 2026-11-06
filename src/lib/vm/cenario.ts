import type { Rota, Veiculo, ParadaRota, PassageiroRota } from '@/types/motorista';
import { capacidadeAlunos, picoOcupacao, ocupacaoPorTrecho } from '@/lib/ocupacao-rota';

/**
 * Vambora Motoristas — CENÁRIO DEMONSTRATIVO coerente com as telas de referência.
 *
 * Todos os indicadores abaixo são CALCULADOS pelas funções reais (ocupacao-rota,
 * aritmética de combustível/financeiro), nunca "chumbados". O cenário só fornece
 * os INSUMOS (van de 15 lugares, 12 alunos, consumo 8 km/L, diesel R$6,20,
 * distância da rota). Com dados reais no banco/localStorage, as mesmas funções
 * calculam sobre eles — este cenário é só o fallback do protótipo.
 */

export const PRECO_DIESEL_PADRAO = 6.2;   // R$/litro (informado pelo motorista)
export const CONSUMO_PADRAO_KML = 8.0;    // km/L
export const MENSALIDADE_PADRAO = 320;    // R$/aluno
export const DIAS_UTEIS_MES = 22;

export const VEICULO_CENARIO: Veiculo = {
  id: 'van-vm-demo',
  modelo: 'Mercedes-Benz Sprinter',
  ano: 2018,
  placa: undefined,
  lugaresPassageiro: 15,
  arCondicionado: true,
  acessivel: false,
  cintos: true,
  fotos: [],
};

interface AlunoCenario { id: string; nome: string; regiao: string; escola: string; embarque: string }
const ALUNOS: AlunoCenario[] = [
  { id: 'a1', nome: 'Duda', regiao: 'Vila Mendonça', escola: 'Colégio Paineiras', embarque: '06:30' },
  { id: 'a2', nome: 'Pedro', regiao: 'Centro', escola: 'Colégio Paineiras', embarque: '06:34' },
  { id: 'a3', nome: 'Lara', regiao: 'Centro', escola: 'Colégio Paineiras', embarque: '06:37' },
  { id: 'a4', nome: 'Theo', regiao: 'Jd. Água Branca', escola: 'Colégio Paineiras', embarque: '06:40' },
  { id: 'a5', nome: 'Alice', regiao: 'Jd. Água Branca', escola: 'Instituto São João', embarque: '06:43' },
  { id: 'a6', nome: 'Bento', regiao: 'Jd. Nova Iorque', escola: 'Instituto São João', embarque: '06:46' },
  { id: 'a7', nome: 'Cecília', regiao: 'Centro', escola: 'Colégio Paineiras', embarque: '06:32' },
  { id: 'a8', nome: 'Davi', regiao: 'Vila Mendonça', escola: 'Colégio Paineiras', embarque: '06:36' },
  { id: 'a9', nome: 'Manu', regiao: 'Jd. Nova Iorque', escola: 'Instituto São João', embarque: '06:48' },
  { id: 'a10', nome: 'Rafa', regiao: 'Centro', escola: 'Colégio Paineiras', embarque: '06:33' },
  { id: 'a11', nome: 'Sofia', regiao: 'Vila Mendonça', escola: 'Colégio Paineiras', embarque: '06:41' },
  { id: 'a12', nome: 'Léo', regiao: 'Centro', escola: 'Colégio Paineiras', embarque: '06:35' },
];

const GARAGEM = { lat: -21.205, lng: -50.44 };
const REGIAO: Record<string, { lat: number; lng: number }> = {
  'Centro': { lat: -21.2085, lng: -50.433 },
  'Vila Mendonça': { lat: -21.195, lng: -50.45 },
  'Jd. Nova Iorque': { lat: -21.225, lng: -50.455 },
  'Jd. Água Branca': { lat: -21.178, lng: -50.415 },
};
const ESCOLA = {
  'Colégio Paineiras': { lat: -21.21, lng: -50.425 },
  'Instituto São João': { lat: -21.2, lng: -50.445 },
};

function rotaIda(): Rota {
  const saida: ParadaRota = { id: 's0', ordem: 0, tipo: 'saida', rotulo: 'Garagem', confirmado: true, lat: GARAGEM.lat, lng: GARAGEM.lng, tempoAteProximaMin: 5 };
  const casas: ParadaRota[] = ALUNOS.map((a, i) => {
    const base = REGIAO[a.regiao] ?? GARAGEM;
    return {
      id: `c${i}`, ordem: i + 1, tipo: 'casa', rotulo: `${a.regiao}`, confirmado: true,
      lat: base.lat + i * 0.0007, lng: base.lng - i * 0.0006, tempoAteProximaMin: 2,
    };
  });
  const esc = ESCOLA['Colégio Paineiras'];
  const escola: ParadaRota = { id: 'esc', ordem: ALUNOS.length + 1, tipo: 'escola', rotulo: 'Colégio Paineiras', confirmado: true, destinoId: 'esc-paineiras', destinoNome: 'Colégio Paineiras', lat: esc.lat, lng: esc.lng };
  const passageiros: PassageiroRota[] = ALUNOS.map((a, i) => ({
    id: a.id, identificacao: a.nome, embarqueParadaId: `c${i}`, desembarqueParadaId: 'esc', destinoId: 'esc-paineiras',
  }));
  return {
    id: 'rota-manha-ida', nome: 'Rota da manhã — ida', sentido: 'ida', turno: 'manha',
    dias: ['seg', 'ter', 'qua', 'qui', 'sex'], veiculoId: VEICULO_CENARIO.id,
    monitor: true, monitorOcupaLugar: false, lugaresReservados: 0,
    ultimoDesembarqueMin: 7 * 60 + 10, limiteAntecipacaoMin: 10, status: 'concluida',
    paradas: [saida, ...casas, escola], passageiros, atualizadoEm: new Date().toISOString(),
  };
}

function rotaVolta(): Rota {
  const ida = rotaIda();
  // Volta = escola → casas (espelha a ida; mesmos alunos).
  return { ...ida, id: 'rota-manha-volta', nome: 'Rota da manhã — volta', sentido: 'volta', ultimoDesembarqueMin: 12 * 60 + 15 };
}

/** Distância estimada da rota (km) — soma de trechos por reta × fator de ruas. */
export function distanciaRotaKm(rota: Rota, fatorRuas = 1.32): number {
  const locs = [...rota.paradas].sort((a, b) => a.ordem - b.ordem).filter((p) => p.lat != null && p.lng != null);
  let m = 0;
  for (let i = 1; i < locs.length; i++) {
    const a = locs[i - 1], b = locs[i];
    const R = 6371000, toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad((b.lat! - a.lat!)), dLng = toRad((b.lng! - a.lng!));
    const la1 = toRad(a.lat!), la2 = toRad(b.lat!);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
    m += 2 * R * Math.asin(Math.sqrt(h));
  }
  return (m / 1000) * fatorRuas;
}

export interface DadosMotorista {
  demo: boolean;
  veiculo: Veiculo | null;
  rotas: Rota[];
  precoDiesel: number;
  consumoKmL: number;
  mensalidade: number;
}

export function cenarioDemo(): DadosMotorista {
  return { demo: true, veiculo: VEICULO_CENARIO, rotas: [rotaIda(), rotaVolta()], precoDiesel: PRECO_DIESEL_PADRAO, consumoKmL: CONSUMO_PADRAO_KML, mensalidade: MENSALIDADE_PADRAO };
}

/* --------------------------- Indicadores (reais) --------------------------- */
export interface Indicadores {
  alunos: number; vagas: number; rotas: number; escolas: number;
  capacidade: number; ocupacaoPct: number;
  distanciaDiaKm: number; dieselDiaL: number; custoDiaBRL: number;
  receitaMesBRL: number; custoCombustivelMesBRL: number; resultadoMesBRL: number; resultadoPctReceita: number;
  custoPorKmBRL: number;
}

export function calcularIndicadores(d: DadosMotorista): Indicadores {
  const { veiculo, rotas, precoDiesel, consumoKmL, mensalidade } = d;
  const alunosIds = new Set<string>();
  rotas.forEach((r) => r.passageiros.forEach((p) => alunosIds.add(p.identificacao)));
  const alunos = alunosIds.size;

  const escolas = new Set<string>();
  rotas.forEach((r) => r.paradas.forEach((p) => { if (p.tipo === 'escola' && (p.destinoNome || p.destinoId)) escolas.add(p.destinoNome ?? p.destinoId!); }));

  // Ocupação: maior pico entre as rotas; capacidade da van (lugares de aluno).
  const capacidade = veiculo ? capacidadeAlunos(rotas[0] ?? ({ monitor: false, monitorOcupaLugar: false, lugaresReservados: 0 } as Rota), veiculo) : 0;
  const pico = rotas.reduce((m, r) => Math.max(m, picoOcupacao(r)), 0);
  const ocupacaoPct = capacidade > 0 ? Math.round((pico / capacidade) * 100) : 0;
  const vagas = Math.max(0, capacidade - pico);

  // Distância do dia = soma das rotas (ida + volta).
  const distanciaDiaKm = rotas.reduce((s, r) => s + distanciaRotaKm(r), 0);
  const dieselDiaL = consumoKmL > 0 ? distanciaDiaKm / consumoKmL : 0;
  const custoDiaBRL = dieselDiaL * precoDiesel;
  const custoPorKmBRL = distanciaDiaKm > 0 ? custoDiaBRL / distanciaDiaKm : 0;

  const receitaMesBRL = alunos * mensalidade;
  const custoCombustivelMesBRL = custoDiaBRL * DIAS_UTEIS_MES;
  const resultadoMesBRL = receitaMesBRL - custoCombustivelMesBRL;
  const resultadoPctReceita = receitaMesBRL > 0 ? Math.round((resultadoMesBRL / receitaMesBRL) * 100) : 0;

  return {
    alunos, vagas, rotas: rotas.length, escolas: escolas.size || (rotas.length ? 1 : 0),
    capacidade, ocupacaoPct,
    distanciaDiaKm, dieselDiaL, custoDiaBRL,
    receitaMesBRL, custoCombustivelMesBRL, resultadoMesBRL, resultadoPctReceita, custoPorKmBRL,
  };
}

export { ocupacaoPorTrecho };
