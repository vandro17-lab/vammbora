import { describe, it, expect } from 'vitest';
import type { Rota, Veiculo } from '@/types/motorista';
import {
  atendimentoGrupo, copiarRota, diasDaDisponibilidade, duracaoDasPartes, escolaDoAluno, escolasNoPercurso, horarioDaEscola,
  horarioReferenciaDoPeriodo, inteiroInformado, minutosDoCampo, horaDoCampo, normalizarEscolasDisponiveis, partesDaDuracao,
  pendenciasDeRevisao, sugerirPeriodo, textoDuracao, totalDePendencias,
} from './cadastro-rota';
import { PARADA_ESCOLA_MIN } from './tempos-parada';
import { montarEntradaMotor, planejarRotaDoCadastro } from './rota-para-motor';
import { montarRotaAncorada } from './rota-para-encaixe';
import { criarMatrizDemo } from './encaixe';
import { tempoRotaMin, distanciaRotaKm } from './vm/cenario';
import { picoOcupacao, validarRota } from './ocupacao-rota';
import { sugerirVolta } from './rota-volta';

const VAN: Veiculo = { id: 'v', modelo: 'Van', lugaresPassageiro: 15, arCondicionado: false, acessivel: false, cintos: true, fotos: [] };

/** Ida da manhã: saída, 2 casas, 1 escola (ponto final), 2 alunos. */
function ida(over: Partial<Rota> = {}): Rota {
  return {
    id: 'r1', nome: 'Rota de ida', sentido: 'ida', turno: 'manha', periodoConfirmado: true, dias: ['seg', 'ter', 'qua', 'qui', 'sex'], veiculoId: 'v',
    monitor: false, monitorOcupaLugar: false, lugaresReservados: 0, ultimoDesembarqueMin: 420, saidaHabitualMin: 385, limiteAntecipacaoMin: 10,
    status: 'concluida', atualizadoEm: '', disponibilidadeRevisada: true, escolasDisponiveis: [],
    paradas: [
      { id: 's', ordem: 0, tipo: 'saida', rotulo: 'Garagem', lat: -21.2, lng: -50.44, confirmado: true, tempoAteProximaMin: 5 },
      { id: 'c1', ordem: 1, tipo: 'casa', rotulo: 'Rua A, 1', lat: -21.205, lng: -50.435, confirmado: true, tempoAteProximaMin: 4 },
      { id: 'c2', ordem: 2, tipo: 'casa', rotulo: 'Rua B, 2', lat: -21.21, lng: -50.43, confirmado: true, tempoAteProximaMin: 6 },
      { id: 'e1', ordem: 3, tipo: 'escola', rotulo: 'Escola Um', lat: -21.215, lng: -50.425, confirmado: true, destinoId: 'esc-1', limiteChegadaMin: 420, atendimentoGrupoMin: 3, tempoAteProximaMin: null },
    ],
    passageiros: [
      { id: 'a', identificacao: 'Ana', embarqueParadaId: 'c1', desembarqueParadaId: 'e1', destinoId: 'esc-1', horarioHabitualMin: 395, ajusteAntesMin: 0, ajusteDepoisMin: 5, atendimentoMin: 0.5, atendimentoOrigem: 'informado' },
      { id: 'b', identificacao: 'Bia', embarqueParadaId: 'c2', desembarqueParadaId: 'e1', destinoId: 'esc-1', horarioHabitualMin: 401, ajusteAntesMin: 3, ajusteDepoisMin: 0, atendimentoMin: 2, atendimentoOrigem: 'informado' },
    ],
    ...over,
  };
}

