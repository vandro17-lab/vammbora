import type { Cidade } from '@/types';

export const CIDADES: Cidade[] = [
  // Mesma área usada para localizar endereços e gravada em public.cities
  // (migração 20261112230000), que confere de novo no servidor.
  { id: 'aracatuba-sp', nome: 'Araçatuba', uf: 'SP', area: { latMin: -21.7, latMax: -20.7, lngMin: -51.0, lngMax: -49.9 } },
];

export const CIDADE_PADRAO = CIDADES[0];

/** Cidade atendida onde fica o ponto confirmado no mapa (ou null). */
export function cidadeDoPonto(lat: number, lng: number, cidades: Cidade[] = CIDADES): Cidade | null {
  return cidades.find((c) => c.area && lat >= c.area.latMin && lat <= c.area.latMax && lng >= c.area.lngMin && lng <= c.area.lngMax) ?? null;
}
