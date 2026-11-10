import { describe, it, expect } from 'vitest';
import type { Rota } from '@/types/motorista';
import { alunosForaDeOrdem, alunosQuePodemVoltar, ordenarEntregas, removerAluno, reordenarParadas, sugerirVolta, trocarEnderecoDoAluno } from './rota-volta';

// Rua de oeste para leste: garagem (0) · casa A (1) · casa B (2) · casa C (3) · escola (4).
const p = (id: string, x: number, tipo: 'saida' | 'casa' | 'escola', ordem: number) =>
  ({ id, ordem, tipo, rotulo: id, lat: -21.2, lng: -50.45 + x * 0.005, confirmado: true, destinoId: tipo === 'escola' ? 'esc-1' : null, destinoNome: tipo === 'escola' ? 'Escola Um' : null });
const aluno = (id: string, casa: string) => ({ id, identificacao: id, embarqueParadaId: casa, desembarqueParadaId: 'escola', horarioHabitualMin: 400, ajusteAntesMin: 5, ajusteDepoisMin: 5 });
const IDA: Rota = {
  id: 'ida-1', nome: 'Rota de ida', sentido: 'ida', turno: 'manha', dias: ['seg', 'ter'], veiculoId: 'van-1',
  monitor: false, monitorOcupaLugar: false, lugaresReservados: 0, ultimoDesembarqueMin: 420, limiteAntecipacaoMin: null,
  status: 'concluida', isPublished: true, atualizadoEm: '',
  paradas: [p('garagem', 0, 'saida', 0), p('casaA', 1, 'casa', 1), p('casaB', 2, 'casa', 2), p('casaC', 3, 'casa', 3), p('escola', 4, 'escola', 4)],
  passageiros: [aluno('Ana', 'casaA'), aluno('Bia', 'casaB'), aluno('Caio', 'casaC'), aluno('Davi', 'casaC')],
};
const rotulos = (r: Rota) => [...r.paradas].sort((a, b) => a.ordem - b.ordem).map((x) => x.rotulo);

describe('volta sugerida a partir da ida', () => {
  it('sai da escola e entrega pela ordem mais curta, terminando perto da garagem', () => {
    const v = sugerirVolta(IDA);
    expect(v.sentido).toBe('volta');
    expect(v.nome).toBe('Rota de volta');
    expect(rotulos(v)).toEqual(['escola', 'casaC', 'casaB', 'casaA']);
    expect(v.paradas.every((x) => x.tipo !== 'saida')).toBe(true);
    expect(v).toMatchObject({ id: '', status: 'rascunho', isPublished: false, veiculoId: 'van-1', turno: 'manha', ultimoDesembarqueMin: null });
  });
  it('cada aluno embarca na escola e desce na própria casa; ids novos, horários da ida não são copiados', () => {
    const v = sugerirVolta(IDA);
    const escola = v.paradas.find((x) => x.tipo === 'escola')!;
    const casaC = v.paradas.find((x) => x.rotulo === 'casaC')!;
    expect(v.passageiros).toHaveLength(4);
    expect(v.passageiros.every((x) => x.embarqueParadaId === escola.id)).toBe(true);
    expect(v.passageiros.filter((x) => x.desembarqueParadaId === casaC.id).map((x) => x.identificacao)).toEqual(['Caio', 'Davi']);
    expect(v.passageiros.every((x) => x.horarioHabitualMin === null)).toBe(true);
    expect(v.paradas.some((x) => IDA.paradas.some((y) => y.id === x.id))).toBe(false);
    expect(alunosForaDeOrdem(v)).toEqual([]);
  });
  it('quem não volta fica de fora, junto com a casa que ficou vazia', () => {
    const v = sugerirVolta(IDA, { voltamIds: ['Ana', 'Caio'] });
    expect(rotulos(v)).toEqual(['escola', 'casaC', 'casaA']);
    expect(v.passageiros.map((x) => x.identificacao)).toEqual(['Ana', 'Caio']);
  });
  it('aluno sem escola de desembarque na ida não entra na sugestão', () => {
    const ida = { ...IDA, passageiros: [...IDA.passageiros, { id: 'Eva', identificacao: 'Eva', embarqueParadaId: 'casaA', desembarqueParadaId: null }] };
    expect(alunosQuePodemVoltar(ida).map((x) => x.id)).not.toContain('Eva');
  });
  it('a ordem não é a ida invertida quando isso alonga o caminho', () => {
    // Casas fora de ordem geográfica na ida: A(1), C(3), B(2).
    const ida = { ...IDA, paradas: [p('casaA', 1, 'casa', 0), p('casaC', 3, 'casa', 1), p('casaB', 2, 'casa', 2), p('escola', 4, 'escola', 3)] };
    expect(rotulos(sugerirVolta(ida))).toEqual(['escola', 'casaC', 'casaB', 'casaA']);
  });
});

describe('ajustes do motorista na volta', () => {
  it('arrastar muda a ordem e avisa se uma casa ficou antes da escola', () => {
    const v = sugerirVolta(IDA);
    const ids = [...v.paradas].sort((a, b) => a.ordem - b.ordem).map((x) => x.id);
    const trocada = reordenarParadas(v, [ids[0], ids[3], ids[1], ids[2]]);
    expect(rotulos(trocada)).toEqual(['escola', 'casaA', 'casaC', 'casaB']);
    const errada = reordenarParadas(v, [ids[1], ids[0], ids[2], ids[3]]);
    expect(alunosForaDeOrdem(errada).map((x) => x.identificacao)).toEqual(['Caio', 'Davi']);
  });
  it('tirar um aluno remove a casa só se ninguém mais desce nela', () => {
    const v = sugerirVolta(IDA);
    const semCaio = removerAluno(v, v.passageiros.find((x) => x.identificacao === 'Caio')!.id);
    expect(rotulos(semCaio)).toContain('casaC');
    const semAna = removerAluno(v, v.passageiros.find((x) => x.identificacao === 'Ana')!.id);
    expect(rotulos(semAna)).toEqual(['escola', 'casaC', 'casaB']);
  });
  it('outro endereço: casa só dele é trocada; casa dividida ganha parada própria em seguida', () => {
    const v = sugerirVolta(IDA);
    const ana = v.passageiros.find((x) => x.identificacao === 'Ana')!;
    expect(rotulos(trocarEnderecoDoAluno(v, ana.id, 'Casa da avó', { lat: -21.3, lng: -50.4 }))).toEqual(['escola', 'casaC', 'casaB', 'Casa da avó']);
    const davi = v.passageiros.find((x) => x.identificacao === 'Davi')!;
    const r = trocarEnderecoDoAluno(v, davi.id, 'Casa da avó', { lat: -21.3, lng: -50.4 });
    expect(rotulos(r)).toEqual(['escola', 'casaC', 'Casa da avó', 'casaB', 'casaA']);
    expect(r.paradas.find((x) => x.id === r.passageiros.find((x2) => x2.id === davi.id)!.desembarqueParadaId)!.rotulo).toBe('Casa da avó');
  });
  it('pontos sem coordenada vão para o fim, sem quebrar a ordenação', () => {
    const o = ordenarEntregas({ lat: 0, lng: 0 }, [{ id: 'x' }, { id: 'longe', lat: 0, lng: 2 }, { id: 'perto', lat: 0, lng: 1 }] as { id: string; lat?: number; lng?: number }[]);
    expect(o.map((x) => x.id)).toEqual(['perto', 'longe', 'x']);
  });
});
