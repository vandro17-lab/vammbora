/**
 * Registro de ESPAÇOS EDITÁVEIS (slots) de arte do app Vambora Motoristas.
 *
 * Cada slot é um lugar da interface onde o admin pode publicar uma imagem
 * profissional (ilustração, render ou ícone com fundo transparente). Enquanto
 * não houver arte publicada, o app mostra o visual atual (fallback) — nada
 * quebra. A estrutura é reutilizável: para criar um novo espaço, basta
 * acrescentar um item aqui e consumir com <SlotIlustracao/>/<SlotIcone/>.
 *
 * O mesmo registro alimenta duas experiências:
 *   1) o MODO "Editar aparência" dentro do próprio app (edição no layout real);
 *   2) o índice completo (admin) para alcançar slots que não estão na tela atual.
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

/** Cartões de parceria do Clube do Motorista (ícone = logo do parceiro). */
const CARTOES_CLUBE: Array<[string, string]> = [
  ['clube.card.postos', 'Postos / combustível'],
  ['clube.card.oficinas', 'Oficinas'],
  ['clube.card.pneus', 'Pneus / centro automotivo'],
  ['clube.card.seguro', 'Seguro veicular'],
];

/** Fábrica de slot de ícone quadrado transparente (reaproveitada nos grupos). */
function slotIcone(id: string, grupo: string, titulo: string, descricao: string): SlotDef {
  return {
    id, grupo, titulo, descricao, kind: 'icone',
    largura: 120, altura: 120,
    formatos: FORMATOS_TRANSP, transparencia: true,
    areaSegura: 'Fundo transparente, ícone/logo centralizado com ~12% de margem interna.',
  };
}

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

  /* ----------------------------- Início (Dashboard) ----------------------------- */
  {
    id: 'dash.van',
    grupo: 'Início',
    titulo: 'Van da ocupação',
    descricao: 'Ilustração da van no cartão de "Ocupação da van" da tela inicial.',
    kind: 'ilustracao',
    largura: 320, altura: 200,
    formatos: FORMATOS_TRANSP,
    transparencia: true,
    areaSegura: 'Fundo transparente, van centralizada. Aparece pequena ao lado do número de ocupação.',
  },
  {
    id: 'dash.primeirosPassos',
    grupo: 'Início',
    titulo: 'Ilustração "Vamos preparar o seu app"',
    descricao: 'Arte do onboarding exibido quando o motorista ainda não cadastrou van/rota.',
    kind: 'ilustracao',
    largura: 320, altura: 240,
    formatos: FORMATOS_TRANSP,
    transparencia: true,
    areaSegura: 'Fundo transparente, elemento central. Sem texto (o app já renderiza o título).',
  },

  /* -------------------------------- Minha Van -------------------------------- */
  {
    id: 'van.ilustracao',
    grupo: 'Minha Van',
    titulo: 'Ilustração da van',
    descricao: 'Ilustração/render exibido no cartão principal da tela Minha Van.',
    kind: 'ilustracao',
    largura: 320, altura: 200,
    formatos: FORMATOS_TRANSP,
    transparencia: true,
    areaSegura: 'Fundo transparente, van centralizada à esquerda do cartão.',
  },
  {
    id: 'van.vazio',
    grupo: 'Minha Van',
    titulo: 'Estado vazio "Cadastre sua van"',
    descricao: 'Arte exibida quando ainda não há van cadastrada.',
    kind: 'ilustracao',
    largura: 320, altura: 240,
    formatos: FORMATOS_TRANSP,
    transparencia: true,
    areaSegura: 'Fundo transparente, elemento central. Sem texto.',
  },

  /* ------------------------------ Oportunidades ------------------------------ */
  {
    id: 'oportunidades.vazio',
    grupo: 'Oportunidades',
    titulo: 'Estado vazio de oportunidades',
    descricao: 'Arte exibida quando não há oportunidades compatíveis no momento.',
    kind: 'ilustracao',
    largura: 320, altura: 240,
    formatos: FORMATOS_TRANSP,
    transparencia: true,
    areaSegura: 'Fundo transparente, elemento central. Sem texto.',
  },

  /* --------------------------------- Tela Mais --------------------------------- */
  {
    id: 'clube.art',
    grupo: 'Tela Mais',
    titulo: 'Arte do banner Clube do Motorista',
    descricao: 'Ilustração do brinde/benefício que aparece no banner do Clube do Motorista.',
    kind: 'ilustracao',
    largura: 360, altura: 360,
    formatos: FORMATOS_TRANSP,
    transparencia: true,
    areaSegura: 'Fundo transparente, elemento central. Sem texto (o título já é renderizado pelo app).',
  },
  ...ICONES_MAIS.map(([id, nome]) =>
    slotIcone(id, 'Tela Mais — ícones', `Ícone · ${nome}`, `Ícone do atalho "${nome}" na grade da tela Mais.`)),

  /* ---------------------------- Clube do Motorista ---------------------------- */
  {
    id: 'clube.hero',
    grupo: 'Clube do Motorista',
    titulo: 'Topo da tela Clube',
    descricao: 'Banner/ilustração de destaque no topo da tela do Clube do Motorista.',
    kind: 'ilustracao',
    largura: 480, altura: 240,
    formatos: FORMATOS_TRANSP,
    transparencia: true,
    areaSegura: 'Fundo transparente, elemento à direita. O título do Clube é renderizado por cima à esquerda.',
  },
  ...CARTOES_CLUBE.map(([id, nome]) =>
    slotIcone(id, 'Clube do Motorista — cartões', `Logo · ${nome}`, `Ícone/logo do cartão de parceria "${nome}".`)),
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
