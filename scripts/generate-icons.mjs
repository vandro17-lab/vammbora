// Gera, a partir da LOGO OFICIAL do VanBora (public/brand/vanbora-logo.png):
//  - os recortes de marca usados na interface (emblema e versão horizontal);
//  - os ícones PNG do PWA, favicon e apple-touch-icon.
// Uso: npm run icons  (requer "sharp", já em devDependencies)
//
// A arte oficial tem fundo PRETO (sem transparência) e é mantida intacta: os
// recortes só separam o emblema e o nome, sem redesenhar nem distorcer nada.
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'public/brand/vanbora-logo.png');
const BRAND = path.join(ROOT, 'public/brand');
const OUT = path.join(ROOT, 'public/icons');
const PRETO = { r: 0, g: 0, b: 0, alpha: 1 };

// Regiões da arte oficial (1312×1199): emblema (triângulo + van) e nome.
// A ponta de baixo do triângulo encosta no topo do nome: cada recorte apaga
// (com preto, a cor do fundo) só o pedacinho do outro elemento que invade.
const EMBLEMA = { left: 90, top: 35, width: 1005, height: 690 };
const NOME = { left: 128, top: 708, width: 1078, height: 196 };
const preto = (width, height) => ({ create: { width, height, channels: 4, background: PRETO } });
/** Emblema limpo: sem o topo das letras nas laterais da ponta do triângulo. */
const recorteEmblema = async () => sharp(await sharp(SOURCE).extract(EMBLEMA)
  .composite([
    { input: await sharp(preto(330, 22)).png().toBuffer(), left: 0, top: 668 },
    { input: await sharp(preto(495, 22)).png().toBuffer(), left: 510, top: 668 },
  ]).png().toBuffer());
/** Nome limpo: sem a ponta do triângulo acima do "n". */
const recorteNome = async () => sharp(await sharp(SOURCE).extract(NOME)
  .composite([{ input: await sharp(preto(200, 30)).png().toBuffer(), left: 280, top: 0 }]).png().toBuffer());

const feito = (arquivo) => console.log('gerado:', path.relative(process.cwd(), arquivo));

/** Arte inteira, sem cortar nem esticar, centralizada num quadrado preto. */
async function quadrado(arquivo, tamanho, ocupacao = 0.92, soEmblema = false) {
  const interno = Math.round(tamanho * ocupacao);
  const img = soEmblema ? await recorteEmblema() : sharp(SOURCE);
  const frente = await img.resize(interno, interno, { fit: 'contain', background: PRETO }).png().toBuffer();
  const destino = path.join(OUT, arquivo);
  await sharp({ create: { width: tamanho, height: tamanho, channels: 4, background: PRETO } })
    .composite([{ input: frente, gravity: 'centre' }]).png().toFile(destino);
  feito(destino);
}

/** Emblema sozinho (para espaços pequenos, onde o nome ficaria ilegível). */
async function emblema() {
  const destino = path.join(BRAND, 'vanbora-emblema.png');
  await (await recorteEmblema()).resize({ height: 400 }).png().toFile(destino);
  feito(destino);
}

/** Versão horizontal para cabeçalhos: emblema + nome, lado a lado, fundo preto. */
async function horizontal() {
  const altura = 240, margem = 20, vao = 22;
  const e = await (await recorteEmblema()).resize({ height: altura - 2 * margem }).png().toBuffer({ resolveWithObject: true });
  const n = await (await recorteNome()).resize({ height: Math.round(altura * 0.5) }).png().toBuffer({ resolveWithObject: true });
  const largura = margem + e.info.width + vao + n.info.width + margem;
  const destino = path.join(BRAND, 'vanbora-horizontal.png');
  await sharp({ create: { width: largura, height: altura, channels: 4, background: PRETO } })
    .composite([
      { input: e.data, left: margem, top: margem },
      { input: n.data, left: margem + e.info.width + vao, top: Math.round((altura - n.info.height) / 2) + 6 },
    ]).png().toFile(destino);
  feito(destino);
}

await mkdir(OUT, { recursive: true });
await emblema();
await horizontal();
await quadrado('icon-192.png', 192);
await quadrado('icon-512.png', 512);
// Maskable: a arte fica na zona segura (o sistema recorta as bordas).
await quadrado('maskable-192.png', 192, 0.72);
await quadrado('maskable-512.png', 512, 0.72);
await quadrado('apple-touch-icon.png', 180, 0.9);
// Favicon: só o emblema — o nome não se lê em 64 px.
await quadrado('favicon.png', 64, 0.94, true);
console.log('Identidade oficial do VanBora gerada com sucesso.');
