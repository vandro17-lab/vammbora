import { useEffect, useState } from 'react';

/**
 * Altura REALMENTE visível da tela, em px — descontando o teclado do celular.
 * (`100dvh` não encolhe com o teclado no iOS; a `visualViewport` sim.)
 * Serve para telas de altura fixa, como o construtor de rotas: mapa, formulário
 * e botão principal continuam à vista enquanto o motorista digita.
 */
export function useAlturaVisivel(): { altura: number | null; tecladoAberto: boolean } {
  const [estado, setEstado] = useState<{ altura: number | null; tecladoAberto: boolean }>({ altura: null, tecladoAberto: false });
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const medir = () => {
      const altura = Math.round(vv.height);
      // Teclado: a área visível fica bem menor que a janela.
      setEstado({ altura, tecladoAberto: window.innerHeight - altura > 150 });
    };
    medir();
    vv.addEventListener('resize', medir);
    vv.addEventListener('scroll', medir);
    return () => { vv.removeEventListener('resize', medir); vv.removeEventListener('scroll', medir); };
  }, []);
  return estado;
}
