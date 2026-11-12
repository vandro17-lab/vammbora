import type { Municipio } from '@/types';

/**
 * Municípios cuja sede fica numa ÁREA ATENDIDA (src/data/cidades.ts). São as
 * opções de "cidade do embarque" da família. Gerado da mesma fonte da tabela
 * public.municipios (migração 20261112225900; IBGE via
 * kelvins/municipios-brasileiros, licença MIT) — o banco confere o código.
 * Município NÃO é área de cobertura: a cobertura continua em `CIDADES`.
 */
export const MUNICIPIOS_COBERTURA: Municipio[] = [
  { ibge: 3501103, nome: 'Alto Alegre', uf: 'SP', lat: -21.5811, lng: -50.168 },
  { ibge: 3502804, nome: 'Araçatuba', uf: 'SP', lat: -21.2076, lng: -50.4401 },
  { ibge: 3504404, nome: 'Avanhandava', uf: 'SP', lat: -21.4584, lng: -49.9509 },
  { ibge: 3505104, nome: 'Barbosa', uf: 'SP', lat: -21.2657, lng: -49.9518 },
  { ibge: 3506201, nome: 'Bento de Abreu', uf: 'SP', lat: -21.2686, lng: -50.814 },
  { ibge: 3506409, nome: 'Bilac', uf: 'SP', lat: -21.404, lng: -50.4746 },
  { ibge: 3506508, nome: 'Birigui', uf: 'SP', lat: -21.291, lng: -50.3432 },
  { ibge: 3507704, nome: 'Braúna', uf: 'SP', lat: -21.499, lng: -50.3175 },
  { ibge: 3507753, nome: 'Brejo Alegre', uf: 'SP', lat: -21.1651, lng: -50.1861 },
  { ibge: 3508108, nome: 'Buritama', uf: 'SP', lat: -21.0661, lng: -50.1475 },
  { ibge: 3511904, nome: 'Clementina', uf: 'SP', lat: -21.5604, lng: -50.4525 },
  { ibge: 3512506, nome: 'Coroados', uf: 'SP', lat: -21.3521, lng: -50.2859 },
  { ibge: 3516507, nome: 'Gabriel Monteiro', uf: 'SP', lat: -21.5294, lng: -50.5573 },
  { ibge: 3516804, nome: 'Gastão Vidigal', uf: 'SP', lat: -20.7948, lng: -50.1912 },
  { ibge: 3517109, nome: 'Glicério', uf: 'SP', lat: -21.3812, lng: -50.2123 },
  { ibge: 3518206, nome: 'Guararapes', uf: 'SP', lat: -21.2544, lng: -50.6453 },
  { ibge: 3527256, nome: 'Lourdes', uf: 'SP', lat: -20.966, lng: -50.2263 },
  { ibge: 3527702, nome: 'Luiziânia', uf: 'SP', lat: -21.6737, lng: -50.3294 },
  { ibge: 3528106, nome: 'Macaubal', uf: 'SP', lat: -20.8022, lng: -49.9687 },
  { ibge: 3531001, nome: 'Monções', uf: 'SP', lat: -20.8509, lng: -50.0975 },
  { ibge: 3532868, nome: 'Nova Castilho', uf: 'SP', lat: -20.7615, lng: -50.3477 },
  { ibge: 3533304, nome: 'Nova Luzitânia', uf: 'SP', lat: -20.856, lng: -50.2617 },
  { ibge: 3537305, nome: 'Penápolis', uf: 'SP', lat: -21.4148, lng: -50.0769 },
  { ibge: 3537701, nome: 'Piacatu', uf: 'SP', lat: -21.5921, lng: -50.6003 },
  { ibge: 3539608, nome: 'Planalto', uf: 'SP', lat: -21.0342, lng: -49.933 },
  { ibge: 3544400, nome: 'Rubiácea', uf: 'SP', lat: -21.3006, lng: -50.7296 },
  { ibge: 3545100, nome: 'Salmourão', uf: 'SP', lat: -21.6267, lng: -50.8614 },
  { ibge: 3548054, nome: 'Santo Antônio do Aracanguá', uf: 'SP', lat: -20.9331, lng: -50.498 },
  { ibge: 3548401, nome: 'Santópolis do Aguapeí', uf: 'SP', lat: -21.6376, lng: -50.5044 },
  { ibge: 3555208, nome: 'Turiúba', uf: 'SP', lat: -20.9428, lng: -50.1135 },
  { ibge: 3555703, nome: 'União Paulista', uf: 'SP', lat: -20.8862, lng: -49.9025 },
  { ibge: 3556305, nome: 'Valparaíso', uf: 'SP', lat: -21.2229, lng: -50.8699 },
  { ibge: 3557154, nome: 'Zacarias', uf: 'SP', lat: -21.0506, lng: -50.0552 },
];