describe('período escolar × sentido', () => {
  it('a volta ao meio-dia é do período da MANHÃ; a ida ao meio-dia é do período da TARDE', () => {
    expect(sugerirPeriodo('volta', 12 * 60)).toBe('manha');
    expect(sugerirPeriodo('volta', 11 * 60 + 40)).toBe('manha');
    expect(sugerirPeriodo('ida', 12 * 60 + 30)).toBe('tarde');
  });
  it('demais faixas: ida 7h manhã / 19h noite; volta 17h30 tarde / 22h30 noite', () => {
    expect(sugerirPeriodo('ida', 7 * 60)).toBe('manha');
    expect(sugerirPeriodo('ida', 19 * 60)).toBe('noite');
    expect(sugerirPeriodo('volta', 17 * 60 + 30)).toBe('tarde');
    expect(sugerirPeriodo('volta', 22 * 60 + 30)).toBe('noite');
  });
  it('horário ausente ou fora das faixas: não sugere nada (o motorista escolhe)', () => {
    expect(sugerirPeriodo('ida', null)).toBeNull();
    expect(sugerirPeriodo('ida', 10 * 60 + 30)).toBeNull();
    expect(sugerirPeriodo('volta', 14 * 60 + 30)).toBeNull();
    expect(sugerirPeriodo('ida', 3 * 60)).toBeNull();
  });
  it('a base da sugestão é o horário da escola (ida: limite; volta: liberação)', () => {
    expect(horarioReferenciaDoPeriodo(ida())).toBe(420);
    const volta: Rota = { ...ida(), sentido: 'volta', ultimoDesembarqueMin: null, paradas: ida().paradas.map((p) => (p.tipo === 'escola' ? { ...p, limiteChegadaMin: null, liberacaoMin: 720 } : p)) };
    expect(horarioReferenciaDoPeriodo(volta)).toBe(720);
    expect(sugerirPeriodo(volta.sentido, horarioReferenciaDoPeriodo(volta))).toBe('manha');
  });
  it('a volta montada a partir da ida herda o PERÍODO dos alunos, a confirmar, e não herda horários nem autorizações', () => {
    const v = sugerirVolta(ida({ escolasDisponiveis: [{ id: 'd', destinoId: 'esc-2', dias: null }] }));
    expect(v).toMatchObject({ sentido: 'volta', turno: 'manha', periodoConfirmado: false, saidaHabitualMin: null, limiteAntecipacaoMin: null, escolasDisponiveis: [], disponibilidadeRevisada: false });
    const escola = v.paradas.find((p) => p.tipo === 'escola')!;
    expect(escola).toMatchObject({ destinoId: 'esc-1', limiteChegadaMin: null, liberacaoMin: null, atendimentoGrupoMin: null });
    expect(pendenciasDeRevisao(v).find((p) => p.alvo === 'rota')!.faltas).toContain('confirmação do período escolar');
  });
});

describe('zero informado × informação ausente', () => {
  it('campo numérico: vazio = null; "0" = 0', () => {
    expect(inteiroInformado('')).toBeNull();
    expect(inteiroInformado('0')).toBe(0);
    expect(inteiroInformado('7')).toBe(7);
    expect(inteiroInformado('abc')).toBeNull();
    expect(inteiroInformado('500', 120)).toBe(120);
  });
  it('duração aceita menos de 1 minuto e distingue 0 de vazio', () => {
    expect(duracaoDasPartes('', '')).toBeNull();
    expect(duracaoDasPartes('0', '0')).toBe(0);
    expect(duracaoDasPartes('', '30')).toBe(0.5);
    expect(duracaoDasPartes('1', '30')).toBe(1.5);
    expect(duracaoDasPartes('', '20')).toBe(0.33);
    expect(partesDaDuracao(0.33)).toEqual({ min: '0', seg: '20' });
    expect(partesDaDuracao(null)).toEqual({ min: '', seg: '' });
    expect(partesDaDuracao(0)).toEqual({ min: '0', seg: '0' });
    expect(textoDuracao(0.5)).toBe('30 s');
    expect(textoDuracao(1.5)).toBe('1 min 30 s');
    expect(textoDuracao(0)).toBe('0 s');
    expect(textoDuracao(null)).toBe('não informado');
  });
  it('todo segundo inteiro sobrevive a gravar com 2 casas e reabrir', () => {
    for (let s = 0; s < 600; s++) {
      const p = partesDaDuracao(duracaoDasPartes(String(Math.floor(s / 60)), String(s % 60)));
      expect(Number(p.min) * 60 + Number(p.seg)).toBe(s);
    }
  });
  it('horário: "" = null; meia-noite é 0', () => {
    expect(minutosDoCampo('')).toBeNull();
    expect(minutosDoCampo('00:00')).toBe(0);
    expect(minutosDoCampo('12:05')).toBe(725);
    expect(horaDoCampo(0)).toBe('00:00');
    expect(horaDoCampo(null)).toBe('');
  });
});

