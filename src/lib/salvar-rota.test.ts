import { describe, it, expect } from 'vitest';
import { decidirSalvar, avisoRotaConcluidaSalva } from './salvar-rota';
import { adicionarAluno, removerAlunoDaRota } from './edicao-rota';
import { ocupacaoPorTrecho } from './ocupacao-rota';
import type { Rota, Veiculo } from '@/types/motorista';

/**
 * Etapa 2C — administrar passageiros de uma rota CONCLUÍDA sem publicar de novo:
 * o "Salvar" preserva o estado concluído quando a estrutura continua válida, e
 * nunca rebaixa sozinho para rascunho. Usa as funções reais de edição do
 * construtor (as mesmas da tela).
 */
const van = (lugares: number): Veiculo => ({ id: 'v1', modelo: 'Van', lugaresPassageiro: lugares, arCondicionado: false, acessivel: false, cintos: true, fotos: [] });

function rotaConcluida(): Rota {
  return {
    id: 'r1', nome: 'Ida manhã', sentido: 'ida', turno: 'manha', dias: ['seg'], veiculoId: 'v1',
    monitor: false, monitorOcupaLugar: false, lugaresReservados: 0, ultimoDesembarqueMin: 7 * 60,
    limiteAntecipacaoMin: null, status: 'concluida', ofertaPausada: false, atualizadoEm: '',
    paradas: [
      { id: 's', ordem: 0, tipo: 'saida', rotulo: 'Garagem', confirmado: true, lat: -21.205, lng: -50.44 },
      { id: 'a', ordem: 1, tipo: 'casa', rotulo: 'Casa A', confirmado: true, lat: -21.1995, lng: -50.4402 },
      { id: 'e', ordem: 2, tipo: 'escola', rotulo: 'Escola', destinoId: 'esc1', confirmado: true, lat: -21.2089, lng: -50.4328 },
    ],
    passageiros: [{ id: 'p1', identificacao: 'Ana', embarqueParadaId: 'a', desembarqueParadaId: 'e', destinoId: 'esc1' }],
  };
}

let seq = 0;
const novoId = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;

/** Inclui um aluno (cliente de fora do VanBora) pela função real do construtor. */
function comAluno(r: Rota, nome: string, escolaParadaId = 'e'): Rota {
  return adicionarAluno(r, {
    nome, endereco: { rotulo: `Rua de ${nome}, 10`, ponto: { lat: -21.2, lng: -50.435 } },
    escolaParadaId, naCasaId: null, atendimentoOrigem: null,
  } as Parameters<typeof adicionarAluno>[1], novoId).rota;
}

describe('Salvar no construtor (Etapa 2C)', () => {
  it('rota concluída: adicionar passageiro válido continua CONCLUÍDA (sem publicar de novo)', () => {
    const r = comAluno(rotaConcluida(), 'Bia');
    expect(r.passageiros).toHaveLength(2);
    expect(decidirSalvar(r, van(4))).toEqual({ tipo: 'salvar', status: 'concluida', continuaConcluida: true });
  });

  it('ocupação por trecho é recalculada a partir dos passageiros (nada guardado)', () => {
    const base = rotaConcluida();
    const pico = (r: Rota) => Math.max(...ocupacaoPorTrecho(r).map((t) => t.ocupacao));
    const com = comAluno(base, 'Bia');
    expect(pico(base)).toBe(1);
    expect(pico(com)).toBe(2);
    expect(pico(removerAlunoDaRota(com, com.passageiros[1].id))).toBe(1);
  });

  it('rota concluída: remover passageiro (vaga liberada) continua CONCLUÍDA', () => {
    const r = comAluno(rotaConcluida(), 'Bia');
    const sem = removerAlunoDaRota(r, r.passageiros[1].id);
    expect(decidirSalvar(sem, van(4)).tipo).toBe('salvar');
    expect(decidirSalvar(sem, van(4))).toMatchObject({ status: 'concluida' });
  });

  it('passageiro que estoura a capacidade: não rebaixa sozinho — pede escolha explícita', () => {
    const r = comAluno(comAluno(rotaConcluida(), 'Bia'), 'Caio');
    const d = decidirSalvar(r, van(2));
    expect(d.tipo).toBe('escolher');
    if (d.tipo === 'escolher') expect(d.problemas.join(' ')).toMatch(/lugar/);
  });

  it('horário que não fecha NÃO bloqueia (é aviso): a decisão só olha a estrutura', () => {
    const r = { ...comAluno(rotaConcluida(), 'Bia'), ultimoDesembarqueMin: 1, saidaHabitualMin: 23 * 60 };
    expect(decidirSalvar(r, van(4))).toMatchObject({ tipo: 'salvar', status: 'concluida' });
  });

  it('período não confirmado (rotas antigas) não impede manter a rota concluída', () => {
    expect(decidirSalvar({ ...rotaConcluida(), periodoConfirmado: false }, van(4))).toMatchObject({ status: 'concluida' });
  });

  it('rascunho continua rascunho (concluir é outro botão, com revisão)', () => {
    expect(decidirSalvar({ ...rotaConcluida(), status: 'rascunho' }, van(4))).toEqual({ tipo: 'salvar', status: 'rascunho', continuaConcluida: false });
  });

  it('a pausa da oferta é preservada e informada', () => {
    expect(avisoRotaConcluidaSalva({ ofertaPausada: true })).toMatch(/continua pausada/);
    expect(avisoRotaConcluidaSalva({ ofertaPausada: false })).toMatch(/vagas foram recalculadas/);
  });
});
