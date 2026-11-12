import { describe, it, expect } from 'vitest';
import { celulaCsv, formatarWhatsApp, gerarCsvInteressados, type InteressadoLancamento } from './prelancamento-admin';

const base: InteressadoLancamento = {
  id: '1', lead_type: 'familia', full_name: 'Maria "Teste" Silva', whatsapp_e164: '+5518998765432', email: null,
  street_address: '=HYPERLINK("http://x")', address_number: '12', neighborhood: 'Centro', address_complement: null,
  city: 'Araçatuba', state: 'SP', school_name: 'EE Exemplo; anexo', school_shift: 'manha', transport_direction: 'ida_volta',
  consent_at: '2026-11-11T12:00:00Z', privacy_policy_version: '2026-11-11', source: 'site', status: 'novo', resubmitted_at: null, created_at: '2026-11-11T12:00:00Z',
};

describe('exportação CSV dos interessados', () => {
  it('escapa aspas e neutraliza fórmulas em texto digitado pelo público', () => {
    expect(celulaCsv('a"b')).toBe('"a""b"');
    expect(celulaCsv('=1+1')).toBe(`"'=1+1"`);
    expect(celulaCsv('+55', false)).toBe('"+55"');
    expect(celulaCsv(null)).toBe('""');
  });
  it('gera cabeçalho + uma linha por inscrição, separador ";" e BOM', () => {
    const csv = gerarCsvInteressados([base, { ...base, id: '2', lead_type: 'motorista', school_name: null, school_shift: null, transport_direction: null, street_address: null }]);
    expect(csv.startsWith('﻿"Perfil";"Nome";"WhatsApp"')).toBe(true);
    const linhas = csv.trim().split('\r\n');
    expect(linhas).toHaveLength(3);
    expect(linhas[1]).toContain('"Família";"Maria ""Teste"" Silva";"5518998765432";""');
    expect(linhas[1]).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(linhas[1]).toContain('"EE Exemplo; anexo";"Manhã";"Ida e volta";"Novo"');
    expect(linhas[2]).toContain('"Motorista"');
  });
  it('formata WhatsApp para leitura', () => {
    expect(formatarWhatsApp('+5518998765432')).toBe('(18) 99876-5432');
  });
});
