import type { Destino } from '@/types';

/**
 * Destinos de DEMONSTRAÇÃO para Araçatuba/SP.
 *
 * IMPORTANTE (honestidade / Ideathon): estes registros são EXEMPLOS.
 * Os códigos INEP aqui NÃO foram importados oficialmente — por isso a `fonte`
 * é "demonstração". Quando houver importação real do Censo/INEP, guardar
 * fonte, data e código verdadeiros (ver docs/pesquisas/escolas-inep).
 */
export const DESTINOS: Destino[] = [
  {
    id: 'esc-paineiras',
    tipo: 'escola',
    nome: 'Colégio Paineiras (demonstração)',
    bairro: 'Centro',
    cidadeId: 'aracatuba-sp',
    codigoInep: null,
    turnos: ['manha', 'tarde'],
    fonte: 'demonstração',
    lat: -21.2086,
    lng: -50.4326,
  },
  {
    id: 'esc-horizonte',
    tipo: 'escola',
    nome: 'Escola Novo Horizonte (demonstração)',
    bairro: 'Jardim Nova Iorque',
    cidadeId: 'aracatuba-sp',
    codigoInep: null,
    turnos: ['manha', 'tarde', 'integral'],
    fonte: 'demonstração',
    lat: -21.1962,
    lng: -50.4601,
  },
  {
    id: 'esc-sao-joao',
    tipo: 'escola',
    nome: 'Instituto São João (demonstração)',
    bairro: 'Vila Mendonça',
    cidadeId: 'aracatuba-sp',
    codigoInep: null,
    turnos: ['manha', 'tarde'],
    fonte: 'demonstração',
    lat: -21.2155,
    lng: -50.4489,
  },
  {
    id: 'fac-unifatec',
    tipo: 'faculdade',
    nome: 'Fatec Araçatuba (demonstração)',
    bairro: 'Jardim Alvorada',
    cidadeId: 'aracatuba-sp',
    codigoInep: null,
    turnos: ['noite'],
    fonte: 'demonstração',
    lat: -21.2228,
    lng: -50.4178,
  },
  {
    id: 'fac-unimed-campus',
    tipo: 'faculdade',
    nome: 'Campus Universitário Leste (demonstração)',
    bairro: 'Água Branca',
    cidadeId: 'aracatuba-sp',
    codigoInep: null,
    turnos: ['manha', 'noite'],
    fonte: 'demonstração',
    lat: -21.1889,
    lng: -50.4012,
  },
];

export const DESTINOS_POR_ID: Record<string, Destino> = Object.fromEntries(
  DESTINOS.map((d) => [d.id, d]),
);
