/** Área de recorte em pixels da imagem de origem (como o react-easy-crop entrega). */
export interface AreaPixels { x: number; y: number; width: number; height: number }

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem.'));
    img.src = src;
  });
}

/**
 * Recorta a imagem na área informada e exporta no tamanho ALVO do slot.
 * PNG preserva transparência (padrão). O canvas começa transparente — não há
 * preenchimento de fundo, então imagens com alfa continuam recortadas.
 */
export async function recortarParaBlob(
  src: string,
  area: AreaPixels,
  alvo: { largura: number; altura: number },
  tipo: 'image/png' | 'image/webp' = 'image/png',
): Promise<Blob> {
  const img = await carregarImagem(src);
  const canvas = document.createElement('canvas');
  canvas.width = alvo.largura;
  canvas.height = alvo.altura;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível neste navegador.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, alvo.largura, alvo.altura);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar a imagem.'))), tipo, 0.95);
  });
}