describe('visita à escola', () => {
  it('limite de chegada (ida) e liberação (volta) são campos próprios; cadastro antigo usa o horário da parada', () => {
    const p = ida().paradas[3];
    expect(horarioDaEscola({ ...p, limiteChegadaMin: 425, liberacaoMin: 720, horarioChegadaMin: 415 }, 'ida')).toBe(425);
    expect(horarioDaEscola({ ...p, limiteChegadaMin: 425, liberacaoMin: 720, horarioChegadaMin: 415 }, 'volta')).toBe(720);
    expect(horarioDaEscola({ ...p, limiteChegadaMin: null, horarioChegadaMin: 415 }, 'ida')).toBe(415);
    expect(horarioDaEscola({ ...p, limiteChegadaMin: null, horarioChegadaMin: null }, 'ida')).toBeNull();
  });
  it('tempo do grupo: informado (inclusive 0 e fração) vale; ausente usa o padrão provisório', () => {
    expect(atendimentoGrupo({ atendimentoGrupoMin: 0 })).toBe(0);
    expect(atendimentoGrupo({ atendimentoGrupoMin: 0.5 })).toBe(0.5);
    expect(atendimentoGrupo({ atendimentoGrupoMin: null })).toBe(PARADA_ESCOLA_MIN);
    expect(atendimentoGrupo({})).toBe(PARADA_ESCOLA_MIN);
  });
  it('o tempo do grupo e o atendimento de 30 s entram no plano de horários', () => {
    const base = planejarRotaDoCadastro(ida(), VAN).plano!;
    expect(base.valido).toBe(true);
    const comGrupoMaior = planejarRotaDoCadastro(ida({ paradas: ida().paradas.map((p) => (p.tipo === 'escola' ? { ...p, atendimentoGrupoMin: 5 } : p)) }), VAN).plano!;
    const entradaBase = montarEntradaMotor(ida(), VAN), entradaMaior = montarEntradaMotor(ida({ paradas: ida().paradas.map((p) => (p.tipo === 'escola' ? { ...p, atendimentoGrupoMin: 5 } : p)) }), VAN);
    expect(entradaBase.paradas.map((p) => p.atendimentoMin)).toEqual([0.5, 2, 3]);
    expect(entradaMaior.paradas[2].atendimentoMin).toBe(5);
    expect(comGrupoMaior.valido).toBe(true);
  });
  it('o aluno é da escola (unidade do catálogo) da parada dele', () => {
    const r = ida();
    expect(escolaDoAluno(r, r.passageiros[0])).toBe('esc-1');
    expect(escolaDoAluno(r, { ...r.passageiros[0], desembarqueParadaId: null, destinoId: null })).toBeNull();
  });
});

