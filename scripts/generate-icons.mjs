// Gera os ícones PNG do PWA a partir da logo oficial VanBora.
// Uso: npm run icons  (requer "sharp", já em devDependencies)
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'public/brand/vanbora-logo.png');
const OUT = path.join(ROOT, 'public/icons');

async function logo(size) {
  return sharp(SOURCE).resize(size, size, { fit: 'cover' }).png();
}

async function writeLogo(file, size) {
  await (await logo(size)).toFile(path.join(OUT, file));
  console.log('gerado:', path.relative(process.cwd(), path.join(OUT, file)));
}

async function writeMaskable(file, size) {
  const safeSize = Math.round(size * 0.8);
  const foreground = await (await logo(safeSize)).toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .composite([{ input: foreground, left: Math.round((size - safeSize) / 2), top: Math.round((size - safeSize) / 2) }])
    .png()
    .toFile(path.join(OUT, file));
  console.log('gerado:', path.relative(process.cwd(), path.join(OUT, file)));
}

await mkdir(OUT, { recursive: true });
await writeLogo('icon-192.png', 192);
await writeLogo('icon-512.png', 512);
await writeMaskable('maskable-192.png', 192);
await writeMaskable('maskable-512.png', 512);
await writeLogo('apple-touch-icon.png', 180);
await writeLogo('favicon.png', 64);
console.log('Ícones oficiais da VanBora gerados com sucesso.');
