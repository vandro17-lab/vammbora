/**
 * Estado da tela de BUSCA INTELIGENTE (animação em tela cheia).
 *
 * É um único estado para o app inteiro: o formulário abre a tela no clique em
 * "Buscar vans" e a página de resultados a fecha quando a consulta real termina.
 * Assim a animação não reinicia na troca de página, não abre duas vezes e
 * sempre pode ser cancelada.
 */
export interface EstadoBuscaOverlay {
  aberta: boolean;
  /** Instante (ms) em que a busca atual começou. */
  iniciadaEm: number;
}

let estado: EstadoBuscaOverlay = { aberta: false, iniciadaEm: 0 };
let aoCancelar: (() => void) | null = null;
const ouvintes = new Set<() => void>();

function definir(novo: EstadoBuscaOverlay) {
  estado = novo;
  ouvintes.forEach((f) => f());
}

export const buscaOverlay = {
  /** Abre a tela. Se já estiver aberta, mantém o início (não reinicia a contagem). */
  abrir(agora: number = Date.now()): void {
    if (!estado.aberta) definir({ aberta: true, iniciadaEm: agora });
  },
  fechar(): void {
    aoCancelar = null;
    if (estado.aberta) definir({ aberta: false, iniciadaEm: estado.iniciadaEm });
  },
  /** Quem está conduzindo a busca informa como interrompê-la. */
  definirCancelamento(fn: (() => void) | null): void {
    aoCancelar = fn;
  },
  /** Botão "Cancelar": interrompe a etapa em andamento e fecha a tela. */
  cancelar(): void {
    const fn = aoCancelar;
    aoCancelar = null;
    try { fn?.(); } finally { this.fechar(); }
  },
  obter: (): EstadoBuscaOverlay => estado,
  assinar(f: () => void): () => void {
    ouvintes.add(f);
    return () => { ouvintes.delete(f); };
  },
};
