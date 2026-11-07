/**
 * Avaliações DEMONSTRATIVAS, determinísticas por motorista.
 *
 * Importante: os motoristas da vitrine ("Tio João", "Tia Ana"…) são
 * personagens fictícios do modo demonstração. Estas notas e comentários
 * compõem o conjunto DEMONSTRATIVO — sempre rotulado como tal na interface —
 * e nunca devem ser apresentados como depoimentos reais de pessoas reais.
 *
 * Tudo é gerado a partir de uma semente estável (id/nome), então o mesmo
 * motorista sempre exibe exatamente as mesmas avaliações. Não há rede, banco
 * nem efeito sobre o motor de busca.
 */

export type ComentarioDemo = { autor: string; nota: number; texto: string; quando: string };
export type CriterioDemo = { nome: string; nota: number };
export type AvaliacoesDemo = {
  media: number;
  total: number;
  criterios: CriterioDemo[];
  /** Quantidade por estrela, de 5 a 1. */
  distribuicao: [number, number, number, number, number];
  comentarios: ComentarioDemo[];
};

function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const AUTORES = [
  'Mariana S.', 'Roberto M.', 'Juliana P.', 'Carlos E.', 'Fernanda L.', 'Patrícia R.',
  'André T.', 'Camila V.', 'Rodrigo A.', 'Beatriz C.', 'Gustavo N.', 'Larissa F.',
  'Marcelo D.', 'Tânia B.', 'Eduardo S.', 'Priscila M.', 'Vinícius O.', 'Renata G.',
];
const QUANDO = ['Há 1 semana', 'Há 2 semanas', 'Há 3 semanas', 'Há 1 mês', 'Há 2 meses', 'Há 3 meses'];

// Elogios variados — pontualidade, segurança, cuidado com as crianças, limpeza,
// comunicação. Textos de 5★ e um conjunto menor, mais contido, para 4★.
const ELOGIOS_5 = [
  'Excelente profissional! Sempre pontual e muito atencioso com os alunos.',
  'Van confortável, organizada e segura. Recomendo de olhos fechados!',
  'Dirige com muita responsabilidade e sempre avisa qualquer imprevisto no grupo.',
  'Minha filha adora ir na van. Tratamento carinhoso e muito cuidado no trânsito.',
  'Super pontual, educado e atencioso. Deixou nossa rotina muito mais tranquila.',
  'Veículo sempre limpo e em ordem. Comunicação ótima pelo grupo da turma.',
  'Confio totalmente. Chega no horário combinado e cuida bem de todas as crianças.',
  'Atendimento impecável desde o primeiro dia. Motorista muito gente boa e responsável.',
  'Dirige com calma e segurança. As crianças chegam sempre bem na escola.',
  'Nota mil! Pontualidade, cuidado e uma van muito bem conservada.',
];
const ELOGIOS_4 = [
  'Muito bom no geral. Pontual e atencioso, só pega um pouco de trânsito na volta.',
  'Atendimento cuidadoso e van organizada. Recomendo.',
  'Profissional dedicado e comunicativo. Experiência positiva até agora.',
  'Bom serviço, criança bem acompanhada. Pequenos atrasos em dias de chuva.',
];

function nota1(r: () => number, min: number, max: number) {
  return Math.round((min + r() * (max - min)) * 10) / 10;
}

/** Gera (sempre igual) as avaliações demonstrativas de um motorista. */
export function gerarAvaliacoesDemo(idOuSlug: string, nome: string): AvaliacoesDemo {
  const r = mulberry32(hash(`${idOuSlug}|${nome}|aval`));
  const total = 9 + Math.floor(r() * 32); // 9..40

  // Distribuição por estrela (perfil alto, realista).
  const c5 = Math.max(1, Math.round(total * (0.6 + r() * 0.22)));
  const c4 = Math.round(total * (0.08 + r() * 0.12));
  const c3 = Math.round(total * (0.01 + r() * 0.05));
  const c2 = r() < 0.4 ? 1 : 0;
  const c1 = r() < 0.18 ? 1 : 0;
  let c5f = total - (c4 + c3 + c2 + c1);
  if (c5f < 1) c5f = Math.max(1, c5); // proteção
  const distribuicao: [number, number, number, number, number] = [c5f, c4, c3, c2, c1];
  const somaNotas = 5 * c5f + 4 * c4 + 3 * c3 + 2 * c2 + 1 * c1;
  const totalReal = c5f + c4 + c3 + c2 + c1;
  const media = Math.round((somaNotas / totalReal) * 10) / 10;

  const criterios: CriterioDemo[] = ['Pontualidade', 'Segurança', 'Comunicação', 'Conforto'].map((nome) => ({
    nome,
    nota: Math.min(5, Math.max(4.2, nota1(r, media - 0.25, Math.min(5, media + 0.2)))),
  }));

  // Comentários (3..5), textos e autores sem repetição.
  const qtd = 3 + Math.floor(r() * 3);
  const autores = [...AUTORES];
  const pool5 = [...ELOGIOS_5];
  const pool4 = [...ELOGIOS_4];
  const pick = <T,>(arr: T[]) => arr.splice(Math.floor(r() * arr.length), 1)[0];
  const comentarios: ComentarioDemo[] = [];
  for (let i = 0; i < qtd; i++) {
    const cinco = r() < 0.78 || pool4.length === 0;
    const texto = cinco ? pick(pool5) : pick(pool4);
    if (!texto) break;
    comentarios.push({
      autor: pick(autores) ?? 'Responsável',
      nota: cinco ? 5 : 4,
      texto,
      quando: QUANDO[Math.floor(r() * QUANDO.length)],
    });
  }

  return { media, total: totalReal, criterios, distribuicao, comentarios };
}
