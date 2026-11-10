import { describe, it, expect, vi, beforeEach } from 'vitest';

const listarVeiculos = vi.fn();
const listarRotas = vi.fn();
vi.mock('@/data/motorista-store', () => ({
  listarVeiculos: () => listarVeiculos(),
  listarRotas: () => listarRotas(),
}));

import { carregarDadosMotorista } from './useDadosMotorista';
import type { Rota, Veiculo } from '@/types/motorista';

const VAN = { id: 'v1', modelo: 'Renault Master', lugaresPassageiro: 12, arCondicionado: true, acessivel: false, cintos: true, fotos: [] } as Veiculo;
const ROTA = { id: 'r1', nome: 'Manhã', sentido: 'ida', paradas: [], passageiros: [] } as unknown as Rota;

beforeEach(() => { listarVeiculos.mockReset(); listarRotas.mockReset(); });

describe('carregarDadosMotorista (painel do motorista)', () => {
  it('fluxo real sem registros: estado vazio verdadeiro, nunca o cenário de exemplo', async () => {
    listarVeiculos.mockResolvedValue([]); listarRotas.mockResolvedValue([]);
    const d = await carregarDadosMotorista(false);
    expect(d.demo).toBe(false);
    expect(d.veiculo).toBeNull();
    expect(d.rotas).toEqual([]);
  });

  it('fluxo real com registros: devolve exatamente o que está persistido', async () => {
    listarVeiculos.mockResolvedValue([VAN]); listarRotas.mockResolvedValue([ROTA]);
    const d = await carregarDadosMotorista(false);
    expect(d.demo).toBe(false);
    expect(d.veiculo).toBe(VAN);
    expect(d.rotas).toEqual([ROTA]);
  });

  it('erro real de consulta é propagado (não vira dados fictícios)', async () => {
    listarVeiculos.mockResolvedValue([]); listarRotas.mockRejectedValue(new Error('permission denied for table routes'));
    await expect(carregarDadosMotorista(false)).rejects.toThrow('permission denied');
  });

  it('cenário demonstrativo só no modo demo explícito e sem registros locais', async () => {
    listarVeiculos.mockResolvedValue([]); listarRotas.mockResolvedValue([]);
    const demo = await carregarDadosMotorista(true);
    expect(demo.demo).toBe(true);
    expect(demo.rotas.length).toBeGreaterThan(0);

    listarVeiculos.mockResolvedValue([VAN]);
    const comDados = await carregarDadosMotorista(true);
    expect(comDados.demo).toBe(false);
    expect(comDados.veiculo).toBe(VAN);
  });
});

import { tempoRotaMin } from './cenario';
describe('tempo estimado da rota = dirigindo + parado nas paradas', () => {
  const p = (id: string, ordem: number, tipo: 'casa' | 'escola', tempo: number | null) => ({ id, ordem, tipo, rotulo: id, lat: -21.2, lng: -50.44 + ordem * 0.01, confirmado: true, tempoAteProximaMin: tempo });
  const base = { id: 'r', nome: '', sentido: 'volta' as const, turno: null, dias: [], veiculoId: null, monitor: false, monitorOcupaLugar: false, lugaresReservados: 0, ultimoDesembarqueMin: null, limiteAntecipacaoMin: null, status: 'concluida' as const, atualizadoEm: '' };
  it('soma o tempo viário dos trechos e o tempo de cada parada com aluno', () => {
    const rota = { ...base, paradas: [p('escola', 0, 'escola', 5), p('c1', 1, 'casa', 2), p('c2', 2, 'casa', null)],
      passageiros: [{ id: 'a', identificacao: 'A', embarqueParadaId: 'escola', desembarqueParadaId: 'c1' }, { id: 'b', identificacao: 'B', embarqueParadaId: 'escola', desembarqueParadaId: 'c2', atendimentoMin: 4 }] };
    expect(tempoRotaMin(rota)).toEqual({ total: 16, dirigindo: 7, parado: 9 }); // 3 (escola) + 2 (padrão) + 4 (informado)
  });
  it('sem tempo viário, usa a distância a velocidade urbana (nunca 35 km/h sem paradas)', () => {
    const rota = { ...base, paradas: [p('escola', 0, 'escola', null), p('c1', 1, 'casa', null)], passageiros: [{ id: 'a', identificacao: 'A', embarqueParadaId: 'escola', desembarqueParadaId: 'c1' }] };
    const t = tempoRotaMin(rota);
    expect(t.parado).toBe(5);
    expect(t.dirigindo).toBeGreaterThanOrEqual(3); // ~1,37 km de ruas a 22 km/h
  });
});