describe('escolas no percurso × escolas que o motorista aceita incluir', () => {
  const comDisponiveis = () => ida({
    escolasDisponiveis: [
      { id: 'd1', destinoId: 'esc-2', dias: ['seg', 'qua'], limiteChegadaMin: 425, atendimentoGrupoMin: 4, portaoLat: -21.3, portaoLng: -50.5 },
      { id: 'd2', destinoId: 'esc-3', dias: null },
    ],
  });

  it('distingue as duas listas', () => {
    const r = comDisponiveis();
    expect(escolasNoPercurso(r)).toEqual(['esc-1']);
    expect(r.escolasDisponiveis!.map((e) => e.destinoId)).toEqual(['esc-2', 'esc-3']);
  });

  it('escola apenas disponível NÃO gera parada, NÃO altera duração, horários, distância nem ocupação', () => {
    const sem = ida(), com = comDisponiveis();
    expect(com.paradas).toEqual(sem.paradas);
    expect(montarEntradaMotor(com, VAN)).toEqual(montarEntradaMotor(sem, VAN));
    expect(planejarRotaDoCadastro(com, VAN)).toEqual(planejarRotaDoCadastro(sem, VAN));
    expect(tempoRotaMin(com)).toEqual(tempoRotaMin(sem));
    expect(distanciaRotaKm(com)).toBe(distanciaRotaKm(sem));
    expect(picoOcupacao(com)).toBe(picoOcupacao(sem));
    expect(validarRota(com, VAN)).toEqual(validarRota(sem, VAN));
    // Nem no motor de encaixe: mesmos compromissos, mesma partida, mesmo plano.
    const m = criarMatrizDemo();
    const a = montarRotaAncorada(sem, VAN, m)!, b = montarRotaAncorada(com, VAN, m)!;
    expect(b.rotaOp).toEqual(a.rotaOp);
    expect(b.base).toEqual(a.base);
    expect(b.rotaOp.compromissos.some((c) => c.ponto.id === 'esc-2' || c.ponto.id === 'esc-3')).toBe(false);
  });

  it('dias: null = todos os dias da rota; lista = só os que também são da rota', () => {
    const r = comDisponiveis();
    expect(diasDaDisponibilidade(r, r.escolasDisponiveis![1])).toEqual(['seg', 'ter', 'qua', 'qui', 'sex']);
    expect(diasDaDisponibilidade(r, r.escolasDisponiveis![0])).toEqual(['seg', 'qua']);
    expect(diasDaDisponibilidade({ dias: ['ter'] }, r.escolasDisponiveis![0])).toEqual([]);
  });

  it('normalização: sem repetição, sem a que já é parada, só com ID de catálogo', () => {
    const r = ida({
      escolasDisponiveis: [
        { id: '1', destinoId: 'esc-2', dias: ['qua', 'seg', 'feriado'] }, { id: '2', destinoId: 'esc-2', dias: null },
        { id: '3', destinoId: 'esc-1', dias: null }, { id: '4', destinoId: '', dias: null },
        { id: '5', destinoId: 'esc-3', dias: null, portaoLat: -21.3, portaoLng: null, limiteChegadaMin: 9999 },
      ],
    });
    const n = normalizarEscolasDisponiveis(r);
    expect(n.map((e) => e.destinoId)).toEqual(['esc-2', 'esc-3']);
    expect(n[0].dias).toEqual(['seg', 'qua']);
    expect(n[1]).toMatchObject({ portaoLat: null, portaoLng: null, limiteChegadaMin: null });
  });

  it('a disponibilidade é da rota: a cópia leva a lista; outra rota não ganha nada', () => {
    let n = 0;
    const copia = copiarRota(comDisponiveis(), () => `novo-${++n}`);
    expect(copia.escolasDisponiveis!.map((e) => [e.destinoId, e.dias])).toEqual([['esc-2', ['seg', 'qua']], ['esc-3', null]]);
    expect(ida().escolasDisponiveis).toEqual([]);
  });
});

