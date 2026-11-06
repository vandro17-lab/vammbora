/**
 * Registro de ESPAÇOS EDITÁVEIS (slots) de arte do app Vambora Motoristas.
 *
 * Cada slot é um lugar da interface onde o admin pode publicar uma imagem
 * profissional (ilustração, render ou ícone com fundo transparente). Enquanto
 * não houver arte publicada, o app mostra o visual atual (fallback) — nada
 * quebra. A estrutura é reutilizável: para criar um novo espaço, basta
 * acrescentar um item aqui e consumir com <SlotIlustracao/>/<SlotIcone/>.
 */

export type SlotKind = 'ilustracao' | 'icone';

export interface SlotDef {
  id: string;
  grupo: string;        // agrupamento/tela no admin (ex.: "Geral", "Tela Mais")
  titulo: string;
  descricao: string;
  kind: SlotKind;
  largura: number;      // px recomendados para exportar a arte
  altura: number;
  formatos: string[];   // MIME aceitos
  transparencia: boolean;
  areaSegura: string;   // orientação de enquadramento
}

export const FORMATOS_TRANSP = ['image/png', 'image/webp'];
export const FORMATOS_FOTO = ['image/png', 'image/webp', 'image/jpeg'];

/** Limite de tamanho de arquivo aceito no upload (bytes). */
export const TAMANHO_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const ICONES_MAIS: Array<[string, string]> = [
  ['icon.minhaVan', 'Minha Van'],
  ['icon.calendario', 'Calendário escolar'],
  ['icon.manutencao', 'Manutenção'],
  ['icon.combustivel', 'Combustível'],
  ['icon.relatorios', 'Relatórios'],
  ['icon.documentacao', 'Documentação'],
  ['icon.ajuda', 'Ajuda e Suporte'],
  ['icon.config', 'Configurações'],
];

export const SLOTS: SlotDef[] = [
  {
    id: 'header.van',
    grupo: 'Geral (cabeçalho)',
    titulo: 'Van do cabeçalho',
    descricao: 'Ilustração/render da van escolar exibida no topo das telas (Início, Inteligência e Mais).',
    kind: 'ilustracao',
    largura: 480, altura: 300,
    formatos: FORMATOS_TRANSP,
    transparencia: true,
    areaSegura: 'Fundo transparente. A van aparece sobre o verde, alinhada à direita; deixe respiro nas bordas.',
  },
  {
    id: 'clube.art',
    grupo: 'Tela Mais',
    titulo: 'Arte do Clube do Motorista',
    descricao: 'Ilustração do brinde/benefício que aparece no banner do Clube do Motorista.',
    kind: 'ilustracao',
    largura: 360, altura: 360,
    formatos: FORMATOS_TRANSP,
    transparencia: true,
    areaSegura: 'Fundo transparente, elemento central. Sem texto (o título já é renderizado pelo app).',
  },
  ...ICONES_MAIS.map(([id, nome]): SlotDef => ({
    id,
    grupo: 'Tela Mais — ícones',
    titulo: `Ícone · ${nome}`,
    descricao: `Ícone do atalho "${nome}" na grade da tela Mais.`,
    kind: 'icone',
    largura: 120, altura: 120,
    formatos: FORMATOS_TRANSP,
    transparencia: true,
    areaSegura: 'Fundo transparente, ícone centralizado com ~12% de margem interna.',
  })),
];

export function slotPorId(id: string): SlotDef | undefined {
  return SLOTS.find((s) => s.id === id);
}

export function aspecto(s: SlotDef): number {
  return s.largura / s.altura;
}

/** Slots agrupados por `grupo`, preservando a ordem de declaração. */
export function slotsPorGrupo(): Array<{ grupo: string; itens: SlotDef[] }> {
  const ordem: string[] = [];
  const mapa = new Map<string, SlotDef[]>();
  for (const s of SLOTS) {
    if (!mapa.has(s.grupo)) { mapa.set(s.grupo, []); ordem.push(s.grupo); }
    mapa.get(s.grupo)!.push(s);
  }
  return ordem.map((grupo) => ({ grupo, itens: mapa.get(grupo)! }));
}
