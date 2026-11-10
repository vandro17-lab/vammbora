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