describe('o que precisa de revisão (nada é inventado)', () => {
  it('rota completa não tem pendências', () => {
    expect(pendenciasDeRevisao(ida())).toEqual([]);
  });

  it('cadastro antigo: aponta cada dado ausente, sem confundir zero com ausente', () => {
    const antiga = ida({
      periodoConfirmado: undefined, saidaHabitualMin: undefined, limiteAntecipacaoMin: null, disponibilidadeRevisada: undefined, escolasDisponiveis: undefined,
      paradas: ida().paradas.map((p) => (p.tipo === 'escola' ? { ...p, limiteChegadaMin: undefined, atendimentoGrupoMin: undefined, horarioChegadaMin: 415 } : p)),
      passageiros: [
        { id: 'a', identificacao: 'Ana', embarqueParadaId: 'c1', desembarqueParadaId: 'e1', destinoId: 'esc-1', horarioHabitualMin: 395 },
        { id: 'b', identificacao: 'Bia', embarqueParadaId: 'c2', desembarqueParadaId: 'e1', destinoId: 'esc-1', horarioHabitualMin: 401, ajusteAntesMin: 0, ajusteDepoisMin: 0, atendimentoMin: 0 },
      ],
    });
    const ps = pendenciasDeRevisao(antiga, (id) => (id === 'esc-1' ? 'Escola Um (catálogo)' : undefined));
    expect(ps.find((p) => p.alvo === 'rota')!.faltas).toEqual([
      'horário habitual de saída', 'quanto você autoriza antecipar a saída (0 se não autoriza)',
      'confirmação do período escolar', 'escolas que você aceita incluir nesta rota (ou confirmar que nenhuma)',
    ]);
    // O horário habitual da parada (415) NÃO conta como limite de chegada informado.
    expect(ps.find((p) => p.alvo === 'escola')).toMatchObject({ titulo: 'Escola Um (catálogo)', faltas: ['limite de chegada', 'tempo de atendimento do grupo'] });
    expect(ps.find((p) => p.titulo === 'Ana')!.faltas).toEqual(['flexibilidade para antes (0 se não tem)', 'flexibilidade para depois (0 se não tem)', 'tempo de atendimento']);
    // Bia informou ZERO em tudo: não há o que revisar.
    expect(ps.some((p) => p.titulo === 'Bia')).toBe(false);
    expect(totalDePendencias(ps)).toBe(9);
  });

  it('escola fora do catálogo, aluno sem escola/endereço e dias que não coincidem aparecem', () => {
    const r = ida({
      dias: ['ter'],
      paradas: ida().paradas.map((p) => (p.tipo === 'escola' ? { ...p, destinoId: null } : p.id === 'c2' ? { ...p, lat: undefined, lng: undefined } : p)),
      passageiros: ida().passageiros.map((x) => ({ ...x, destinoId: null })),
      escolasDisponiveis: [{ id: 'd1', destinoId: 'esc-2', dias: ['seg'] }],
    });
    const ps = pendenciasDeRevisao(r);
    expect(ps.find((p) => p.alvo === 'escola' && p.id === 'e1')!.faltas).toContain('escolher a escola no catálogo');
    expect(ps.find((p) => p.titulo === 'Ana')!.faltas).toEqual(['escola']);
    expect(ps.find((p) => p.titulo === 'Bia')!.faltas).toEqual(['ponto no mapa do endereço', 'escola']);
    expect(ps.find((p) => p.id === 'd1')!.faltas).toEqual(['os dias aceitos não coincidem com os dias da rota']);
  });

  it('volta: pede a liberação (não o limite de chegada) e o limite do ponto final continua cobrado', () => {
    const volta = ida({ sentido: 'volta', ultimoDesembarqueMin: null, paradas: [
      { id: 's', ordem: 0, tipo: 'saida', rotulo: 'Garagem', lat: -21.2, lng: -50.44, confirmado: true },
      { id: 'e1', ordem: 1, tipo: 'escola', rotulo: 'Escola Um', lat: -21.215, lng: -50.425, confirmado: true, destinoId: 'esc-1', atendimentoGrupoMin: 2 },
      { id: 'c1', ordem: 2, tipo: 'casa', rotulo: 'Rua A, 1', lat: -21.205, lng: -50.435, confirmado: true },
    ], passageiros: [{ ...ida().passageiros[0], embarqueParadaId: 'e1', desembarqueParadaId: 'c1' }] });
    const ps = pendenciasDeRevisao(volta);
    expect(ps.find((p) => p.alvo === 'escola')!.faltas).toEqual(['horário de liberação']);
    expect(ps.find((p) => p.alvo === 'rota')!.faltas).toEqual(['limite do ponto final (última entrega até)']);
  });
});
