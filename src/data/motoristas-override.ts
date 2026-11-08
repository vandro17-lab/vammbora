import { catalogoDemo } from '@/features/family-search-demo/engine';

/**
 * Ajustes do ADMIN aos motoristas demonstrativos (nome e foto), guardados no
 * navegador (localStorage). Servem para corrigir associações erradas — por
 * exemplo, uma foto de homem num nome de mulher — sem tocar na engine de busca.
 *
 * A engine continua gerando o catálogo; estes ajustes são aplicados por cima,
 * na camada de exibição (resultados da família) e no próprio editor.
 */
const K = 'vambora.demo.motoristas.override';

export type OverrideMotorista = { nome?: string; imagem?: string };

export function lerOverrides(): Record<string, OverrideMotorista> {
  try {
    const raw = localStorage.getItem(K);
    return raw ? (JSON.parse(raw) as Record<string, OverrideMotorista>) : {};
  } catch {
    return {};
  }
}

function salvarTodos(m: Record<string, OverrideMotorista>): void {
  try { localStorage.setItem(K, JSON.stringify(m)); } catch { /* cota/indisponível */ }
}

export function salvarOverride(slug: string, patch: OverrideMotorista): void {
  const m = lerOverrides();
  const atual = { ...m[slug], ...patch };
  // Normaliza: campo vazio volta ao padrão (remove do override).
  if (!atual.nome) delete atual.nome;
  if (!atual.imagem) delete atual.imagem;
  if (!atual.nome && !atual.imagem) delete m[slug];
  else m[slug] = atual;
  salvarTodos(m);
}

export function limparOverride(slug: string): void {
  const m = lerOverrides();
  delete m[slug];
  salvarTodos(m);
}

/** Aplica nome/foto ajustados a um objeto com slug/nome/imagem. */
export function aplicarOverride<T extends { slug: string; nome: string; imagem: string }>(
  o: T,
  overrides: Record<string, OverrideMotorista> = lerOverrides(),
): T {
  const ov = overrides[o.slug];
  if (!ov) return o;
  return { ...o, nome: ov.nome || o.nome, imagem: ov.imagem || o.imagem };
}

export type MotoristaDemo = {
  slug: string;
  nome: string;
  nomeOriginal: string;
  imagem: string;
  imagemOriginal: string;
  editado: boolean;
};

/** Lista dos motoristas demo (base + override) para o editor. */
export function listarMotoristasDemo(): MotoristaDemo[] {
  const ov = lerOverrides();
  return catalogoDemo().map((m) => {
    const o = ov[m.slug];
    return {
      slug: m.slug,
      nomeOriginal: m.nome,
      imagemOriginal: m.imagem,
      nome: o?.nome || m.nome,
      imagem: o?.imagem || m.imagem,
      editado: !!o,
    };
  });
}

/** Todas as fotos disponíveis (para o seletor de foto). */
export function fotosDisponiveis(): string[] {
  return catalogoDemo().map((m) => m.imagem);
}
